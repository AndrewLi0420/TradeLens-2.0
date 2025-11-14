#!/usr/bin/env python3
"""
Backfill market_data using yfinance daily OHLCV for N months.

Usage:
  python backend/scripts/backfill_yfinance.py --months 12 --limit 100

Notes:
  - Requires: pip install yfinance
  - Writes to market_data table using close as price and volume as volume
  - Timestamps are stored as timezone-naive UTC to match DB schema
"""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
from typing import Optional

import sys
from pathlib import Path

# Ensure backend package is on path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# IMPORTANT: Import models first so SQLAlchemy resolves relationship strings
from app.users.models import User  # noqa: F401
from app.models import (  # noqa: F401
    UserPreferences,
    Stock,
    MarketData,
    SentimentData,
    Recommendation,
    UserStockTracking,
)

from app.db.config import async_session_maker
from app.crud.stocks import get_all_stocks
from app.crud.market_data import create_market_data
from sqlalchemy import select, and_


def _to_naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


async def _market_row_exists(session, stock_id, ts_naive_utc: datetime) -> bool:
    """Check if a market_data row exists for stock/timestamp."""
    result = await session.execute(
        select(MarketData.id).where(
            and_(
                MarketData.stock_id == stock_id,
                MarketData.timestamp == ts_naive_utc,
            )
        )
    )
    return result.first() is not None


async def backfill_with_yfinance(months: int = 12, limit: Optional[int] = None) -> dict[str, int]:
    try:
        import yfinance as yf  # type: ignore
    except Exception:
        print("yfinance is not installed. Install with: pip install yfinance")
        return {"processed": 0, "inserted": 0, "skipped": 0, "errors": 0, "invalid": 0}

    stats = {"processed": 0, "inserted": 0, "skipped": 0, "errors": 0, "invalid": 0}

    async with async_session_maker() as session:
        # Honor configured stock universe if present
        try:
            from app.core.config import settings
            universe = getattr(settings, "STOCK_UNIVERSE", []) or []
        except Exception:
            universe = []

        if universe:
            from app.crud.stocks import get_stocks_by_symbols
            stocks = await get_stocks_by_symbols(session, universe)
        else:
            stocks = await get_all_stocks(session)
        if limit is not None:
            stocks = stocks[: int(limit)]

        print(f"Found {len(stocks)} stocks. Backfilling {months} months daily data using yfinance...")

        for idx, stock in enumerate(stocks, start=1):
            symbol = stock.symbol
            # Basic validation: skip obviously invalid symbols (e.g., A1, A2)
            # Allow uppercase letters, digits (for some markets), dot and dash
            import re
            if not isinstance(symbol, str) or not re.fullmatch(r"[A-Za-z0-9\.\-]{1,10}", symbol or ""):
                stats["invalid"] += 1
                print(f"[{idx}/{len(stocks)}] {symbol}: invalid symbol format, skipped")
                continue
            try:
                # Fetch N months of daily bars
                # Normalize symbol for Yahoo Finance (e.g., BRK.B -> BRK-B)
                yahoo_symbol = symbol.replace(".", "-")
                ticker = yf.Ticker(yahoo_symbol)
                df = ticker.history(period=f"{months}mo", interval="1d", auto_adjust=False)

                if df is None or df.empty:
                    print(f"[{idx}/{len(stocks)}] {symbol} ({yahoo_symbol}): No data returned")
                    stats["skipped"] += 1
                    continue

                # Expected columns: Open High Low Close Volume Dividends Stock Splits
                inserted_for_symbol = 0
                for ts, row in df.iterrows():
                    try:
                        # Convert index to naive UTC datetime
                        ts_py = ts.to_pydatetime()
                        ts_naive = _to_naive_utc(ts_py)

                        price = float(row.get("Close")) if row.get("Close") is not None else None
                        volume_val = row.get("Volume")
                        volume = int(volume_val) if volume_val is not None else None

                        if price is None or volume is None:
                            continue
                        if price <= 0 or volume < 0:
                            continue

                        # Avoid duplicates
                        if await _market_row_exists(session, stock.id, ts_naive):
                            continue

                        await create_market_data(
                            session=session,
                            stock_id=stock.id,
                            price=price,
                            volume=volume,
                            timestamp=ts_naive,
                        )
                        inserted_for_symbol += 1
                        stats["inserted"] += 1
                    except Exception as e:
                        stats["errors"] += 1
                        # Continue with next row
                        continue

                stats["processed"] += 1
                print(f"[{idx}/{len(stocks)}] {symbol} ({yahoo_symbol}): inserted {inserted_for_symbol} rows")
            except Exception as e:
                stats["errors"] += 1
                print(f"[{idx}/{len(stocks)}] {symbol} ({yahoo_symbol}): error {e}")
                continue

    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill market_data using yfinance daily data")
    parser.add_argument("--months", type=int, default=12, help="Number of months to backfill (default: 12)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of stocks to process")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    stats = asyncio.run(backfill_with_yfinance(months=args.months, limit=args.limit))
    print("Backfill complete:", stats)


if __name__ == "__main__":
    main()


