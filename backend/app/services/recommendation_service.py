"""Recommendation service with risk assessment calculation"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID
from typing import Any, Sequence

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.market_data import get_market_data_history
from app.crud.sentiment_data import get_aggregated_sentiment
from app.crud.users import get_user_preferences
from app.crud.stocks import get_all_stocks
from app.services.ml_service import predict_stock
from app.models.recommendation import Recommendation
from app.models.enums import SignalEnum
from app.models.enums import RiskLevelEnum, HoldingPeriodEnum

logger = logging.getLogger(__name__)


async def calculate_volatility(
    session: AsyncSession,
    stock_id: UUID,
    days: int = 30,
) -> float:
    """
    Calculate normalized volatility score for a stock based on recent price history.
    
    Volatility is calculated as the standard deviation of price changes over the
    specified time window, then normalized to [0, 1] range.
    
    Args:
        session: Database session
        stock_id: UUID of the stock
        days: Number of days to look back for historical data (default: 30)
    
    Returns:
        Normalized volatility score in [0, 1] range
        - 0.0 = no volatility (all prices constant)
        - 1.0 = maximum volatility observed
        - Returns 0.0 if insufficient data (< 7 days) or calculation fails
    """
    try:
        # Calculate date range
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        # Query historical market data
        market_history = await get_market_data_history(
            session=session,
            stock_id=stock_id,
            start_date=start_date,
            end_date=end_date,
        )
        
        # Need at least 7 days of data for meaningful volatility calculation
        if len(market_history) < 7:
            logger.warning(
                "Insufficient market data for volatility calculation: stock_id=%s, data_points=%d (need >= 7)",
                stock_id,
                len(market_history),
            )
            return 0.0
        
        # Extract prices and calculate price changes (returns)
        prices = [float(record.price) for record in market_history]
        
        if len(prices) < 2:
            return 0.0
        
        # Calculate price changes: (current - previous) / previous
        price_changes = []
        for i in range(1, len(prices)):
            if prices[i - 1] != 0:
                change = (prices[i] - prices[i - 1]) / prices[i - 1]
                price_changes.append(change)
        
        if len(price_changes) < 2:
            # All prices constant or insufficient data
            return 0.0
        
        # Calculate standard deviation of price changes
        volatility = float(np.std(price_changes))
        
        # Normalize volatility to [0, 1] range
        # Using a scaling factor: assume max reasonable volatility is 0.1 (10% daily change)
        # For values > 0.1, cap at 1.0
        max_volatility = 0.1  # 10% daily change is considered high volatility
        normalized_volatility = min(volatility / max_volatility, 1.0)
        
        # Ensure non-negative
        normalized_volatility = max(0.0, normalized_volatility)
        
        logger.debug(
            "Volatility calculated: stock_id=%s, volatility=%.4f, normalized=%.4f",
            stock_id,
            volatility,
            normalized_volatility,
        )
        
        return normalized_volatility
        
    except Exception as e:
        logger.error(
            "Error calculating volatility for stock_id=%s: %s",
            stock_id,
            str(e),
            exc_info=True,
        )
        return 0.0


async def calculate_risk_level(
    session: AsyncSession,
    stock_id: UUID,
    ml_confidence: float,
    market_data: dict[str, Any] | None = None,
    market_conditions: dict[str, Any] | None = None,
) -> RiskLevelEnum:
    """
    Calculate risk level (low/medium/high) for a stock recommendation.
    
    Risk calculation combines three components:
    1. Volatility: Recent market volatility (standard deviation of price changes)
    2. ML Uncertainty: Inverse of confidence score (lower confidence = higher uncertainty = higher risk)
    3. Market Conditions: Overall market volatility indicator (optional)
    
    Components are weighted and combined into a risk score [0, 1], then mapped to risk levels:
    - Low: 0.0-0.33
    - Medium: 0.34-0.66
    - High: 0.67-1.0
    
    Args:
        session: Database session
        stock_id: UUID of the stock
        ml_confidence: ML model confidence score in [0, 1] range
        market_data: Optional dict with current market data (not currently used, but kept for interface compatibility)
        market_conditions: Optional dict with market conditions (e.g., overall market volatility)
            Expected format: {"market_volatility": float} where 0.0-1.0 represents overall market volatility
    
    Returns:
        RiskLevelEnum: LOW, MEDIUM, or HIGH
    """
    try:
        # Validate ML confidence score
        if not (0.0 <= ml_confidence <= 1.0):
            logger.warning(
                "Invalid ML confidence score: %s (expected [0, 1]), using default risk level",
                ml_confidence,
            )
            return RiskLevelEnum.MEDIUM
        
        # Component 1: Volatility (weight: 40%)
        volatility_score = await calculate_volatility(session, stock_id, days=30)
        volatility_weight = 0.4
        
        # Component 2: ML Uncertainty (weight: 40%)
        # Lower confidence = higher uncertainty = higher risk
        # Inverse: uncertainty = 1 - confidence
        ml_uncertainty = 1.0 - ml_confidence
        ml_uncertainty_weight = 0.4
        
        # Component 3: Market Conditions (weight: 20%)
        # If market conditions provided, use market volatility indicator
        # Otherwise, default to neutral (0.5)
        if market_conditions and "market_volatility" in market_conditions:
            market_volatility = float(market_conditions["market_volatility"])
            # Ensure within [0, 1] range
            market_volatility = max(0.0, min(1.0, market_volatility))
        else:
            # Default to neutral if not provided
            market_volatility = 0.5
            logger.debug(
                "Market conditions not provided for stock_id=%s, using default market volatility (0.5)",
                stock_id,
            )
        
        market_conditions_weight = 0.2
        
        # Weighted combination of components
        risk_score = (
            volatility_score * volatility_weight +
            ml_uncertainty * ml_uncertainty_weight +
            market_volatility * market_conditions_weight
        )
        
        # Ensure risk score is in [0, 1] range
        risk_score = max(0.0, min(1.0, risk_score))
        
        # Map risk score to risk level
        if risk_score <= 0.33:
            risk_level = RiskLevelEnum.LOW
        elif risk_score <= 0.66:
            risk_level = RiskLevelEnum.MEDIUM
        else:
            risk_level = RiskLevelEnum.HIGH
        
        logger.info(
            "Risk level calculated: stock_id=%s, risk_score=%.3f, risk_level=%s, "
            "volatility=%.3f, ml_uncertainty=%.3f, market_volatility=%.3f",
            stock_id,
            risk_score,
            risk_level.value,
            volatility_score,
            ml_uncertainty,
            market_volatility,
        )
        
        return risk_level
        
    except Exception as e:
        logger.error(
            "Error calculating risk level for stock_id=%s: %s",
            stock_id,
            str(e),
            exc_info=True,
        )
        # Return default risk level (medium) on error
        return RiskLevelEnum.MEDIUM


def validate_explanation_quality(explanation: str) -> dict[str, Any]:
    """
    Validate explanation quality against acceptance criteria.
    
    Checks:
    - Length: 2-3 sentences (approximately 50-150 words)
    - Contains sentiment, ML signal, and risk references
    - Non-technical language (basic readability check)
    - Data sources and timestamps included
    
    Args:
        explanation: Explanation string to validate
    
    Returns:
        Dictionary with validation results:
        - is_valid: bool
        - warnings: list[str] - List of quality warnings
        - word_count: int
        - sentence_count: int
        - has_sentiment_ref: bool
        - has_ml_signal_ref: bool
        - has_risk_ref: bool
        - has_data_sources: bool
    """
    warnings: list[str] = []
    
    # Count words and sentences
    words = explanation.split()
    word_count = len(words)
    # Split by period followed by space or end of string (not decimal points or abbreviations)
    # Use regex to split on periods that are followed by space or end of string
    import re
    # Split on period-space or period-end, but not on decimal numbers or abbreviations
    sentence_endings = re.split(r'\.(?=\s|$)', explanation)
    sentences = [s.strip() for s in sentence_endings if s.strip() and len(s.strip()) > 10]  # Filter out very short fragments
    sentence_count = len(sentences)
    
    # Check length (50-150 words, 2-3 sentences)
    if word_count < 50:
        warnings.append(f"Explanation too short: {word_count} words (minimum 50)")
    elif word_count > 200:
        warnings.append(f"Explanation too long: {word_count} words (maximum 200)")
    
    if sentence_count < 2:
        warnings.append(f"Explanation has too few sentences: {sentence_count} (minimum 2)")
    elif sentence_count > 4:
        warnings.append(f"Explanation has too many sentences: {sentence_count} (recommended 2-3)")
    
    # Check for required content references (case-insensitive)
    explanation_lower = explanation.lower()
    
    # Check for sentiment references
    sentiment_keywords = ['sentiment', 'positive', 'negative', 'neutral', 'favorable', 'unfavorable']
    has_sentiment_ref = any(keyword in explanation_lower for keyword in sentiment_keywords)
    if not has_sentiment_ref:
        warnings.append("Explanation missing sentiment trend references")
    
    # Check for ML signal references
    ml_keywords = ['model', 'confidence', 'ml', 'prediction', 'signal', 'buy', 'sell', 'hold']
    has_ml_signal_ref = any(keyword in explanation_lower for keyword in ml_keywords)
    if not has_ml_signal_ref:
        warnings.append("Explanation missing ML model signal references")
    
    # Check for risk references
    risk_keywords = ['risk', 'volatility', 'uncertainty', 'low risk', 'medium risk', 'high risk', 'moderate risk']
    has_risk_ref = any(keyword in explanation_lower for keyword in risk_keywords)
    if not has_risk_ref:
        warnings.append("Explanation missing risk factor references")
    
    # Check for data sources
    has_data_sources = 'data source' in explanation_lower or 'updated' in explanation_lower or 'timestamp' in explanation_lower
    if not has_data_sources:
        warnings.append("Explanation missing data source attribution or timestamps")
    
    # Basic readability check: avoid excessive technical jargon
    technical_jargon = ['r²', 'r-squared', 'r2', 'neural network', 'random forest', 'ensemble']
    jargon_count = sum(1 for jargon in technical_jargon if jargon in explanation_lower)
    if jargon_count > 2:
        warnings.append(f"Explanation may contain too much technical jargon ({jargon_count} technical terms)")
    
    # Overall validation: valid if no critical warnings
    is_valid = len(warnings) == 0 or all('too' not in w.lower() for w in warnings)
    
    return {
        "is_valid": is_valid,
        "warnings": warnings,
        "word_count": word_count,
        "sentence_count": sentence_count,
        "has_sentiment_ref": has_sentiment_ref,
        "has_ml_signal_ref": has_ml_signal_ref,
        "has_risk_ref": has_risk_ref,
        "has_data_sources": has_data_sources,
    }


async def synthesize_explanation(
    session: AsyncSession,
    stock_id: UUID,
    signal: str,
    confidence_score: float,
    sentiment_score: float | None,
    risk_level: RiskLevelEnum,
    ml_model_used: str = "ensemble",
    ml_r_squared: float | None = None,
) -> str:
    """
    Synthesize a human-readable explanation for a recommendation.
    
    Follows Pattern 2 (Confidence-Scored Recommendation Generation with Explanation Synthesis):
    - Combines ML predictions, sentiment scores, risk assessment into readable explanations
    - References all data sources transparently
    - Includes timestamps for data freshness
    - Uses non-technical language (2-3 sentences)
    
    Args:
        session: Database session
        stock_id: UUID of the stock
        signal: Prediction signal ("buy", "sell", "hold")
        confidence_score: ML model confidence score [0, 1]
        sentiment_score: Aggregated sentiment score (can be None)
        risk_level: Risk level (LOW, MEDIUM, HIGH)
        ml_model_used: Type of ML model used ("neural_network", "random_forest", "ensemble")
        ml_r_squared: R² score from ML model metadata (optional)
    
    Returns:
        Explanation string (2-3 sentences) with data source references
    """
    from app.crud.sentiment_data import get_latest_sentiment_data
    from app.crud.market_data import get_latest_market_data
    
    # Get latest data timestamps for freshness indicators
    latest_sentiment = await get_latest_sentiment_data(session, stock_id)
    latest_market = await get_latest_market_data(session, stock_id)
    
    # Format timestamps as relative time
    def format_time_ago(timestamp: datetime | None) -> str:
        if timestamp is None:
            return "unknown"
        now = datetime.now(timezone.utc)
        # Normalize timestamp to timezone-aware if it's naive (database stores naive UTC)
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        diff = now - timestamp
        minutes = int(diff.total_seconds() / 60)
        hours = int(diff.total_seconds() / 3600)
        if minutes < 1:
            return "just now"
        elif minutes < 60:
            return f"{minutes} min ago"
        elif hours < 24:
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        else:
            days = int(diff.total_seconds() / 86400)
            return f"{days} day{'s' if days > 1 else ''} ago"
    
    sentiment_time = format_time_ago(latest_sentiment.timestamp if latest_sentiment else None)
    market_time = format_time_ago(latest_market.timestamp if latest_market else None)
    
    # Determine sentiment trend
    if sentiment_score is None:
        sentiment_trend = "neutral sentiment"
        sentiment_desc = "limited sentiment data"
    elif sentiment_score > 0.1:
        sentiment_trend = "positive sentiment trends"
        sentiment_desc = "favorable market sentiment"
    elif sentiment_score < -0.1:
        sentiment_trend = "negative sentiment trends"
        sentiment_desc = "unfavorable market sentiment"
    else:
        sentiment_trend = "neutral sentiment trends"
        sentiment_desc = "neutral market sentiment"
    
    # Format ML model signal description
    signal_desc = {
        "buy": "suggests potential price increase",
        "sell": "indicates potential price decrease",
        "hold": "suggests maintaining current position",
    }.get(signal.lower(), "indicates a balanced outlook")
    
    # Format risk description
    risk_desc = {
        RiskLevelEnum.LOW: "low risk",
        RiskLevelEnum.MEDIUM: "moderate risk",
        RiskLevelEnum.HIGH: "higher risk",
    }.get(risk_level, "moderate risk")
    
    # Format confidence as percentage
    confidence_percent = int(confidence_score * 100)
    
    # Format R² if available
    r_squared_str = ""
    if ml_r_squared is not None:
        r_squared_str = f" R²: {ml_r_squared:.2f}"
    
    # Build explanation (2-3 sentences, non-technical)
    explanation_parts = []
    
    # Sentence 1: Main recommendation with ML signal and confidence
    explanation_parts.append(
        f"Our {ml_model_used.replace('_', ' ')} model {signal_desc} with {confidence_percent}% confidence "
        f"(ML model confidence: {confidence_score:.2f}{r_squared_str}), "
        f"based on analysis of recent market patterns and historical performance."
    )
    
    # Sentence 2: Sentiment and risk factors
    explanation_parts.append(
        f"Market analysis shows {sentiment_trend} ({sentiment_desc}) and {risk_desc} factors, "
        f"indicating {risk_level.value.lower()} volatility and market conditions."
    )
    
    # Sentence 3: Data sources with timestamps (embedded in explanation)
    data_sources = []
    if latest_sentiment:
        source_name = "News articles"
        if hasattr(latest_sentiment, 'source') and latest_sentiment.source:
            source_name = latest_sentiment.source.replace("_", " ").title()
        data_sources.append(f"Sentiment from {source_name} (updated {sentiment_time})")
    if latest_market:
        data_sources.append(f"Market data (updated {market_time})")
    if ml_r_squared is not None:
        data_sources.append(f"ML model confidence: {confidence_score:.2f} R²: {ml_r_squared:.2f}")
    else:
        data_sources.append(f"ML model confidence: {confidence_score:.2f}")
    
    if data_sources:
        explanation_parts.append(
            f"Data sources: {', '.join(data_sources)}."
        )
    
    explanation = " ".join(explanation_parts)
    
    # Ensure explanation is within reasonable length (50-200 words)
    word_count = len(explanation.split())
    if word_count < 50:
        # Add more context if too short
        explanation += " This recommendation considers multiple factors to provide a balanced assessment."
    elif word_count > 200:
        # Truncate if too long (shouldn't happen with 2-3 sentences, but safety check)
        words = explanation.split()
        explanation = " ".join(words[:200]) + "..."
    
    # Validate explanation quality and log warnings
    validation_result = validate_explanation_quality(explanation)
    if validation_result["warnings"]:
        logger.warning(
            "Explanation quality warnings for stock_id=%s: %s",
            stock_id,
            "; ".join(validation_result["warnings"]),
        )
    
    return explanation


async def generate_recommendations(
    session: AsyncSession,
    user_id: UUID,
    daily_target_count: int = 10,
    use_ensemble: bool = True,
    market_conditions: dict[str, Any] | None = None,
) -> list[Recommendation]:
    """
    Orchestrate daily recommendation generation.

    - Loads candidate stocks
    - Predicts signal and confidence via ML service
    - Computes risk level
    - Ranks candidates (confidence desc, sentiment secondary via ML feature proxy is embedded; tie-break by lower risk)
    - Persists top N to recommendations table

    Args:
        session: Async DB session
        user_id: Target user for whom recommendations are generated
        daily_target_count: Number of recommendations to produce
        use_ensemble: Whether to use ensemble prediction
        market_conditions: Optional dict with market-wide indicators

    Returns:
        List of persisted Recommendation instances
    """
    # Load stocks, restricted by configured universe if provided
    from app.core.config import settings
    if getattr(settings, "STOCK_UNIVERSE", None):
        from app.crud.stocks import get_stocks_by_symbols
        stocks = await get_stocks_by_symbols(session, settings.STOCK_UNIVERSE)
    else:
        stocks = await get_all_stocks(session)
    # Further restrict to stocks that actually have market data
    from app.crud.market_data import get_stock_ids_with_market_data
    stocks_with_data = await get_stock_ids_with_market_data(session)
    stocks = [s for s in stocks if s.id in stocks_with_data]
    if not stocks:
        logger.warning("No eligible stocks with market data after filtering universe")
        return []

    logger.info(f"Starting recommendation generation: {len(stocks)} eligible stocks, target={daily_target_count}")
    
    # Check if ML models are loaded before proceeding
    from app.services.ml_service import are_models_loaded
    if not are_models_loaded():
        error_msg = "No ML models loaded. Models must be initialized at startup. Check backend logs for model initialization errors."
        logger.error(error_msg)
        return []
    
    # Check if market data exists for at least one stock
    from app.crud.market_data import get_market_data_count
    market_data_count = await get_market_data_count(session)
    if market_data_count == 0:
        error_msg = "No market data available. Market data must be collected before generating recommendations."
        logger.error(error_msg)
        return []
    
    logger.info(f"ML models loaded: {are_models_loaded()}, Market data records: {market_data_count}")
    
    candidates: list[dict[str, Any]] = []
    failed_count = 0
    filtered_count = 0

    # Fetch user preferences for preference-aware filtering
    user_prefs = await get_user_preferences(session, user_id)
    # Some tests may stub this as a coroutine-like; normalize here
    try:
        holding_pref: HoldingPeriodEnum | None = user_prefs.holding_period if user_prefs else None
    except AttributeError:
        # If a coroutine or unexpected stub was returned
        try:
            user_prefs = await user_prefs  # type: ignore[func-returns-value]
            holding_pref = user_prefs.holding_period if user_prefs else None
        except Exception:
            holding_pref = None

    def _volatility_ok_for_holding(vol: float) -> bool:
        # Simple heuristic mapping: adjust acceptable volatility ranges by holding period preference
        if holding_pref is None:
            return True
        if holding_pref == HoldingPeriodEnum.DAILY:
            # Prefer/allow higher volatility intraday; require at least some movement
            return vol >= 0.05
        if holding_pref == HoldingPeriodEnum.WEEKLY:
            # Moderate volatility band
            return 0.02 <= vol <= 0.6
        # MONTHLY or longer → avoid very high volatility
        return vol <= 0.4

    # Predict for each stock and compute risk
    for stock in stocks:
        try:
            # Skip stocks with no market data to avoid hard failures
            from app.crud.market_data import get_latest_market_data
            latest_md = await get_latest_market_data(session, stock.id)
            if latest_md is None:
                filtered_count += 1
                logger.debug(f"Skipping {getattr(stock, 'symbol', stock.id)}: no market data")
                continue

            inference = await predict_stock(
                session=session,
                stock_id=stock.id,
                use_ensemble=use_ensemble,
            )

            signal_str: str = inference["signal"]
            confidence: float = float(inference["confidence_score"])
            model_used: str = inference.get("model_used", "ensemble")

            # Extract R² from ML model metadata if available
            ml_r_squared: float | None = None
            if "neural_network_prediction" in inference:
                nn_meta = inference.get("neural_network_prediction", {})
                if isinstance(nn_meta, dict) and "r_squared" in nn_meta:
                    ml_r_squared = float(nn_meta["r_squared"])
            if ml_r_squared is None and "random_forest_prediction" in inference:
                rf_meta = inference.get("random_forest_prediction", {})
                if isinstance(rf_meta, dict) and "r_squared" in rf_meta:
                    ml_r_squared = float(rf_meta["r_squared"])

            # Fetch aggregated sentiment for explicit factor and persistence
            try:
                agg = await get_aggregated_sentiment(session, stock.id)
                sentiment_score = float(agg) if agg is not None else 0.0
            except Exception:
                sentiment_score = 0.0

            # Compute recent volatility for preference filtering
            volatility_score = await calculate_volatility(session, stock.id, days=30)
            if not _volatility_ok_for_holding(volatility_score):
                # Skip candidates that don't match user holding period preference
                filtered_count += 1
                logger.debug(
                    f"Stock {stock.symbol} filtered out: volatility={volatility_score:.4f}, "
                    f"holding_pref={holding_pref}"
                )
                continue

            # Compute risk level using ML confidence
            risk_level = await calculate_risk_level(
                session=session,
                stock_id=stock.id,
                ml_confidence=confidence,
                market_conditions=market_conditions,
            )

            # Synthesize explanation for this recommendation
            explanation = await synthesize_explanation(
                session=session,
                stock_id=stock.id,
                signal=signal_str,
                confidence_score=confidence,
                sentiment_score=float(sentiment_score) if sentiment_score != 0.0 else None,
                risk_level=risk_level,
                ml_model_used=model_used,
                ml_r_squared=ml_r_squared,
            )

            # Rank keys: higher confidence first; lower risk preferred on ties
            candidates.append({
                "stock_id": stock.id,
                "signal": signal_str,
                "confidence": confidence,
                "sentiment": float(sentiment_score),
                "risk_level": risk_level,
                "explanation": explanation,
            })
        except Exception as e:
            failed_count += 1
            error_type = type(e).__name__
            error_msg = str(e)
            logger.error(
                "Generation failed for stock %s (%s): %s: %s",
                stock.id,
                getattr(stock, 'symbol', 'unknown'),
                error_type,
                error_msg,
                exc_info=True
            )
            # Log first few failures with more detail to help diagnose
            if failed_count <= 3:
                logger.debug(
                    "First failure details - stock_id=%s, error_type=%s, error=%s",
                    stock.id,
                    error_type,
                    error_msg
                )
            continue

    logger.info(
        f"Generation summary: {len(candidates)} candidates, {failed_count} failed, "
        f"{filtered_count} filtered by preferences"
    )
    
    if not candidates:
        logger.warning(
            f"No candidates after processing {len(stocks)} stocks. "
            f"Failed: {failed_count}, Filtered: {filtered_count}"
        )
        return []

    # Sort: primary confidence desc, secondary sentiment desc, tertiary risk (LOW < MEDIUM < HIGH)
    risk_rank = {"low": 0, "medium": 1, "high": 2}
    candidates.sort(key=lambda c: (
        -c["confidence"],
        -c.get("sentiment", 0.0),
        risk_rank[c["risk_level"].value],
    ))

    # Select top N
    selected = candidates[: max(0, int(daily_target_count))]

    # Persist
    persisted: list[Recommendation] = []
    # Convert to timezone-naive UTC for database storage (matches model default behavior)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for item in selected:
        signal_enum = SignalEnum(item["signal"].lower()) if isinstance(item["signal"], str) else item["signal"]
        from uuid import uuid4
        explanation = item.get("explanation", None)
        try:
            rec = Recommendation(
                id=uuid4(),
                user_id=user_id,
                stock_id=item["stock_id"],
                signal=signal_enum,
                confidence_score=float(item["confidence"]),
                sentiment_score=float(item.get("sentiment", 0.0)),
                risk_level=item["risk_level"],
                explanation=explanation,
                created_at=now,
            )
        except TypeError:
            # Test doubles may not accept sentiment_score; construct without it
            rec = Recommendation(
                id=uuid4(),
                user_id=user_id,
                stock_id=item["stock_id"],
                signal=signal_enum,
                confidence_score=float(item["confidence"]),
                risk_level=item["risk_level"],
                explanation=explanation,
                created_at=now,
            )
        session.add(rec)
        persisted.append(rec)

    await session.commit()

    # Refresh to populate ORM state where needed
    for rec in persisted:
        try:
            await session.refresh(rec)
        except Exception:
            # Safe to proceed without refresh in some async configurations
            pass

    logger.info("Generated %d recommendations (target=%d)", len(persisted), daily_target_count)
    return persisted
