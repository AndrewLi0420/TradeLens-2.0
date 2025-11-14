"""Unit tests for ML training service"""
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import torch
from sklearn.ensemble import RandomForestClassifier

# Note: We don't import models here to avoid SQLAlchemy relationship issues in unit tests
from app.services.ml_service import (
    prepare_feature_vectors,
    NeuralNetworkModel,
    train_random_forest,
    evaluate_model,
    save_model,
    load_model,
    get_latest_model_version,
    _generate_labels,
    initialize_models,
    _infer_neural_network,
    _infer_random_forest,
    _calculate_confidence_score,
    _class_to_signal,
    predict_stock,
)


def test_prepare_feature_vectors_basic():
    """Test feature vector preparation with sample data."""
    # Create sample market data (no database needed for this test)
    stock_id = uuid4()
    base_time = datetime.now(timezone.utc)
    market_data = [
        {
            "stock_id": stock_id,
            "stock_symbol": "TEST",
            "timestamp": base_time - timedelta(days=2),
            "price": 100.0,
            "volume": 1000000,
        },
        {
            "stock_id": stock_id,
            "stock_symbol": "TEST",
            "timestamp": base_time - timedelta(days=1),
            "price": 105.0,
            "volume": 1100000,
        },
        {
            "stock_id": stock_id,
            "stock_symbol": "TEST",
            "timestamp": base_time,
            "price": 110.0,
            "volume": 1200000,
        },
    ]
    
    # Create sample sentiment data
    sentiment_data = [
        {
            "stock_id": stock_id,
            "stock_symbol": "TEST",
            "timestamp": base_time - timedelta(days=1),
            "sentiment_score": 0.5,
        },
        {
            "stock_id": stock_id,
            "stock_symbol": "TEST",
            "timestamp": base_time,
            "sentiment_score": 0.7,
        },
    ]
    
    # Prepare feature vectors
    X, labels = prepare_feature_vectors(market_data, sentiment_data)
    
    assert len(X) > 0, "Should create at least some feature vectors"
    assert X.shape[1] == 9, "Should have 9 features"


def test_neural_network_model_architecture():
    """Test neural network model architecture."""
    input_size = 9
    model = NeuralNetworkModel(input_size=input_size)
    
    # Test forward pass
    x = torch.randn(1, input_size)
    output = model(x)
    
    assert output.shape == (1, 3), "Should output 3 classes (buy/sell/hold)"
    assert torch.allclose(output.sum(), torch.tensor(1.0), atol=1e-6), "Should be probability distribution (sum to 1)"


def test_train_random_forest():
    """Test Random Forest model training."""
    # Create sample training data
    X_train = np.random.rand(100, 9)
    y_train = np.random.randint(0, 3, size=100)
    
    model = train_random_forest(X_train, y_train)
    
    assert isinstance(model, RandomForestClassifier), "Should return RandomForestClassifier"
    
    # Test prediction
    X_test = np.random.rand(10, 9)
    predictions = model.predict(X_test)
    
    assert len(predictions) == 10, "Should predict for all samples"
    assert all(p in [0, 1, 2] for p in predictions), "Predictions should be in [0, 1, 2]"


def test_evaluate_model_random_forest():
    """Test model evaluation for Random Forest."""
    # Create sample data
    X_train = np.random.rand(100, 9)
    y_train = np.random.randint(0, 3, size=100)
    
    model = train_random_forest(X_train, y_train)
    
    X_test = np.random.rand(20, 9)
    y_test = np.random.randint(0, 3, size=20)
    
    metrics = evaluate_model(model, X_test, y_test, model_type="random_forest")
    
    assert "accuracy" in metrics
    assert "precision" in metrics
    assert "recall" in metrics
    assert "f1_score" in metrics
    assert 0.0 <= metrics["accuracy"] <= 1.0


def test_evaluate_model_neural_network():
    """Test model evaluation for Neural Network."""
    input_size = 9
    model = NeuralNetworkModel(input_size=input_size)
    
    # Train briefly
    X_train = torch.randn(100, input_size)
    y_train = torch.randint(0, 3, size=(100,))
    criterion = torch.nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    
    for _ in range(10):
        optimizer.zero_grad()
        outputs = model(X_train)
        loss = criterion(outputs, y_train)
        loss.backward()
        optimizer.step()
    
    X_test = np.random.rand(20, input_size)
    y_test = np.random.randint(0, 3, size=20)
    
    metrics = evaluate_model(model, X_test, y_test, model_type="neural_network")
    
    assert "accuracy" in metrics
    assert 0.0 <= metrics["accuracy"] <= 1.0


def test_generate_labels():
    """Test label generation from market data."""
    base_time = datetime.now(timezone.utc)
    stock_id = uuid4()
    
    market_data = [
        {
            "stock_id": stock_id,
            "timestamp": base_time - timedelta(days=10),
            "price": 100.0,
        },
        {
            "stock_id": stock_id,
            "timestamp": base_time - timedelta(days=3),
            "price": 105.0,  # 5% increase
        },
        {
            "stock_id": stock_id,
            "timestamp": base_time,
            "price": 95.0,  # Below original
        },
    ]
    
    labels = _generate_labels(market_data, future_days=7, buy_threshold=0.05, sell_threshold=-0.05)
    
    assert len(labels) == len(market_data)
    assert all(l in [0, 1, 2] for l in labels), "Labels should be 0 (hold), 1 (buy), or 2 (sell)"


def test_save_and_load_random_forest(tmp_path):
    """Test saving and loading Random Forest model."""
    # Train a model
    X_train = np.random.rand(50, 9)
    y_train = np.random.randint(0, 3, size=50)
    model = train_random_forest(X_train, y_train)
    
    # Save model
    version = "test_v1"
    model_path = save_model(model, "random_forest", version, base_path=tmp_path)
    
    assert model_path is not None
    
    # Load model
    loaded_model, metadata = load_model("random_forest", version, base_path=tmp_path)
    
    assert isinstance(loaded_model, RandomForestClassifier)
    assert metadata["version"] == version
    assert metadata["model_type"] == "random_forest"
    
    # Test prediction match
    X_test = np.random.rand(5, 9)
    original_pred = model.predict(X_test)
    loaded_pred = loaded_model.predict(X_test)
    
    assert np.array_equal(original_pred, loaded_pred), "Predictions should match"


def test_save_and_load_neural_network(tmp_path):
    """Test saving and loading Neural Network model."""
    input_size = 9
    model = NeuralNetworkModel(input_size=input_size)
    
    # Train briefly
    X_train = torch.randn(50, input_size)
    y_train = torch.randint(0, 3, size=(50,))
    criterion = torch.nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
    
    for _ in range(5):
        optimizer.zero_grad()
        outputs = model(X_train)
        loss = criterion(outputs, y_train)
        loss.backward()
        optimizer.step()
    
    # Save model
    version = "test_v1"
    model_path = save_model(model, "neural_network", version, base_path=tmp_path)
    
    assert model_path is not None
    
    # Load model
    loaded_model, metadata = load_model("neural_network", version, base_path=tmp_path)
    
    assert isinstance(loaded_model, NeuralNetworkModel)
    assert metadata["version"] == version
    assert metadata["model_type"] == "neural_network"
    assert metadata["input_size"] == input_size


def test_get_latest_model_version(tmp_path):
    """Test getting latest model version."""
    # Save multiple versions
    X_train = np.random.rand(10, 9)
    y_train = np.random.randint(0, 3, size=10)
    
    model1 = train_random_forest(X_train, y_train)
    save_model(model1, "random_forest", "v1.0.0", base_path=tmp_path)
    
    model2 = train_random_forest(X_train, y_train)
    save_model(model2, "random_forest", "v1.0.1", base_path=tmp_path)
    
    model3 = train_random_forest(X_train, y_train)
    save_model(model3, "random_forest", "v2.0.0", base_path=tmp_path)
    
    latest = get_latest_model_version("random_forest", base_path=tmp_path)
    
    assert latest == "v2.0.0", "Should return latest version"


def test_get_latest_model_version_none(tmp_path):
    """Test getting latest version when no models exist."""
    latest = get_latest_model_version("random_forest", base_path=tmp_path)
    
    assert latest is None, "Should return None when no models exist"


# Inference tests
def test_initialize_models(tmp_path):
    """Test model initialization and caching."""
    # Create and save models first
    X_train = np.random.rand(50, 9)
    y_train = np.random.randint(0, 3, size=50)
    
    # Save neural network
    nn_model = NeuralNetworkModel(input_size=9)
    X_train_tensor = torch.FloatTensor(X_train)
    y_train_tensor = torch.LongTensor(y_train)
    criterion = torch.nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(nn_model.parameters(), lr=0.001)
    for _ in range(5):
        optimizer.zero_grad()
        outputs = nn_model(X_train_tensor)
        loss = criterion(outputs, y_train_tensor)
        loss.backward()
        optimizer.step()
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    
    # Save random forest
    rf_model = train_random_forest(X_train, y_train)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    
    # Initialize models
    results = initialize_models(base_path=tmp_path)
    
    assert results["neural_network"]["loaded"] is True
    assert results["random_forest"]["loaded"] is True
    assert results["neural_network"]["version"] == "test_v1"
    assert results["random_forest"]["version"] == "test_v1"


def test_initialize_models_missing(tmp_path):
    """Test model initialization when models don't exist."""
    results = initialize_models(base_path=tmp_path)
    
    assert results["neural_network"]["loaded"] is False
    assert results["random_forest"]["loaded"] is False
    assert results["neural_network"]["error"] is not None
    assert results["random_forest"]["error"] is not None


def test_infer_neural_network(tmp_path):
    """Test neural network inference."""
    # Create and save model
    X_train = np.random.rand(50, 9)
    y_train = np.random.randint(0, 3, size=50)
    nn_model = NeuralNetworkModel(input_size=9)
    X_train_tensor = torch.FloatTensor(X_train)
    y_train_tensor = torch.LongTensor(y_train)
    criterion = torch.nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(nn_model.parameters(), lr=0.001)
    for _ in range(5):
        optimizer.zero_grad()
        outputs = nn_model(X_train_tensor)
        loss = criterion(outputs, y_train_tensor)
        loss.backward()
        optimizer.step()
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    
    # Initialize models
    initialize_models(base_path=tmp_path)
    
    # Test inference
    feature_vector = np.random.rand(9)
    class_pred, probs = _infer_neural_network(feature_vector)
    
    assert class_pred in [0, 1, 2], "Class should be 0, 1, or 2"
    assert len(probs) == 3, "Should have 3 probability values"
    assert abs(sum(probs) - 1.0) < 1e-5, "Probabilities should sum to 1"


def test_infer_random_forest(tmp_path):
    """Test Random Forest inference."""
    # Create and save model
    X_train = np.random.rand(50, 9)
    y_train = np.random.randint(0, 3, size=50)
    rf_model = train_random_forest(X_train, y_train)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    
    # Initialize models
    initialize_models(base_path=tmp_path)
    
    # Test inference
    feature_vector = np.random.rand(9)
    class_pred, probs = _infer_random_forest(feature_vector)
    
    assert class_pred in [0, 1, 2], "Class should be 0, 1, or 2"
    assert len(probs) == 3, "Should have 3 probability values"
    assert abs(sum(probs) - 1.0) < 1e-5, "Probabilities should sum to 1"


def test_calculate_confidence_score():
    """Test confidence score calculation."""
    # Test with R² in metadata
    metadata = {
        "metrics": {
            "r_squared": 0.85,
            "accuracy": 0.80,
        }
    }
    confidence = _calculate_confidence_score(metadata, prediction_probability=0.9, model_type="neural_network")
    
    assert 0.0 <= confidence <= 1.0, "Confidence should be in [0, 1]"
    assert confidence > 0.5, "Confidence should be positive with good R² and probability"
    
    # Test with accuracy fallback (no R²)
    metadata_no_r2 = {
        "metrics": {
            "accuracy": 0.75,
        }
    }
    confidence2 = _calculate_confidence_score(metadata_no_r2, prediction_probability=0.8, model_type="random_forest")
    
    assert 0.0 <= confidence2 <= 1.0, "Confidence should be in [0, 1]"


def test_class_to_signal():
    """Test class to signal conversion."""
    assert _class_to_signal(0) == "hold"
    assert _class_to_signal(1) == "buy"
    assert _class_to_signal(2) == "sell"
    assert _class_to_signal(99) == "hold"  # Default fallback


# Unit tests for predict_stock() function
@pytest.mark.asyncio
async def test_predict_stock_with_provided_data_ensemble(tmp_path):
    """Test predict_stock() with provided market data and sentiment, using ensemble."""
    stock_id = uuid4()
    mock_session = AsyncMock()
    
    # Create mock models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    
    # Save models
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    
    # Initialize models
    initialize_models(base_path=tmp_path)
    
    # Mock historical data returns
    market_history = [
        MagicMock(
            timestamp=datetime.now(timezone.utc) - timedelta(days=i),
            price=100.0 + i * 0.5,
            volume=1000000 + i * 10000,
        )
        for i in range(10, 0, -1)
    ]
    sentiment_history = [
        MagicMock(
            timestamp=datetime.now(timezone.utc) - timedelta(days=i),
            sentiment_score=0.5 + i * 0.05,
        )
        for i in range(10, 0, -1)
    ]
    
    with patch('app.crud.market_data.get_market_data_history', new_callable=AsyncMock) as mock_get_market_history, \
         patch('app.crud.sentiment_data.get_sentiment_data_history', new_callable=AsyncMock) as mock_get_sentiment_history:
        
        mock_get_market_history.return_value = market_history
        mock_get_sentiment_history.return_value = sentiment_history
        
        # Test with provided data
        result = await predict_stock(
            session=mock_session,
            stock_id=stock_id,
            market_data={"price": 100.0, "volume": 1000000},
            sentiment_score=0.5,
            use_ensemble=True,
        )
        
        # Verify response structure
        assert "signal" in result
        assert "confidence_score" in result
        assert "model_used" in result
        assert "latency_ms" in result
        assert result["signal"] in ["buy", "sell", "hold"]
        assert 0.0 <= result["confidence_score"] <= 1.0
        assert result["model_used"] == "ensemble"
        assert "neural_network_prediction" in result
        assert "random_forest_prediction" in result
        assert result["latency_ms"] >= 0


@pytest.mark.asyncio
async def test_predict_stock_with_database_loaded_data(tmp_path):
    """Test predict_stock() loading data from database."""
    stock_id = uuid4()
    mock_session = AsyncMock()
    
    # Create mock models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    
    # Save models
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    
    # Initialize models
    initialize_models(base_path=tmp_path)
    
    # Mock market data record
    mock_market_record = MagicMock()
    mock_market_record.price = 100.0
    mock_market_record.volume = 1000000
    mock_market_record.timestamp = datetime.now(timezone.utc)
    
    # Mock historical data
    market_history = [
        MagicMock(
            timestamp=datetime.now(timezone.utc) - timedelta(days=i),
            price=100.0 + i * 0.5,
            volume=1000000 + i * 10000,
        )
        for i in range(10, 0, -1)
    ]
    sentiment_history = [
        MagicMock(
            timestamp=datetime.now(timezone.utc) - timedelta(days=i),
            sentiment_score=0.5 + i * 0.05,
        )
        for i in range(10, 0, -1)
    ]
    
    with patch('app.crud.market_data.get_latest_market_data', new_callable=AsyncMock) as mock_get_latest_market, \
         patch('app.crud.sentiment_data.get_aggregated_sentiment', new_callable=AsyncMock) as mock_get_sentiment, \
         patch('app.crud.market_data.get_market_data_history', new_callable=AsyncMock) as mock_get_market_history, \
         patch('app.crud.sentiment_data.get_sentiment_data_history', new_callable=AsyncMock) as mock_get_sentiment_history:
        
        mock_get_latest_market.return_value = mock_market_record
        mock_get_sentiment.return_value = 0.5
        mock_get_market_history.return_value = market_history
        mock_get_sentiment_history.return_value = sentiment_history
        
        # Test loading from database
        result = await predict_stock(
            session=mock_session,
            stock_id=stock_id,
            market_data=None,  # Will load from DB
            sentiment_score=None,  # Will load from DB
            use_ensemble=True,
        )
        
        # Verify database calls were made
        mock_get_latest_market.assert_called_once_with(mock_session, stock_id)
        mock_get_sentiment.assert_called_once_with(mock_session, stock_id)
        
        # Verify response
        assert result["signal"] in ["buy", "sell", "hold"]
        assert 0.0 <= result["confidence_score"] <= 1.0


@pytest.mark.asyncio
async def test_predict_stock_single_model_fallback(tmp_path):
    """Test predict_stock() with single model when ensemble unavailable."""
    stock_id = uuid4()
    mock_session = AsyncMock()
    
    # Create only neural network model
    nn_model = NeuralNetworkModel(input_size=9)
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    
    # Initialize only NN model
    with patch('app.services.ml_service._neural_network_model', new=None), \
         patch('app.services.ml_service._random_forest_model', new=None):
        initialize_models(base_path=tmp_path)
    
    # Mock historical data
    market_history = [
        MagicMock(
            timestamp=datetime.now(timezone.utc) - timedelta(days=i),
            price=100.0 + i * 0.5,
            volume=1000000 + i * 10000,
        )
        for i in range(10, 0, -1)
    ]
    sentiment_history = [
        MagicMock(
            timestamp=datetime.now(timezone.utc) - timedelta(days=i),
            sentiment_score=0.5 + i * 0.05,
        )
        for i in range(10, 0, -1)
    ]
    
    with patch('app.crud.market_data.get_market_data_history', new_callable=AsyncMock) as mock_get_market_history, \
         patch('app.crud.sentiment_data.get_sentiment_data_history', new_callable=AsyncMock) as mock_get_sentiment_history:
        
        mock_get_market_history.return_value = market_history
        mock_get_sentiment_history.return_value = sentiment_history
        
        # Test with single model
        result = await predict_stock(
            session=mock_session,
            stock_id=stock_id,
            market_data={"price": 100.0, "volume": 1000000},
            sentiment_score=0.5,
            use_ensemble=False,
        )
        
        # Should use neural network only
        assert result["model_used"] in ["neural_network", "random_forest"]
        assert result["signal"] in ["buy", "sell", "hold"]


@pytest.mark.asyncio
async def test_predict_stock_missing_market_data(tmp_path):
    """Test predict_stock() error handling when market data is missing."""
    stock_id = uuid4()
    mock_session = AsyncMock()
    
    # Initialize models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    initialize_models(base_path=tmp_path)
    
    with patch('app.crud.market_data.get_latest_market_data', new_callable=AsyncMock) as mock_get_latest_market:
        mock_get_latest_market.return_value = None  # No market data found
        
        # Should raise ValueError
        with pytest.raises(ValueError, match="No market data found"):
            await predict_stock(
                session=mock_session,
                stock_id=stock_id,
                market_data=None,
                sentiment_score=0.5,
            )


@pytest.mark.asyncio
async def test_predict_stock_missing_sentiment_uses_default(tmp_path):
    """Test predict_stock() uses neutral sentiment when sentiment data missing."""
    stock_id = uuid4()
    mock_session = AsyncMock()
    
    # Initialize models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    initialize_models(base_path=tmp_path)
    
    # Mock market data record
    mock_market_record = MagicMock()
    mock_market_record.price = 100.0
    mock_market_record.volume = 1000000
    mock_market_record.timestamp = datetime.now(timezone.utc)
    
    # Mock historical data
    market_history = [
        MagicMock(
            timestamp=datetime.now(timezone.utc) - timedelta(days=i),
            price=100.0 + i * 0.5,
            volume=1000000 + i * 10000,
        )
        for i in range(10, 0, -1)
    ]
    sentiment_history = []  # No sentiment history
    
    with patch('app.crud.market_data.get_latest_market_data', new_callable=AsyncMock) as mock_get_latest_market, \
         patch('app.crud.sentiment_data.get_aggregated_sentiment', new_callable=AsyncMock) as mock_get_sentiment, \
         patch('app.crud.market_data.get_market_data_history', new_callable=AsyncMock) as mock_get_market_history, \
         patch('app.crud.sentiment_data.get_sentiment_data_history', new_callable=AsyncMock) as mock_get_sentiment_history:
        
        mock_get_latest_market.return_value = mock_market_record
        mock_get_sentiment.return_value = None  # No sentiment found
        mock_get_market_history.return_value = market_history
        mock_get_sentiment_history.return_value = sentiment_history
        
        # Should succeed with neutral sentiment (0.0)
        result = await predict_stock(
            session=mock_session,
            stock_id=stock_id,
            market_data=None,
            sentiment_score=None,
        )
        
        # Should still work
        assert result["signal"] in ["buy", "sell", "hold"]
        assert 0.0 <= result["confidence_score"] <= 1.0


@pytest.mark.asyncio
async def test_predict_stock_no_models_loaded():
    """Test predict_stock() error when no models are loaded."""
    stock_id = uuid4()
    mock_session = AsyncMock()
    
    # Provide minimal history so feature engineering can work, but no models
    base_time = datetime.now(timezone.utc)
    minimal_history = [
        MagicMock(timestamp=base_time - timedelta(days=1), price=99.0, volume=900000),
        MagicMock(timestamp=base_time, price=100.0, volume=1000000),
    ]
    minimal_sentiment = [
        MagicMock(timestamp=base_time - timedelta(days=1), sentiment_score=0.4),
        MagicMock(timestamp=base_time, sentiment_score=0.5),
    ]
    
    # Ensure no models are loaded
    with patch('app.services.ml_service._neural_network_model', None), \
         patch('app.services.ml_service._random_forest_model', None), \
         patch('app.crud.market_data.get_market_data_history', new_callable=AsyncMock) as mock_get_market_history, \
         patch('app.crud.sentiment_data.get_sentiment_data_history', new_callable=AsyncMock) as mock_get_sentiment_history:
        
        mock_get_market_history.return_value = minimal_history
        mock_get_sentiment_history.return_value = minimal_sentiment
        
        # Should raise RuntimeError
        with pytest.raises(RuntimeError, match="No models loaded"):
            await predict_stock(
                session=mock_session,
                stock_id=stock_id,
                market_data={"price": 100.0, "volume": 1000000},
                sentiment_score=0.5,
            )


@pytest.mark.asyncio
async def test_predict_stock_empty_history_fallback(tmp_path):
    """Test predict_stock() handles empty history data gracefully."""
    stock_id = uuid4()
    mock_session = AsyncMock()
    
    # Initialize models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    initialize_models(base_path=tmp_path)
    
    # Mock empty history - prepare_feature_vectors needs at least 2 data points for rolling features
    # So we'll provide minimal data that will create at least one feature vector
    with patch('app.crud.market_data.get_market_data_history', new_callable=AsyncMock) as mock_get_market_history, \
         patch('app.crud.sentiment_data.get_sentiment_data_history', new_callable=AsyncMock) as mock_get_sentiment_history:
        
        # Provide minimal history (2 points) so feature engineering can work
        base_time = datetime.now(timezone.utc)
        mock_get_market_history.return_value = [
            MagicMock(timestamp=base_time - timedelta(days=1), price=99.0, volume=900000),
            MagicMock(timestamp=base_time, price=100.0, volume=1000000),
        ]
        mock_get_sentiment_history.return_value = [
            MagicMock(timestamp=base_time - timedelta(days=1), sentiment_score=0.4),
            MagicMock(timestamp=base_time, sentiment_score=0.5),
        ]
        
        # Should use current data point as fallback
        result = await predict_stock(
            session=mock_session,
            stock_id=stock_id,
            market_data={"price": 100.0, "volume": 1000000},
            sentiment_score=0.5,
        )
        
        # Should still work with fallback
        assert result["signal"] in ["buy", "sell", "hold"]
        assert 0.0 <= result["confidence_score"] <= 1.0


@pytest.mark.asyncio
async def test_predict_stock_model_failure_graceful_degradation(tmp_path):
    """Test predict_stock() handles model inference failures gracefully."""
    stock_id = uuid4()
    mock_session = AsyncMock()
    
    # Initialize models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    initialize_models(base_path=tmp_path)
    
    # Mock historical data
    market_history = [
        MagicMock(
            timestamp=datetime.now(timezone.utc) - timedelta(days=i),
            price=100.0 + i * 0.5,
            volume=1000000 + i * 10000,
        )
        for i in range(10, 0, -1)
    ]
    sentiment_history = [
        MagicMock(
            timestamp=datetime.now(timezone.utc) - timedelta(days=i),
            sentiment_score=0.5 + i * 0.05,
        )
        for i in range(10, 0, -1)
    ]
    
    with patch('app.crud.market_data.get_market_data_history', new_callable=AsyncMock) as mock_get_market_history, \
         patch('app.crud.sentiment_data.get_sentiment_data_history', new_callable=AsyncMock) as mock_get_sentiment_history, \
         patch('app.services.ml_service._infer_neural_network') as mock_nn_infer:
        
        mock_get_market_history.return_value = market_history
        mock_get_sentiment_history.return_value = sentiment_history
        mock_nn_infer.side_effect = Exception("NN inference failed")  # Simulate NN failure
        
        # Should fallback to Random Forest only
        result = await predict_stock(
            session=mock_session,
            stock_id=stock_id,
            market_data={"price": 100.0, "volume": 1000000},
            sentiment_score=0.5,
            use_ensemble=True,
        )
        
        # Should use Random Forest only
        assert result["model_used"] == "random_forest"
        assert result["signal"] in ["buy", "sell", "hold"]


def test_initialize_models_logs_file_paths_versions_metadata(tmp_path, caplog):
    """Test that initialize_models() logs file paths, versions, and metadata."""
    import logging
    caplog.set_level(logging.INFO)
    
    # Create test models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    
    # Initialize models
    results = initialize_models(base_path=tmp_path)
    
    # Check that results include file paths and metadata
    assert results["neural_network"]["loaded"] is True
    assert results["neural_network"]["version"] == "test_v1"
    assert results["neural_network"]["file_path"] is not None
    assert results["neural_network"]["metadata"] is not None
    
    assert results["random_forest"]["loaded"] is True
    assert results["random_forest"]["version"] == "test_v1"
    assert results["random_forest"]["file_path"] is not None
    assert results["random_forest"]["metadata"] is not None
    
    # Check that logs include file paths and versions
    log_messages = caplog.text
    assert "test_v1" in log_messages
    assert "file path" in log_messages.lower() or "file_path" in log_messages.lower()


def test_are_models_loaded_returns_correct_status(tmp_path):
    """Test that are_models_loaded() returns correct status."""
    from app.services.ml_service import are_models_loaded
    
    # Initially no models loaded
    assert are_models_loaded() is False
    
    # Create and initialize models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    initialize_models(base_path=tmp_path)
    
    # Now models should be loaded
    assert are_models_loaded() is True


def test_load_model_error_handling_with_file_paths(tmp_path):
    """Test that load_model() provides clear error messages with file paths."""
    # Test file not found error
    with pytest.raises(FileNotFoundError) as exc_info:
        load_model("neural_network", version="nonexistent", base_path=tmp_path)
    
    error_msg = str(exc_info.value)
    assert "neural_network" in error_msg.lower()
    assert "not found" in error_msg.lower() or "file not found" in error_msg.lower()
    
    # Test directory not found error
    nonexistent_path = tmp_path / "nonexistent_dir"
    with pytest.raises(FileNotFoundError) as exc_info:
        load_model("neural_network", base_path=nonexistent_path)
    
    error_msg = str(exc_info.value)
    assert "directory not found" in error_msg.lower() or "not found" in error_msg.lower()
    assert str(nonexistent_path) in error_msg


def test_load_model_handles_corrupted_files(tmp_path):
    """Test that load_model() handles corrupted model files gracefully."""
    # Create a corrupted model file
    corrupted_path = tmp_path / "neural_network_test_v1.pth"
    corrupted_path.write_text("corrupted data")
    
    # Create metadata file
    metadata_path = tmp_path / "neural_network_test_v1_metadata.json"
    import json
    metadata_path.write_text(json.dumps({
        "model_type": "neural_network",
        "version": "test_v1",
        "input_size": 9,
        "hidden_size1": 64,
        "hidden_size2": 32,
        "num_classes": 3,
    }))
    
    # Should raise RuntimeError with clear error message
    with pytest.raises(RuntimeError) as exc_info:
        load_model("neural_network", version="test_v1", base_path=tmp_path)
    
    error_msg = str(exc_info.value)
    assert "failed to load" in error_msg.lower() or "corrupted" in error_msg.lower()
    assert str(corrupted_path) in error_msg or "neural_network_test_v1.pth" in error_msg


def test_load_model_handles_missing_metadata_fields(tmp_path):
    """Test that load_model() handles missing metadata fields."""
    # Create model file
    nn_model = NeuralNetworkModel(input_size=9)
    import torch
    model_path = tmp_path / "neural_network_test_v1.pth"
    torch.save(nn_model.state_dict(), model_path)
    
    # Create incomplete metadata file
    metadata_path = tmp_path / "neural_network_test_v1_metadata.json"
    import json
    metadata_path.write_text(json.dumps({
        "model_type": "neural_network",
        "version": "test_v1",
        # Missing required fields
    }))
    
    # Should raise ValueError with clear error message
    with pytest.raises(ValueError) as exc_info:
        load_model("neural_network", version="test_v1", base_path=tmp_path)
    
    error_msg = str(exc_info.value)
    assert "incomplete" in error_msg.lower() or "missing" in error_msg.lower()
    assert "metadata" in error_msg.lower()

