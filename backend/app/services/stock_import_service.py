"""Stock import service for S&P 500 stocks"""
from __future__ import annotations

import csv
import logging
from pathlib import Path
from typing import TextIO

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.stocks import upsert_stock
from app.core.config import settings

logger = logging.getLogger(__name__)


async def import_stocks_from_csv(
    session: AsyncSession,
    csv_path: str | Path,
) -> dict[str, int]:
    """
    Import stocks from CSV file.
    
    CSV format expected (supports both formats):
    - symbol,company_name,sector,fortune_500_rank (lowercase)
    - Symbol,Name,Sector (capitalized, S&P 500 format)
    
    Returns dict with import statistics:
    - imported: count of stocks imported
    - updated: count of stocks updated
    - errors: count of rows with errors
    """
    csv_path = Path(csv_path)
    
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    stats = {
        "imported": 0,
        "updated": 0,
        "errors": 0,
        "total_rows": 0,
    }
    
    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames or []
            
            # Normalize column names (handle both lowercase and capitalized formats)
            # Check for required columns in either format
            has_symbol = "symbol" in fieldnames or "Symbol" in fieldnames
            has_company_name = "company_name" in fieldnames or "Name" in fieldnames
            
            if not has_symbol or not has_company_name:
                raise ValueError(
                    f"CSV missing required columns. Need 'symbol'/'Symbol' and 'company_name'/'Name'. "
                    f"Found columns: {fieldnames}"
                )
            
            # Process each row
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                stats["total_rows"] += 1
                
                try:
                    # Extract and validate data (handle both column name formats)
                    symbol = (row.get("symbol") or row.get("Symbol") or "").strip().upper()
                    company_name = (row.get("company_name") or row.get("Name") or "").strip()
                    
                    if not symbol or not company_name:
                        logger.warning(
                            f"Row {row_num}: Missing required fields (symbol or company_name). Skipping."
                        )
                        stats["errors"] += 1
                        continue
                    
                    # Optional fields (handle both formats)
                    sector = (row.get("sector") or row.get("Sector") or "").strip() or None
                    fortune_500_rank_str = (row.get("fortune_500_rank") or row.get("Fortune_500_rank") or "").strip()
                    
                    fortune_500_rank = None
                    if fortune_500_rank_str:
                        try:
                            fortune_500_rank = int(fortune_500_rank_str)
                        except ValueError:
                            logger.warning(
                                f"Row {row_num}: Invalid fortune_500_rank '{fortune_500_rank_str}'. Skipping."
                            )
                            stats["errors"] += 1
                            continue
                    
                    # Check if stock exists (upsert will handle update vs insert)
                    from app.crud.stocks import get_stock_by_symbol
                    existing = await get_stock_by_symbol(session, symbol)
                    
                    await upsert_stock(
                        session=session,
                        symbol=symbol,
                        company_name=company_name,
                        sector=sector,
                        fortune_500_rank=fortune_500_rank,
                    )
                    
                    if existing:
                        stats["updated"] += 1
                    else:
                        stats["imported"] += 1
                    
                    # Log progress every 50 stocks
                    if (stats["imported"] + stats["updated"]) % 50 == 0:
                        logger.info(
                            f"Import progress: {stats['imported'] + stats['updated']} stocks processed"
                        )
                        
                except Exception as e:
                    logger.error(
                        f"Row {row_num}: Error importing stock: {e}. Row data: {row}"
                    )
                    stats["errors"] += 1
                    # Continue with next row instead of failing entire import
        
        logger.info(
            f"Import completed: {stats['imported']} imported, "
            f"{stats['updated']} updated, {stats['errors']} errors"
        )
        
        return stats
        
    except Exception as e:
        logger.error(f"Error reading CSV file: {e}")
        raise


async def import_fortune_500_stocks(
    session: AsyncSession,
    csv_path: str | Path | None = None,
) -> dict[str, int]:
    """
    Import S&P 500 stocks from default CSV location.
    
    Default CSV path: backend/data/SP500.csv
    """
    if csv_path is None:
        # Use default path relative to project root
        root_dir = Path(settings.PATHS.ROOT_DIR)
        csv_path = root_dir / "data" / "SP500.csv"
    
    return await import_stocks_from_csv(session, csv_path)

