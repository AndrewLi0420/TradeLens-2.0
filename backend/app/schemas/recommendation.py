"""Recommendation schemas"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from app.models.enums import SignalEnum, RiskLevelEnum
from app.schemas.stock import StockRead


class RecommendationBase(BaseModel):
    """Base schema for recommendation"""
    user_id: UUID
    stock_id: UUID
    signal: SignalEnum
    confidence_score: float  # R²-based, 0 to 1
    risk_level: RiskLevelEnum
    explanation: str | None = None


class RecommendationCreate(RecommendationBase):
    """Schema for creating recommendation"""
    pass


class RecommendationUpdate(BaseModel):
    """Schema for updating recommendation"""
    signal: SignalEnum | None = None
    confidence_score: float | None = None
    risk_level: RiskLevelEnum | None = None
    explanation: str | None = None


class RecommendationRead(RecommendationBase):
    """Schema for reading recommendation"""
    id: UUID
    sentiment_score: float | None = None  # Aggregated sentiment score
    created_at: datetime
    stock: StockRead  # Include stock information

    class Config:
        from_attributes = True
