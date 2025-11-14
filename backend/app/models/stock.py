"""Stock model"""
from __future__ import annotations

from uuid import UUID
from sqlalchemy import Column, String, Integer, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.db.config import Base


class Stock(Base):
    """Stock model for Fortune 500 companies"""
    __tablename__ = "stocks"

    id = Column(PG_UUID(as_uuid=True), primary_key=True)
    symbol = Column(String(10), unique=True, nullable=False)
    company_name = Column(String(255), nullable=False)
    sector = Column(String(100), nullable=True)
    fortune_500_rank = Column(Integer, nullable=True)

    # Relationships
    market_data = relationship("MarketData", back_populates="stock", cascade="all, delete-orphan")
    sentiment_data = relationship("SentimentData", back_populates="stock", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="stock", cascade="all, delete-orphan")
    tracked_by_users = relationship("UserStockTracking", back_populates="stock", cascade="all, delete-orphan")

    __table_args__ = (
        Index('ix_stocks_symbol', 'symbol', unique=True),
        Index('ix_stocks_company_name', 'company_name'),
    )

    def __repr__(self):
        return f"<Stock(symbol={self.symbol}, company_name={self.company_name})>"
