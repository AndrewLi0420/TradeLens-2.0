"""Recommendation model"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import Column, ForeignKey, Enum as SQLEnum, Numeric, Text, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.db.config import Base
from app.models.enums import SignalEnum, RiskLevelEnum


class Recommendation(Base):
    """Recommendation model for user stock recommendations"""
    __tablename__ = "recommendations"

    id = Column(PG_UUID(as_uuid=True), primary_key=True)
    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    stock_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("stocks.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    signal = Column(
        SQLEnum(SignalEnum, native_enum=False),
        nullable=False
    )
    confidence_score = Column(Numeric(precision=5, scale=4), nullable=False)  # R²-based, 0 to 1
    # Aggregated sentiment score used at generation time; kept nullable for backward-compat
    sentiment_score = Column(Numeric(precision=5, scale=4), nullable=True)
    risk_level = Column(
        SQLEnum(RiskLevelEnum, native_enum=False),
        nullable=False
    )
    explanation = Column(Text, nullable=True)
    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True
    )

    # Relationships
    user = relationship("User", back_populates="recommendations")
    stock = relationship("Stock", back_populates="recommendations")

    __table_args__ = (
        Index('ix_recommendations_user_id', 'user_id'),
        Index('ix_recommendations_stock_id', 'stock_id'),
        Index('ix_recommendations_created_at', 'created_at'),
    )

    def __repr__(self):
        return f"<Recommendation(user_id={self.user_id}, stock_id={self.stock_id}, signal={self.signal}, confidence={self.confidence_score})>"
