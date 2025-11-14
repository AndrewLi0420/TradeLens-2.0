"""Scheduled task for web scraping sentiment collection"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.crud.stocks import get_all_stocks as _get_all_stocks
from app.crud.sentiment_data import upsert_sentiment_data
from app.services.sentiment_service import (
    collect_marketwatch_sentiment,
    collect_seekingalpha_sentiment,
    aggregate_sentiment_scores,
)

logger = logging.getLogger(__name__)

# Batch + scheduling parameters
BATCH_SIZE = 25  # Smaller than market data due to scraping delays
SOURCE_FUNCS = [collect_marketwatch_sentiment, collect_seekingalpha_sentiment]


def _normalize_timestamp_minute(ts: datetime) -> datetime:
    """Normalize timestamp to minute precision and convert to timezone-naive UTC."""
    # Convert to UTC if timezone-aware, then make naive
    if ts.tzinfo is not None:
        ts = ts.astimezone(timezone.utc)
    return ts.replace(second=0, microsecond=0, tzinfo=None)


async def _collect_for_symbol(symbol: str) -> list[dict]:
    tasks = [func(symbol) for func in SOURCE_FUNCS]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    cleaned: list[dict] = []
    for r in results:
        if isinstance(r, Exception):
            logger.error("Collector error for %s: %s", symbol, r)
            continue
        if r:
            cleaned.append(r)
    return cleaned


async def collect_sentiment_for_stocks(
    session: AsyncSession,
    stocks: list,
    batch_size: int = BATCH_SIZE,
) -> dict[str, int]:
    stats = {"total": len(stocks), "successful": 0, "failed": 0}
    for batch_start in range(0, len(stocks), batch_size):
        batch_end = min(batch_start + batch_size, len(stocks))
        batch = stocks[batch_start:batch_end]
        logger.info(
            "Processing sentiment batch %s-%s of %s",
            batch_start + 1,
            batch_end,
            len(stocks),
        )

        sym_to_records = await asyncio.gather(
            *[_collect_for_symbol(s.symbol) for s in batch], return_exceptions=True
        )

        for stock, rec in zip(batch, sym_to_records):
            if isinstance(rec, Exception):
                stats["failed"] += 1
                continue
            # Persist per-source records (idempotent using minute-normalized timestamp)
            persisted_any = False
            for src in rec:
                try:
                    if src.get("timestamp"):
                        ts_norm = _normalize_timestamp_minute(src["timestamp"])
                    else:
                        # Create timezone-naive UTC timestamp
                        ts_norm = datetime.now(timezone.utc).replace(second=0, microsecond=0, tzinfo=None)
                    # Use upsert for idempotency (handles duplicates gracefully)
                    await upsert_sentiment_data(
                        session=session,
                        stock_id=stock.id,
                        sentiment_score=src["sentiment_score"],
                        source=src.get("source", "unknown"),
                        timestamp=ts_norm,
                    )
                    persisted_any = True
                except Exception as e:
                    logger.error("DB error storing per-source sentiment for %s: %s", stock.symbol, e)
            # Aggregate after attempting per-source persistence
            agg = aggregate_sentiment_scores(rec)
            if not agg:
                stats["failed"] += 1
                continue
            try:
                # Use latest per-source minute-normalized timestamp for aggregate idempotency
                ts_candidates = [
                    _normalize_timestamp_minute(src["timestamp"]) for src in rec if src.get("timestamp")
                ]
                if ts_candidates:
                    ts = max(ts_candidates)
                else:
                    # Create timezone-naive UTC timestamp
                    ts = datetime.now(timezone.utc).replace(second=0, microsecond=0, tzinfo=None)
                # Use upsert for idempotency (handles duplicates gracefully)
                await upsert_sentiment_data(
                    session=session,
                    stock_id=stock.id,
                    sentiment_score=agg["sentiment_score"],
                    source="web_aggregate",
                    timestamp=ts,
                )
                stats["successful"] += 1 if persisted_any or agg else 1
            except Exception as e:
                logger.error("DB error storing sentiment for %s: %s", stock.symbol, e)
                stats["failed"] += 1

        if batch_end < len(stocks):
            await asyncio.sleep(1)

    return stats


async def collect_sentiment_job() -> None:
    logger.info("Starting sentiment collection job")
    start_time = datetime.now(timezone.utc)

    engine = None
    try:
        engine = create_async_engine(str(settings.DATABASE_URI))
        async_session_maker = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        async with async_session_maker() as session:
            stocks = await _get_all_stocks(session)
            if not stocks:
                logger.warning("No stocks found; skipping sentiment job")
                return
            stats = await collect_sentiment_for_stocks(session, stocks, BATCH_SIZE)
            duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.info(
                "Sentiment job completed: %s/%s successful (%s failed) in %.1fs",
                stats["successful"],
                stats["total"],
                stats["failed"],
                duration,
            )
    finally:
        if engine is not None:
            try:
                await engine.dispose()
            except Exception:
                pass


