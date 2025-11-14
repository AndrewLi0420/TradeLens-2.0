"""ML model training and inference service"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logger import logger
from app.crud.market_data import get_market_data_history
from app.crud.sentiment_data import get_sentiment_data_history
from app.crud.stocks import get_all_stocks
from app.services.ml_exceptions import (
    FeatureEngineeringError,
    InferenceError,
    InvalidInputError,
    ModelNotLoadedError,
)


async def load_training_data(
    session: AsyncSession,
    start_date: datetime,
    end_date: datetime,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Load historical market data and sentiment data for training.
    
    Args:
        session: Database session
        start_date: Start of date range for training data
        end_date: End of date range for training data
    
    Returns:
        Tuple of (market_data_list, sentiment_data_list) where each list contains
        dict records with stock_id, timestamp, and relevant fields
    
    Raises:
        InvalidInputError: If date range is invalid
    """
    # Input validation
    if not isinstance(start_date, datetime):
        raise InvalidInputError(f"start_date must be datetime, got {type(start_date)}")
    if not isinstance(end_date, datetime):
        raise InvalidInputError(f"end_date must be datetime, got {type(end_date)}")
    if start_date >= end_date:
        raise InvalidInputError(f"start_date must be before end_date, got start_date={start_date}, end_date={end_date}")
    
    logger.info(
        "Loading training data from %s to %s",
        start_date.isoformat(),
        end_date.isoformat(),
    )
    
    # Get all stocks (respect configured universe if provided)
    from app.core.config import settings
    if getattr(settings, "STOCK_UNIVERSE", None):
        from app.crud.stocks import get_stocks_by_symbols
        stocks = await get_stocks_by_symbols(session, settings.STOCK_UNIVERSE)
    else:
        stocks = await get_all_stocks(session)
    if not stocks:
        logger.warning("No stocks found in database")
        return [], []
    
    market_data_list: list[dict[str, Any]] = []
    sentiment_data_list: list[dict[str, Any]] = []
    
    # Load data for each stock
    for stock in stocks:
        # Load market data
        market_records = await get_market_data_history(
            session=session,
            stock_id=stock.id,
            start_date=start_date,
            end_date=end_date,
        )
        for record in market_records:
            market_data_list.append({
                "stock_id": stock.id,
                "stock_symbol": stock.symbol,
                "timestamp": record.timestamp,
                "price": float(record.price),
                "volume": int(record.volume),
            })
        
        # Load sentiment data (use aggregated sentiment)
        sentiment_records = await get_sentiment_data_history(
            session=session,
            stock_id=stock.id,
            start_date=start_date,
            end_date=end_date,
            source="web_aggregate",  # Use aggregated sentiment
        )
        for record in sentiment_records:
            sentiment_data_list.append({
                "stock_id": stock.id,
                "stock_symbol": stock.symbol,
                "timestamp": record.timestamp,
                "sentiment_score": float(record.sentiment_score),
            })
    
    logger.info(
        "Loaded %s market data records and %s sentiment records",
        len(market_data_list),
        len(sentiment_data_list),
    )
    
    return market_data_list, sentiment_data_list


def prepare_feature_vectors(
    market_data: list[dict[str, Any]],
    sentiment_data: list[dict[str, Any]],
) -> tuple[np.ndarray, np.ndarray | None]:
    """
    Prepare feature vectors from market data and sentiment data.
    
    Combines market data and sentiment into feature vectors for ML training.
    Features include:
    - Price features: price, price_change, rolling_price_avg, rolling_price_std
    - Volume features: volume, volume_change, rolling_volume_avg
    - Sentiment features: sentiment_score, sentiment_trend
    
    Note: This function does NOT generate labels. Labels are generated separately
    by the `_generate_labels()` function called in `train_models()`.
    
    Args:
        market_data: List of market data dicts with stock_id, timestamp, price, volume
        sentiment_data: List of sentiment data dicts with stock_id, timestamp, sentiment_score
    
    Returns:
        Tuple of (feature_matrix, labels) where:
        - feature_matrix: numpy array of shape (n_samples, n_features)
        - labels: Always returns None (labels generated separately by _generate_labels())
    """
    if not market_data:
        logger.warning("No market data provided for feature engineering")
        return np.array([]), None
    
    # Convert to pandas DataFrames for easier manipulation
    market_df = pd.DataFrame(market_data)
    sentiment_df = pd.DataFrame(sentiment_data) if sentiment_data else pd.DataFrame()
    
    # Group by stock and timestamp to align data
    # For each stock, create time-series features
    feature_rows = []
    
    for stock_id in market_df["stock_id"].unique():
        stock_market = (
            market_df[market_df["stock_id"] == stock_id]
            .sort_values("timestamp")
            .reset_index(drop=True)
        )
        
        if len(stock_market) < 2:
            # Need at least 2 data points for price_change
            continue
        
        # Merge sentiment data if available
        stock_sentiment = pd.DataFrame()
        if not sentiment_df.empty:
            stock_sentiment = (
                sentiment_df[sentiment_df["stock_id"] == stock_id]
                .sort_values("timestamp")
                .reset_index(drop=True)
            )
        
        # Calculate features for each timestamp
        for i, row in stock_market.iterrows():
            features = {}
            
            # Price features
            features["price"] = row["price"]
            if i > 0:
                prev_price = stock_market.iloc[i - 1]["price"]
                features["price_change"] = (row["price"] - prev_price) / prev_price if prev_price > 0 else 0.0
            else:
                features["price_change"] = 0.0
            
            # Rolling price average (7-day window)
            window = stock_market.iloc[:i + 1]
            if len(window) >= 2:
                features["rolling_price_avg"] = window["price"].mean()
                features["rolling_price_std"] = window["price"].std() if len(window) > 1 else 0.0
            else:
                features["rolling_price_avg"] = row["price"]
                features["rolling_price_std"] = 0.0
            
            # Volume features
            features["volume"] = row["volume"]
            if i > 0:
                prev_volume = stock_market.iloc[i - 1]["volume"]
                features["volume_change"] = (row["volume"] - prev_volume) / prev_volume if prev_volume > 0 else 0.0
            else:
                features["volume_change"] = 0.0
            
            # Rolling volume average
            if len(window) >= 2:
                features["rolling_volume_avg"] = window["volume"].mean()
            else:
                features["rolling_volume_avg"] = row["volume"]
            
            # Sentiment features
            if not stock_sentiment.empty:
                # Find closest sentiment data point to this timestamp
                time_diffs = (stock_sentiment["timestamp"] - row["timestamp"]).abs()
                closest_idx = time_diffs.idxmin()
                if time_diffs[closest_idx] < pd.Timedelta(days=7):  # Within 7 days
                    features["sentiment_score"] = float(stock_sentiment.loc[closest_idx, "sentiment_score"])
                    # Calculate sentiment trend (compare with previous sentiment if available)
                    prev_sentiment = stock_sentiment[
                        stock_sentiment["timestamp"] < row["timestamp"]
                    ]
                    if len(prev_sentiment) > 0:
                        prev_sentiment_score = prev_sentiment.iloc[-1]["sentiment_score"]
                        features["sentiment_trend"] = float(features["sentiment_score"] - prev_sentiment_score)
                    else:
                        features["sentiment_trend"] = 0.0
                else:
                    features["sentiment_score"] = 0.0
                    features["sentiment_trend"] = 0.0
            else:
                features["sentiment_score"] = 0.0
                features["sentiment_trend"] = 0.0
            
            feature_rows.append(features)
    
    if not feature_rows:
        logger.warning("No feature vectors created from data")
        return np.array([]), None
    
    # Convert to DataFrame and normalize features
    feature_df = pd.DataFrame(feature_rows)
    
    # Normalize features to [0, 1] range (except sentiment_score which is already [-1, 1])
    feature_columns = [
        "price", "price_change", "rolling_price_avg", "rolling_price_std",
        "volume", "volume_change", "rolling_volume_avg",
        "sentiment_score", "sentiment_trend",
    ]
    
    # Ensure all columns exist
    for col in feature_columns:
        if col not in feature_df.columns:
            feature_df[col] = 0.0
    
    # Normalize numeric features (min-max scaling to [0, 1])
    normalized_df = feature_df.copy()
    for col in ["price", "price_change", "rolling_price_avg", "rolling_price_std",
                "volume", "volume_change", "rolling_volume_avg"]:
        if feature_df[col].max() != feature_df[col].min():
            normalized_df[col] = (feature_df[col] - feature_df[col].min()) / (
                feature_df[col].max() - feature_df[col].min()
            )
        else:
            normalized_df[col] = 0.5  # Default to middle value if no variation
    
    # Sentiment score is already [-1, 1], normalize to [0, 1]
    if "sentiment_score" in normalized_df.columns:
        normalized_df["sentiment_score"] = (normalized_df["sentiment_score"] + 1) / 2
    
    # Sentiment trend normalize similarly
    if "sentiment_trend" in normalized_df.columns:
        if normalized_df["sentiment_trend"].max() != normalized_df["sentiment_trend"].min():
            normalized_df["sentiment_trend"] = (
                normalized_df["sentiment_trend"] - normalized_df["sentiment_trend"].min()
            ) / (normalized_df["sentiment_trend"].max() - normalized_df["sentiment_trend"].min())
        else:
            normalized_df["sentiment_trend"] = 0.5
    
    # Convert to numpy array
    feature_matrix = normalized_df[feature_columns].values
    
    # Labels are generated separately by _generate_labels() in train_models()
    # This function only prepares feature vectors
    labels = None
    
    logger.info(
        "Created %s feature vectors with %s features each",
        len(feature_matrix),
        feature_matrix.shape[1] if len(feature_matrix) > 0 else 0,
    )
    
    return feature_matrix, labels


class NeuralNetworkModel(nn.Module):
    """Neural network model for stock recommendation (buy/sell/hold classification)."""
    
    def __init__(
        self,
        input_size: int,
        hidden_size1: int | None = None,
        hidden_size2: int | None = None,
        num_classes: int = 3,
    ):
        """
        Initialize neural network model.
        
        Args:
            input_size: Number of input features
            hidden_size1: Size of first hidden layer (defaults to ML_NEURAL_NETWORK_HIDDEN_SIZE1 from config)
            hidden_size2: Size of second hidden layer (defaults to ML_NEURAL_NETWORK_HIDDEN_SIZE2 from config)
            num_classes: Number of output classes (default: 3 for buy/sell/hold)
        """
        super(NeuralNetworkModel, self).__init__()
        if hidden_size1 is None:
            hidden_size1 = settings.ML_NEURAL_NETWORK_HIDDEN_SIZE1
        if hidden_size2 is None:
            hidden_size2 = settings.ML_NEURAL_NETWORK_HIDDEN_SIZE2
        self.fc1 = nn.Linear(input_size, hidden_size1)
        self.fc2 = nn.Linear(hidden_size1, hidden_size2)
        self.fc3 = nn.Linear(hidden_size2, num_classes)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.2)
        self.softmax = nn.Softmax(dim=1)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass through the network."""
        x = self.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.relu(self.fc2(x))
        x = self.dropout(x)
        x = self.fc3(x)
        return self.softmax(x)


def train_random_forest(
    X_train: np.ndarray,
    y_train: np.ndarray,
    n_estimators: int = 100,
    max_depth: int = 10,
    random_state: int = 42,
) -> RandomForestClassifier:
    """
    Train a Random Forest classifier model.
    
    Args:
        X_train: Training feature matrix
        y_train: Training labels
        n_estimators: Number of trees in the forest
        max_depth: Maximum depth of trees
        random_state: Random seed for reproducibility
    
    Returns:
        Trained RandomForestClassifier model
    """
    logger.info(
        "Training Random Forest with %s estimators, max_depth=%s",
        n_estimators,
        max_depth,
    )
    
    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        random_state=random_state,
    )
    
    model.fit(X_train, y_train)
    
    logger.info("Random Forest training completed")
    return model


def evaluate_model(
    model: Any,
    X_test: np.ndarray,
    y_test: np.ndarray,
    model_type: str = "random_forest",
) -> dict[str, float]:
    """
    Evaluate model performance on test data.
    
    Args:
        model: Trained model (NeuralNetworkModel or RandomForestClassifier)
        X_test: Test feature matrix
        y_test: Test labels
        model_type: Type of model ("neural_network" or "random_forest")
    
    Returns:
        Dictionary with evaluation metrics (accuracy, precision, recall, f1_score)
    """
    from sklearn.metrics import accuracy_score, precision_recall_fscore_support
    
    if model_type == "neural_network":
        model.eval()
        with torch.no_grad():
            X_tensor = torch.FloatTensor(X_test)
            predictions = model(X_tensor)
            y_pred = torch.argmax(predictions, dim=1).numpy()
    else:  # random_forest
        y_pred = model.predict(X_test)
    
    accuracy = float(accuracy_score(y_test, y_pred))
    precision, recall, f1_score, _ = precision_recall_fscore_support(
        y_test, y_pred, average="weighted", zero_division=0
    )
    
    metrics = {
        "accuracy": accuracy,
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1_score),
    }
    
    logger.info(
        "Model evaluation: accuracy=%.3f, precision=%.3f, recall=%.3f, f1=%.3f",
        accuracy,
        precision,
        recall,
        f1_score,
    )
    
    return metrics


def save_model(
    model: Any,
    model_type: str,
    version: str,
    metrics: dict[str, float] | None = None,
    base_path: str | Path | None = None,
) -> str:
    """
    Save model artifact to file.
    
    Args:
        model: Trained model to save
        model_type: Type of model ("neural_network" or "random_forest")
        version: Model version (e.g., "v1.0.0" or "2024-10-30")
        metrics: Optional model performance metrics
        base_path: Base path for model storage (default: ml-models/ in backend root)
    
    Returns:
        Path to saved model file
    """
    if base_path is None:
        # Default to ml-models/ in backend root
        # Go up 3 levels from backend/app/services/ml_service.py to backend/
        backend_root = Path(__file__).parent.parent.parent
        base_path = backend_root / "ml-models"
    else:
        base_path = Path(base_path)
    
    base_path.mkdir(parents=True, exist_ok=True)
    
    # Save model file
    if model_type == "neural_network":
        model_path = base_path / f"neural_network_{version}.pth"
        torch.save(model.state_dict(), model_path)
        # Also save model architecture metadata
        metadata_path = base_path / f"neural_network_{version}_metadata.json"
        import json
        metadata = {
            "model_type": "neural_network",
            "version": version,
            "input_size": model.fc1.in_features,
            "hidden_size1": model.fc1.out_features,
            "hidden_size2": model.fc2.out_features,
            "num_classes": model.fc3.out_features,
            "training_date": datetime.now(timezone.utc).isoformat(),
        }
        if metrics:
            metadata["metrics"] = metrics
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
    else:  # random_forest
        import joblib
        model_path = base_path / f"random_forest_{version}.pkl"
        joblib.dump(model, model_path)
        # Save metadata
        metadata_path = base_path / f"random_forest_{version}_metadata.json"
        import json
        metadata = {
            "model_type": "random_forest",
            "version": version,
            "n_estimators": model.n_estimators,
            "max_depth": model.max_depth,
            "training_date": datetime.now(timezone.utc).isoformat(),
        }
        if metrics:
            metadata["metrics"] = metrics
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
    
    logger.info("Saved model to %s", model_path)
    return str(model_path)


def load_model(
    model_type: str,
    version: str | None = None,
    base_path: str | Path | None = None,
) -> tuple[Any, dict[str, Any]]:
    """
    Load model artifact from file.
    
    Args:
        model_type: Type of model ("neural_network" or "random_forest")
        version: Model version (defaults to latest if None)
        base_path: Base path for model storage (default: ml-models/ in backend root)
    
    Returns:
        Tuple of (loaded_model, metadata_dict)
    
    Raises:
        FileNotFoundError: If model file or metadata file not found (with detailed path)
        ValueError: If no model versions found or version mismatch
        RuntimeError: If model loading fails (corrupted file, version mismatch, etc.)
    """
    if base_path is None:
        # Go up 3 levels from backend/app/services/ml_service.py to backend/
        backend_root = Path(__file__).parent.parent.parent
        base_path = backend_root / "ml-models"
    else:
        base_path = Path(base_path)
    
    # Enhanced error handling: Check if base_path exists
    if not base_path.exists():
        error_msg = (
            f"Model directory not found: {base_path}. "
            f"Please ensure ml-models directory exists in backend root. "
            f"Current working directory: {Path.cwd()}"
        )
        logger.error(error_msg)
        raise FileNotFoundError(error_msg)
    
    if version is None:
        version = get_latest_model_version(model_type, base_path)
        if version is None:
            error_msg = (
                f"No model versions found for {model_type} in {base_path}. "
                f"Available files: {list(base_path.glob('*')) if base_path.exists() else 'N/A'}. "
                f"Run training script to generate models."
            )
            logger.error(error_msg)
            raise ValueError(error_msg)
    
    if model_type == "neural_network":
        model_path = base_path / f"neural_network_{version}.pth"
        metadata_path = base_path / f"neural_network_{version}_metadata.json"
        
        # Enhanced error messages with file paths
        if not model_path.exists():
            error_msg = (
                f"Neural network model file not found: {model_path}. "
                f"Expected file: {model_path.absolute()}. "
                f"Available neural network files: {list(base_path.glob('neural_network_*.pth'))}"
            )
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)
        
        if not metadata_path.exists():
            error_msg = (
                f"Neural network metadata file not found: {metadata_path}. "
                f"Expected file: {metadata_path.absolute()}. "
                f"Model file exists but metadata is missing."
            )
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)
        
        try:
            import json
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
            
            # Validate metadata structure
            required_fields = ["input_size", "hidden_size1", "hidden_size2", "num_classes"]
            missing_fields = [f for f in required_fields if f not in metadata]
            if missing_fields:
                error_msg = (
                    f"Neural network metadata incomplete: missing fields {missing_fields}. "
                    f"Metadata file: {metadata_path}. "
                    f"Metadata contents: {metadata}"
                )
                logger.error(error_msg)
                raise ValueError(error_msg)
            
            model = NeuralNetworkModel(
                input_size=metadata["input_size"],
                hidden_size1=metadata["hidden_size1"],
                hidden_size2=metadata["hidden_size2"],
                num_classes=metadata["num_classes"],
            )
            
            try:
                model.load_state_dict(torch.load(model_path))
            except Exception as load_error:
                error_msg = (
                    f"Failed to load neural network state dict from {model_path}: {load_error}. "
                    f"This may indicate a corrupted model file or version mismatch."
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg) from load_error
            
            model.eval()
        except json.JSONDecodeError as json_error:
            error_msg = (
                f"Failed to parse neural network metadata JSON from {metadata_path}: {json_error}. "
                f"Metadata file may be corrupted."
            )
            logger.error(error_msg)
            raise RuntimeError(error_msg) from json_error
    else:  # random_forest
        import joblib
        model_path = base_path / f"random_forest_{version}.pkl"
        metadata_path = base_path / f"random_forest_{version}_metadata.json"
        
        # Enhanced error messages with file paths
        if not model_path.exists():
            error_msg = (
                f"Random Forest model file not found: {model_path}. "
                f"Expected file: {model_path.absolute()}. "
                f"Available Random Forest files: {list(base_path.glob('random_forest_*.pkl'))}"
            )
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)
        
        if not metadata_path.exists():
            error_msg = (
                f"Random Forest metadata file not found: {metadata_path}. "
                f"Expected file: {metadata_path.absolute()}. "
                f"Model file exists but metadata is missing."
            )
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)
        
        try:
            model = joblib.load(model_path)
        except Exception as load_error:
            error_msg = (
                f"Failed to load Random Forest model from {model_path}: {load_error}. "
                f"This may indicate a corrupted model file or version mismatch."
            )
            logger.error(error_msg)
            raise RuntimeError(error_msg) from load_error
        
        try:
            import json
            with open(metadata_path, "r") as f:
                metadata = json.load(f)
        except json.JSONDecodeError as json_error:
            error_msg = (
                f"Failed to parse Random Forest metadata JSON from {metadata_path}: {json_error}. "
                f"Metadata file may be corrupted."
            )
            logger.error(error_msg)
            raise RuntimeError(error_msg) from json_error
    
    logger.info("Loaded model %s version %s from %s", model_type, version, model_path)
    return model, metadata


def get_latest_model_version(model_type: str, base_path: str | Path | None = None) -> str | None:
    """
    Get the latest model version for a given model type.
    
    Args:
        model_type: Type of model ("neural_network" or "random_forest")
        base_path: Base path for model storage (default: ml-models/ in backend root)
    
    Returns:
        Latest version string or None if no versions found
    """
    if base_path is None:
        # Go up 3 levels from backend/app/services/ml_service.py to backend/
        backend_root = Path(__file__).parent.parent.parent
        base_path = backend_root / "ml-models"
    else:
        base_path = Path(base_path)
    
    if not base_path.exists():
        return None
    
    # Find all model files for this type
    pattern = f"{model_type}_*.pth" if model_type == "neural_network" else f"{model_type}_*.pkl"
    model_files = list(base_path.glob(pattern))
    
    if not model_files:
        return None
    
    # Extract versions and find latest
    versions = []
    for f in model_files:
        # Extract version from filename (e.g., "neural_network_v1.0.0.pth" -> "v1.0.0")
        parts = f.stem.split("_", 2)
        if len(parts) >= 3:
            versions.append(parts[2])
    
    if not versions:
        return None
    
    # Sort versions (simple: assume semantic versioning or timestamp)
    versions.sort(reverse=True)
    return versions[0]


def _generate_labels(
    market_data: list[dict[str, Any]],
    future_days: int | None = None,
    buy_threshold: float | None = None,
    sell_threshold: float | None = None,
) -> np.ndarray:
    """
    Generate buy/sell/hold labels based on future price movement.
    
    Args:
        market_data: List of market data dicts with stock_id, timestamp, price
        future_days: Number of days ahead to look for price movement (defaults to ML_LABEL_FUTURE_DAYS from config)
        buy_threshold: Price increase threshold for "buy" label (defaults to ML_BUY_THRESHOLD from config)
        sell_threshold: Price decrease threshold for "sell" label (defaults to ML_SELL_THRESHOLD from config)
    
    Returns:
        numpy array of labels (0=hold, 1=buy, 2=sell)
    """
    # Use config defaults if not provided
    if future_days is None:
        future_days = settings.ML_LABEL_FUTURE_DAYS
    if buy_threshold is None:
        buy_threshold = settings.ML_BUY_THRESHOLD
    if sell_threshold is None:
        sell_threshold = settings.ML_SELL_THRESHOLD
    
    # Convert to DataFrame for easier manipulation
    df = pd.DataFrame(market_data)
    df = df.sort_values(["stock_id", "timestamp"])
    
    labels = []
    for stock_id in df["stock_id"].unique():
        stock_data = df[df["stock_id"] == stock_id].reset_index(drop=True)
        
        for i in range(len(stock_data)):
            current_price = stock_data.iloc[i]["price"]
            current_time = stock_data.iloc[i]["timestamp"]
            
            # Look ahead for future price
            future_data = stock_data[
                (stock_data["timestamp"] > current_time) &
                (stock_data["timestamp"] <= current_time + pd.Timedelta(days=future_days))
            ]
            
            if len(future_data) > 0:
                future_price = future_data.iloc[-1]["price"]
                price_change = (future_price - current_price) / current_price
                
                if price_change >= buy_threshold:
                    labels.append(1)  # buy
                elif price_change <= sell_threshold:
                    labels.append(2)  # sell
                else:
                    labels.append(0)  # hold
            else:
                labels.append(0)  # hold (insufficient future data)
    
    return np.array(labels)


async def train_models(
    session: AsyncSession,
    start_date: datetime,
    end_date: datetime,
    version: str | None = None,
    train_neural_network: bool = True,
    train_random_forest_model: bool = True,
) -> dict[str, Any]:
    """
    Train ML models on historical data.
    
    Training workflow:
    1. Load historical market data and sentiment data
    2. Prepare feature vectors
    3. Generate labels (buy/sell/hold)
    4. Split into train/validation/test sets (70/15/15)
    5. Train neural network model
    6. Train Random Forest model
    7. Evaluate models
    8. Save model artifacts
    
    Args:
        session: Database session
        start_date: Start date for training data
        end_date: End date for training data
        version: Model version (defaults to timestamp-based version)
        train_neural_network: Whether to train neural network model
        train_random_forest: Whether to train Random Forest model
    
    Returns:
        Dictionary with training results (model paths, metrics, etc.)
    """
    logger.info("Starting ML model training from %s to %s", start_date.isoformat(), end_date.isoformat())
    
    # Generate version if not provided
    if version is None:
        version = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    
    try:
        # 1. Load training data
        market_data, sentiment_data = await load_training_data(session, start_date, end_date)
        
        if not market_data:
            raise ValueError("No training data available for the specified date range")
        
        # 2. Prepare feature vectors
        X, _ = prepare_feature_vectors(market_data, sentiment_data)
        
        if len(X) == 0:
            raise ValueError("No feature vectors created from training data")
        
        # 3. Generate labels
        y = _generate_labels(market_data)
        
        if len(y) != len(X):
            # Truncate to match
            min_len = min(len(X), len(y))
            X = X[:min_len]
            y = y[:min_len]
        
        logger.info("Prepared %s feature vectors with %s features", len(X), X.shape[1])
        
        # 4. Split into train/validation/test sets (70/15/15)
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y, test_size=0.3, random_state=42, stratify=y
        )
        X_val, X_test, y_val, y_test = train_test_split(
            X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
        )
        
        logger.info(
            "Data split: train=%s, validation=%s, test=%s",
            len(X_train),
            len(X_val),
            len(X_test),
        )
        
        results = {
            "version": version,
            "training_date": datetime.now(timezone.utc).isoformat(),
            "data_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            "dataset_size": len(X),
            "feature_count": X.shape[1],
        }
        
        # 5. Train neural network model
        if train_neural_network:
            logger.info("Training neural network model...")
            model_nn = NeuralNetworkModel(input_size=X.shape[1])
            criterion = nn.CrossEntropyLoss()
            optimizer = optim.Adam(model_nn.parameters(), lr=0.001)
            
            # Training loop
            epochs = settings.ML_TRAINING_EPOCHS
            batch_size = settings.ML_TRAINING_BATCH_SIZE
            model_nn.train()
            
            X_train_tensor = torch.FloatTensor(X_train)
            y_train_tensor = torch.LongTensor(y_train)
            
            for epoch in range(epochs):
                optimizer.zero_grad()
                outputs = model_nn(X_train_tensor)
                loss = criterion(outputs, y_train_tensor)
                loss.backward()
                optimizer.step()
                
                if (epoch + 1) % 10 == 0:
                    logger.info("Neural network epoch %s/%s, loss=%.4f", epoch + 1, epochs, loss.item())
            
            # Evaluate
            metrics_nn = evaluate_model(model_nn, X_test, y_test, model_type="neural_network")
            
            # Save model
            model_path_nn = save_model(model_nn, "neural_network", version, metrics=metrics_nn)
            
            results["neural_network"] = {
                "model_path": model_path_nn,
                "metrics": metrics_nn,
            }
        
        # 6. Train Random Forest model
        if train_random_forest_model:
            logger.info("Training Random Forest model...")
            # Call the training function (avoid shadowing by using explicit name)
            model_rf = train_random_forest(X_train, y_train)
            
            # Evaluate
            metrics_rf = evaluate_model(model_rf, X_test, y_test, model_type="random_forest")
            
            # Save model
            model_path_rf = save_model(model_rf, "random_forest", version, metrics=metrics_rf)
            
            results["random_forest"] = {
                "model_path": model_path_rf,
                "metrics": metrics_rf,
            }
        
        logger.info("Model training completed successfully")
        return results
        
    except Exception as e:
        logger.error("Error during model training: %s", e, exc_info=True)
        raise


# Model caching for inference (loaded at startup)
_neural_network_model: Any | None = None
_neural_network_metadata: dict[str, Any] | None = None
_random_forest_model: Any | None = None
_random_forest_metadata: dict[str, Any] | None = None


def initialize_models(base_path: str | Path | None = None) -> dict[str, Any]:
    """
    Initialize and cache ML models at startup for inference.
    
    Loads both neural network and Random Forest models, caching them in memory
    for fast inference. Should be called during FastAPI startup.
    
    Args:
        base_path: Base path for model storage (default: ml-models/ in backend root)
    
    Returns:
        Dictionary with initialization status and model versions
    """
    global _neural_network_model, _neural_network_metadata
    global _random_forest_model, _random_forest_metadata
    
    results = {
        "neural_network": {"loaded": False, "version": None, "error": None, "file_path": None, "metadata": None},
        "random_forest": {"loaded": False, "version": None, "error": None, "file_path": None, "metadata": None},
    }
    
    # Determine the actual base_path that will be used
    if base_path is None:
        # Go up 3 levels from backend/app/services/ml_service.py to backend/
        backend_root = Path(__file__).parent.parent.parent
        actual_base_path = backend_root / "ml-models"
    else:
        actual_base_path = Path(base_path)
    
    logger.info("=== initialize_models() called ===")
    logger.info("base_path parameter: %s", base_path)
    logger.info("Actual base_path being used: %s", actual_base_path)
    logger.info("base_path exists: %s", actual_base_path.exists())
    if actual_base_path.exists():
        logger.info("base_path contents: %s", list(actual_base_path.iterdir()))
    
    # Load neural network model
    try:
        # Determine model path before loading for logging
        if base_path is None:
            # Go up 3 levels from backend/app/services/ml_service.py to backend/
            backend_root = Path(__file__).parent.parent.parent
            model_base = backend_root / "ml-models"
        else:
            model_base = Path(base_path)
        
        # Get latest version to log the exact path
        latest_version = get_latest_model_version("neural_network", base_path=base_path)
        if latest_version:
            model_path = model_base / f"neural_network_{latest_version}.pth"
            logger.info("Attempting to load neural network from: %s", model_path)
            logger.info("Model path exists: %s", model_path.exists())
        else:
            logger.warning("No neural network model version found")
        
        _neural_network_model, _neural_network_metadata = load_model(
            "neural_network", version=None, base_path=base_path
        )
        results["neural_network"]["loaded"] = True
        results["neural_network"]["version"] = _neural_network_metadata.get("version")
        # Store file path and metadata in results
        if latest_version:
            results["neural_network"]["file_path"] = str(model_path.absolute())
        results["neural_network"]["metadata"] = _neural_network_metadata
        logger.info("Neural network model loaded and cached for inference")
        logger.info("  - Version: %s", results["neural_network"]["version"])
        logger.info("  - File path: %s", results["neural_network"]["file_path"])
        logger.info("  - Load time: %s", _neural_network_metadata.get("training_date", "N/A"))
    except Exception as e:
        error_msg = str(e)
        results["neural_network"]["error"] = error_msg
        # Try to include attempted file path in error
        try:
            latest_version = get_latest_model_version("neural_network", base_path=base_path)
            if latest_version:
                if base_path is None:
                    backend_root = Path(__file__).parent.parent.parent
                    model_base = backend_root / "ml-models"
                else:
                    model_base = Path(base_path)
                attempted_path = model_base / f"neural_network_{latest_version}.pth"
                results["neural_network"]["file_path"] = str(attempted_path.absolute())
        except Exception:
            pass  # Ignore errors when trying to get path for error reporting
        logger.warning("Failed to load neural network model: %s", error_msg)
    
    # Load Random Forest model
    try:
        # Determine model path before loading for logging
        if base_path is None:
            # Go up 3 levels from backend/app/services/ml_service.py to backend/
            backend_root = Path(__file__).parent.parent.parent
            model_base = backend_root / "ml-models"
        else:
            model_base = Path(base_path)
        
        # Get latest version to log the exact path
        latest_version = get_latest_model_version("random_forest", base_path=base_path)
        if latest_version:
            rf_path = model_base / f"random_forest_{latest_version}.pkl"
            logger.info("Attempting to load random forest from: %s", rf_path)
            logger.info("Random forest path exists: %s", rf_path.exists())
        else:
            logger.warning("No random forest model version found")
        
        _random_forest_model, _random_forest_metadata = load_model(
            "random_forest", version=None, base_path=base_path
        )
        results["random_forest"]["loaded"] = True
        results["random_forest"]["version"] = _random_forest_metadata.get("version")
        # Store file path and metadata in results
        if latest_version:
            results["random_forest"]["file_path"] = str(rf_path.absolute())
        results["random_forest"]["metadata"] = _random_forest_metadata
        logger.info("Random Forest model loaded and cached for inference")
        logger.info("  - Version: %s", results["random_forest"]["version"])
        logger.info("  - File path: %s", results["random_forest"]["file_path"])
        logger.info("  - Load time: %s", _random_forest_metadata.get("training_date", "N/A"))
    except Exception as e:
        error_msg = str(e)
        results["random_forest"]["error"] = error_msg
        # Try to include attempted file path in error
        try:
            latest_version = get_latest_model_version("random_forest", base_path=base_path)
            if latest_version:
                if base_path is None:
                    backend_root = Path(__file__).parent.parent.parent
                    model_base = backend_root / "ml-models"
                else:
                    model_base = Path(base_path)
                attempted_path = model_base / f"random_forest_{latest_version}.pkl"
                results["random_forest"]["file_path"] = str(attempted_path.absolute())
        except Exception:
            pass  # Ignore errors when trying to get path for error reporting
        logger.warning("Failed to load Random Forest model: %s", error_msg)
    
    # Log the exact dict that will be returned
    logger.info("=== initialize_models() returning ===")
    logger.info("Results dict: %s", results)
    logger.info("Neural network - loaded: %s, version: %s, error: %s", 
               results["neural_network"]["loaded"], 
               results["neural_network"]["version"],
               results["neural_network"]["error"])
    logger.info("Random forest - loaded: %s, version: %s, error: %s", 
               results["random_forest"]["loaded"], 
               results["random_forest"]["version"],
               results["random_forest"]["error"])
    
    # Final diagnostic: Log final state of module globals
    import sys
    logger.info("=== Final Model State After initialize_models() ===")
    logger.info("_neural_network_model is None: %s", _neural_network_model is None)
    logger.info("_neural_network_model ID: %s", id(_neural_network_model) if _neural_network_model is not None else "None")
    logger.info("_random_forest_model is None: %s", _random_forest_model is None)
    logger.info("_random_forest_model ID: %s", id(_random_forest_model) if _random_forest_model is not None else "None")
    logger.info("Module in sys.modules: %s", 'app.services.ml_service' in sys.modules)
    if 'app.services.ml_service' in sys.modules:
        ml_module = sys.modules['app.services.ml_service']
        logger.info("Module object: %s", ml_module)
        logger.info("Module __file__: %s", getattr(ml_module, '__file__', 'N/A'))
    
    return results


def _get_neural_network_model() -> Any | None:
    """
    Get neural network model from module globals or app.state (fallback).
    
    Returns:
        Neural network model or None if not available
    """
    global _neural_network_model
    
    # First check module globals
    if _neural_network_model is not None:
        return _neural_network_model
    
    # Fallback to app.state if available
    try:
        from app.main import app
        if hasattr(app, 'state') and hasattr(app.state, 'models'):
            models = app.state.models
            if models and "neural_network" in models and models["neural_network"] is not None:
                logger.debug("Retrieved neural network model from app.state")
                return models["neural_network"]
    except Exception:
        pass  # app.state not available (e.g., in tests or before startup)
    
    return None


def _get_random_forest_model() -> Any | None:
    """
    Get random forest model from module globals or app.state (fallback).
    
    Returns:
        Random forest model or None if not available
    """
    global _random_forest_model
    
    # First check module globals
    if _random_forest_model is not None:
        return _random_forest_model
    
    # Fallback to app.state if available
    try:
        from app.main import app
        if hasattr(app, 'state') and hasattr(app.state, 'models'):
            models = app.state.models
            if models and "random_forest" in models and models["random_forest"] is not None:
                logger.debug("Retrieved random forest model from app.state")
                return models["random_forest"]
    except Exception:
        pass  # app.state not available (e.g., in tests or before startup)
    
    return None


def _get_neural_network_metadata() -> dict[str, Any] | None:
    """Get neural network metadata from module globals or app.state (fallback)."""
    global _neural_network_metadata
    
    if _neural_network_metadata is not None:
        return _neural_network_metadata
    
    try:
        from app.main import app
        if hasattr(app, 'state') and hasattr(app.state, 'models'):
            models = app.state.models
            if models and "neural_network_metadata" in models:
                return models["neural_network_metadata"]
    except Exception:
        pass
    
    return None


def _get_random_forest_metadata() -> dict[str, Any] | None:
    """Get random forest metadata from module globals or app.state (fallback)."""
    global _random_forest_metadata
    
    if _random_forest_metadata is not None:
        return _random_forest_metadata
    
    try:
        from app.main import app
        if hasattr(app, 'state') and hasattr(app.state, 'models'):
            models = app.state.models
            if models and "random_forest_metadata" in models:
                return models["random_forest_metadata"]
    except Exception:
        pass
    
    return None


def are_models_loaded() -> bool:
    """
    Check if at least one ML model is loaded and available for inference.
    
    Checks both module globals and app.state (fallback).
    
    Returns:
        True if at least one model (neural network or random forest) is loaded, False otherwise
    """
    nn_model = _get_neural_network_model()
    rf_model = _get_random_forest_model()
    return nn_model is not None or rf_model is not None


def _infer_neural_network(feature_vector: np.ndarray) -> tuple[int, np.ndarray]:
    """
    Run inference with neural network model.
    
    Args:
        feature_vector: Single feature vector (shape: (9,))
    
    Returns:
        Tuple of (predicted_class, probabilities) where:
        - predicted_class: 0=hold, 1=buy, 2=sell
        - probabilities: array of probabilities for each class
    
    Raises:
        ModelNotLoadedError: If model is not loaded
        InvalidInputError: If feature vector is invalid
    """
    # Input validation
    if not isinstance(feature_vector, np.ndarray):
        raise InvalidInputError(f"feature_vector must be numpy array, got {type(feature_vector)}")
    if feature_vector.shape != (9,):
        raise InvalidInputError(f"feature_vector must have shape (9,), got {feature_vector.shape}")
    
    # Get model from module globals or app.state (fallback)
    neural_network_model = _get_neural_network_model()
    if neural_network_model is None:
        raise ModelNotLoadedError("Neural network model not loaded. Call initialize_models() at startup.")
    
    neural_network_model.eval()
    with torch.no_grad():
        X_tensor = torch.FloatTensor(feature_vector).unsqueeze(0)  # Add batch dimension
        probabilities = neural_network_model(X_tensor)
        predicted_class = torch.argmax(probabilities, dim=1).item()
        probabilities_np = probabilities.squeeze(0).numpy()
    
    return predicted_class, probabilities_np


def _infer_random_forest(feature_vector: np.ndarray) -> tuple[int, np.ndarray]:
    """
    Run inference with Random Forest model.
    
    Args:
        feature_vector: Single feature vector (shape: (9,))
    
    Returns:
        Tuple of (predicted_class, probabilities) where:
        - predicted_class: 0=hold, 1=buy, 2=sell
        - probabilities: array of probabilities for each class
    
    Raises:
        ModelNotLoadedError: If model is not loaded
        InvalidInputError: If feature vector is invalid
    """
    # Input validation
    if not isinstance(feature_vector, np.ndarray):
        raise InvalidInputError(f"feature_vector must be numpy array, got {type(feature_vector)}")
    if feature_vector.shape != (9,):
        raise InvalidInputError(f"feature_vector must have shape (9,), got {feature_vector.shape}")
    
    # Get model from module globals or app.state (fallback)
    random_forest_model = _get_random_forest_model()
    if random_forest_model is None:
        raise ModelNotLoadedError("Random Forest model not loaded. Call initialize_models() at startup.")
    
    # Reshape for scikit-learn (expects 2D array)
    feature_vector_2d = feature_vector.reshape(1, -1)
    predicted_class = random_forest_model.predict(feature_vector_2d)[0]
    probabilities = random_forest_model.predict_proba(feature_vector_2d)[0]
    
    return predicted_class, probabilities


def _calculate_confidence_score(
    model_metadata: dict[str, Any],
    prediction_probability: float,
    model_type: str,
) -> float:
    """
    Calculate confidence score from R² analysis and prediction probability.
    
    Confidence score formula:
    - Base confidence from R² (from model metadata)
    - Adjusted by prediction probability (higher probability → higher confidence)
    - Normalized to [0, 1] range
    
    Args:
        model_metadata: Model metadata containing R² and accuracy metrics
        prediction_probability: Probability of predicted class (max probability)
        model_type: Type of model ("neural_network" or "random_forest")
    
    Returns:
        Confidence score in [0, 1] range
    """
    # Get R² from metadata (if available) or use accuracy as fallback
    metrics = model_metadata.get("metrics", {})
    r_squared = metrics.get("r_squared", None)
    accuracy = metrics.get("accuracy", 0.5)
    
    # Use R² if available, otherwise use accuracy
    base_confidence = r_squared if r_squared is not None else accuracy
    
    # Adjust by prediction probability
    # Higher probability → higher confidence multiplier (sigmoid-like scaling)
    probability_multiplier = 0.5 + (prediction_probability * 0.5)  # Scale to [0.5, 1.0]
    
    # Combine base confidence with probability adjustment
    confidence = base_confidence * probability_multiplier
    
    # Ensure in [0, 1] range
    confidence = max(0.0, min(1.0, confidence))
    
    return float(confidence)


def _class_to_signal(predicted_class: int) -> str:
    """
    Convert predicted class to signal string.
    
    Args:
        predicted_class: 0=hold, 1=buy, 2=sell
    
    Returns:
        Signal string: "hold", "buy", or "sell"
    """
    signal_map = {0: "hold", 1: "buy", 2: "sell"}
    return signal_map.get(predicted_class, "hold")


async def predict_stock(
    session: AsyncSession,
    stock_id: UUID,
    market_data: dict[str, Any] | None = None,
    sentiment_score: float | None = None,
    use_ensemble: bool = True,
) -> dict[str, Any]:
    """
    Generate stock prediction using ML models.
    
    Workflow:
    1. Load current market data and sentiment score (if not provided)
    2. Prepare feature vector using same feature engineering as training
    3. Run inference with neural network and/or Random Forest models
    4. Combine model outputs (ensemble or separate)
    5. Calculate confidence score from R² and prediction probability
    6. Return prediction signal and confidence score
    
    Args:
        session: Database session
        stock_id: UUID of the stock
        market_data: Optional dict with price and volume (if None, loads from DB)
        sentiment_score: Optional sentiment score (if None, loads from DB)
        use_ensemble: Whether to use ensemble prediction (default: True)
    
    Returns:
        Dictionary with:
        - signal: "buy", "sell", or "hold"
        - confidence_score: float in [0, 1]
        - model_used: "neural_network", "random_forest", or "ensemble"
        - neural_network_prediction: Optional dict with NN prediction details
        - random_forest_prediction: Optional dict with RF prediction details
    """
    import time
    
    from app.crud.market_data import get_latest_market_data
    from app.crud.sentiment_data import get_aggregated_sentiment
    
    start_time = time.time()
    
    try:
        # Input validation
        if not isinstance(stock_id, UUID):
            raise InvalidInputError(f"stock_id must be UUID, got {type(stock_id)}")
        
        # 1. Load market data and sentiment (if not provided)
        if market_data is None:
            market_record = await get_latest_market_data(session, stock_id)
            if market_record is None:
                raise InvalidInputError(f"No market data found for stock {stock_id}")
            market_data = {
                "price": float(market_record.price),
                "volume": int(market_record.volume),
                "timestamp": market_record.timestamp,
            }
        else:
            # Validate provided market_data
            if not isinstance(market_data, dict):
                raise InvalidInputError(f"market_data must be dict, got {type(market_data)}")
            if "price" not in market_data or "volume" not in market_data:
                raise InvalidInputError("market_data must contain 'price' and 'volume' keys")
            if not isinstance(market_data["price"], (int, float)) or market_data["price"] <= 0:
                raise InvalidInputError(f"market_data['price'] must be positive number, got {market_data.get('price')}")
            if not isinstance(market_data["volume"], (int, float)) or market_data["volume"] < 0:
                raise InvalidInputError(f"market_data['volume'] must be non-negative number, got {market_data.get('volume')}")
        
        if sentiment_score is None:
            sentiment_score = await get_aggregated_sentiment(session, stock_id)
            if sentiment_score is None:
                logger.warning("No sentiment data found for stock %s, using neutral sentiment", stock_id)
                sentiment_score = 0.0
        else:
            # Validate sentiment_score
            if not isinstance(sentiment_score, (int, float)):
                raise InvalidInputError(f"sentiment_score must be number, got {type(sentiment_score)}")
            if not -1.0 <= sentiment_score <= 1.0:
                raise InvalidInputError(f"sentiment_score must be in [-1, 1], got {sentiment_score}")
        
        # 2. Prepare feature vector
        # Load minimal history needed for rolling features (optimized from 180 to 14 days)
        end_date = datetime.now(timezone.utc)
        # Use configurable window - reduced from 180 days for performance
        start_date = end_date - timedelta(days=settings.ML_INFERENCE_HISTORY_DAYS)
        
        from app.crud.market_data import get_market_data_history
        from app.crud.sentiment_data import get_sentiment_data_history
        
        market_history = await get_market_data_history(
            session=session,
            stock_id=stock_id,
            start_date=start_date,
            end_date=end_date,
        )
        sentiment_history = await get_sentiment_data_history(
            session=session,
            stock_id=stock_id,
            start_date=start_date,
            end_date=end_date,
            source="web_aggregate",
        )
        
        # Convert to dict format expected by prepare_feature_vectors
        market_data_list = [
            {
                "stock_id": stock_id,
                "timestamp": record.timestamp,
                "price": float(record.price),
                "volume": int(record.volume),
            }
            for record in market_history
        ]
        sentiment_data_list = [
            {
                "stock_id": stock_id,
                "timestamp": record.timestamp,
                "sentiment_score": float(record.sentiment_score),
            }
            for record in sentiment_history
        ]
        
        # If no history, use current data point with minimal features
        if not market_data_list:
            market_data_list = [{
                "stock_id": stock_id,
                "timestamp": datetime.now(timezone.utc),
                "price": market_data["price"],
                "volume": market_data["volume"],
            }]
        if not sentiment_data_list:
            sentiment_data_list = [{
                "stock_id": stock_id,
                "timestamp": datetime.now(timezone.utc),
                "sentiment_score": sentiment_score,
            }]
        
        # Prepare feature vector (use last feature vector from history)
        feature_matrix, _ = prepare_feature_vectors(market_data_list, sentiment_data_list)
        
        if len(feature_matrix) == 0:
            raise FeatureEngineeringError("Failed to create feature vector for inference")
        
        # Use the most recent feature vector (last row)
        feature_vector = feature_matrix[-1]
        
        # Validate feature vector dimensions
        expected_features = 9
        if len(feature_vector) != expected_features:
            raise FeatureEngineeringError(
                f"Feature vector dimension mismatch: expected {expected_features}, got {len(feature_vector)}"
            )
        
        # 3. Run inference
        nn_prediction = None
        rf_prediction = None
        nn_available = _get_neural_network_model() is not None
        rf_available = _get_random_forest_model() is not None
        
        if not nn_available and not rf_available:
            raise ModelNotLoadedError("No models loaded. Call initialize_models() at startup.")
        
        # Neural network inference
        if nn_available:
            try:
                nn_class, nn_probs = _infer_neural_network(feature_vector)
                nn_signal = _class_to_signal(nn_class)
                nn_metadata = _get_neural_network_metadata() or {}
                nn_confidence = _calculate_confidence_score(
                    nn_metadata,
                    float(np.max(nn_probs)),
                    "neural_network",
                )
                nn_prediction = {
                    "signal": nn_signal,
                    "confidence_score": nn_confidence,
                    "class": nn_class,
                    "probabilities": nn_probs.tolist(),
                }
            except Exception as e:
                logger.error("Neural network inference failed: %s", e, exc_info=True)
                if not rf_available:
                    raise InferenceError(f"Neural network inference failed and Random Forest unavailable: {e}") from e
                nn_available = False  # Mark as unavailable for ensemble
        
        # Random Forest inference
        if rf_available:
            try:
                rf_class, rf_probs = _infer_random_forest(feature_vector)
                rf_signal = _class_to_signal(rf_class)
                rf_metadata = _get_random_forest_metadata() or {}
                rf_confidence = _calculate_confidence_score(
                    rf_metadata,
                    float(np.max(rf_probs)),
                    "random_forest",
                )
                rf_prediction = {
                    "signal": rf_signal,
                    "confidence_score": rf_confidence,
                    "class": rf_class,
                    "probabilities": rf_probs.tolist(),
                }
            except Exception as e:
                logger.error("Random Forest inference failed: %s", e, exc_info=True)
                if not nn_available:
                    raise InferenceError(f"Random Forest inference failed and Neural Network unavailable: {e}") from e
                rf_available = False  # Mark as unavailable for ensemble
        
        # 4. Combine model outputs (ensemble or use single model)
        if use_ensemble and nn_available and rf_available:
            # Ensemble: weighted voting based on confidence scores and probabilities
            # This avoids arbitrary tie-breaking in simple majority vote
            
            # Get prediction probabilities for each class
            nn_probs = np.array(nn_prediction["probabilities"])
            rf_probs = np.array(rf_prediction["probabilities"])
            
            # Weight each model by its confidence score and max probability
            nn_weight = nn_prediction["confidence_score"] * float(np.max(nn_probs))
            rf_weight = rf_prediction["confidence_score"] * float(np.max(rf_probs))
            total_weight = nn_weight + rf_weight
            
            if total_weight > 0:
                # Weighted average of probabilities
                combined_probs = (nn_probs * nn_weight + rf_probs * rf_weight) / total_weight
                # Get class with highest combined probability
                ensemble_class = int(np.argmax(combined_probs))
                ensemble_signal = _class_to_signal(ensemble_class)
                
                # Weighted average confidence
                ensemble_confidence = (
                    nn_prediction["confidence_score"] * nn_weight +
                    rf_prediction["confidence_score"] * rf_weight
                ) / total_weight
            else:
                # Fallback: use simple average if weights are zero
                combined_probs = (nn_probs + rf_probs) / 2
                ensemble_class = int(np.argmax(combined_probs))
                ensemble_signal = _class_to_signal(ensemble_class)
                ensemble_confidence = (
                    nn_prediction["confidence_score"] + rf_prediction["confidence_score"]
                ) / 2
            
            model_used = "ensemble"
            final_signal = ensemble_signal
            final_confidence = ensemble_confidence
        elif nn_available:
            # Use neural network only
            final_signal = nn_prediction["signal"]
            final_confidence = nn_prediction["confidence_score"]
            model_used = "neural_network"
        elif rf_available:
            # Use Random Forest only
            final_signal = rf_prediction["signal"]
            final_confidence = rf_prediction["confidence_score"]
            model_used = "random_forest"
        else:
            raise ModelNotLoadedError("No models available for inference")
        
        # Calculate latency
        latency_ms = (time.time() - start_time) * 1000
        
        # 5. Log inference request
        logger.info(
            "Inference completed: stock_id=%s, signal=%s, confidence=%.3f, model=%s, latency=%.2fms",
            stock_id,
            final_signal,
            final_confidence,
            model_used,
            latency_ms,
        )
        
        # Prepare response
        result = {
            "signal": final_signal,
            "confidence_score": float(final_confidence),
            "model_used": model_used,
            "latency_ms": float(latency_ms),
        }
        
        if nn_prediction:
            result["neural_network_prediction"] = nn_prediction
        if rf_prediction:
            result["random_forest_prediction"] = rf_prediction
        
        # Log model performance metrics
        if _neural_network_metadata:
            metrics = _neural_network_metadata.get("metrics", {})
            logger.info(
                "Neural network metrics: accuracy=%.3f, R²=%s",
                metrics.get("accuracy", "N/A"),
                metrics.get("r_squared", "N/A"),
            )
        if _random_forest_metadata:
            metrics = _random_forest_metadata.get("metrics", {})
            logger.info(
                "Random Forest metrics: accuracy=%.3f, R²=%s",
                metrics.get("accuracy", "N/A"),
                metrics.get("r_squared", "N/A"),
            )
        
        return result
        
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        logger.error(
            "Inference failed: stock_id=%s, error=%s, latency=%.2fms",
            stock_id,
            str(e),
            latency_ms,
            exc_info=True,
        )
        raise

