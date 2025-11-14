"""E2E tests for health check endpoints"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import numpy as np
import torch
from sklearn.ensemble import RandomForestClassifier

from app.main import get_application
from app.services.ml_service import NeuralNetworkModel, train_random_forest, save_model, initialize_models


@pytest.fixture
def client():
    """Create test client."""
    app = get_application()
    return TestClient(app)


def test_health_check_endpoint(client):
    """Test basic health check endpoint."""
    response = client.get("/api/v1/health/")
    assert response.status_code == 200
    data = response.json()
    assert "database_is_online" in data


@pytest.mark.parametrize("models_loaded,expected_status", [
    (True, 200),
    (False, 503),
])
def test_ml_models_health_check_status_codes(client, tmp_path, models_loaded, expected_status):
    """Test ML models health check endpoint returns correct status codes."""
    if models_loaded:
        # Create and initialize models
        nn_model = NeuralNetworkModel(input_size=9)
        rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
        save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
        save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
        initialize_models(base_path=tmp_path)
    else:
        # Ensure no models are loaded
        with patch('app.services.ml_service._get_neural_network_model', return_value=None), \
             patch('app.services.ml_service._get_random_forest_model', return_value=None):
            pass
    
    response = client.get("/api/v1/health/ml-models")
    assert response.status_code == expected_status


def test_ml_models_health_check_response_format(client, tmp_path):
    """Test ML models health check endpoint returns correct response format."""
    # Create and initialize models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    initialize_models(base_path=tmp_path)
    
    response = client.get("/api/v1/health/ml-models")
    assert response.status_code == 200
    
    data = response.json()
    assert "neural_network" in data
    assert "random_forest" in data
    
    # Check neural network status structure
    nn_status = data["neural_network"]
    assert "loaded" in nn_status
    assert "version" in nn_status
    assert "error" in nn_status
    assert "accessible" in nn_status
    
    # Check random forest status structure
    rf_status = data["random_forest"]
    assert "loaded" in rf_status
    assert "version" in rf_status
    assert "error" in rf_status
    assert "accessible" in rf_status


def test_ml_models_health_check_with_models_loaded(client, tmp_path):
    """Test ML models health check when models are loaded."""
    # Create and initialize models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    initialize_models(base_path=tmp_path)
    
    response = client.get("/api/v1/health/ml-models")
    assert response.status_code == 200
    
    data = response.json()
    assert data["neural_network"]["loaded"] is True
    assert data["neural_network"]["version"] == "test_v1"
    assert data["neural_network"]["accessible"] is True
    
    assert data["random_forest"]["loaded"] is True
    assert data["random_forest"]["version"] == "test_v1"
    assert data["random_forest"]["accessible"] is True


def test_ml_models_health_check_without_models(client):
    """Test ML models health check when no models are loaded."""
    # Mock models as not loaded
    with patch('app.services.ml_service._get_neural_network_model', return_value=None), \
         patch('app.services.ml_service._get_random_forest_model', return_value=None), \
         patch('app.services.ml_service._get_neural_network_metadata', return_value=None), \
         patch('app.services.ml_service._get_random_forest_metadata', return_value=None):
        
        response = client.get("/api/v1/health/ml-models")
        assert response.status_code == 503
        
        data = response.json()
        assert data["neural_network"]["loaded"] is False
        assert data["random_forest"]["loaded"] is False


def test_ml_models_health_check_accessibility_test(client, tmp_path):
    """Test that health check performs accessibility test (test prediction)."""
    # Create and initialize models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    initialize_models(base_path=tmp_path)
    
    response = client.get("/api/v1/health/ml-models")
    assert response.status_code == 200
    
    data = response.json()
    # Both models should be accessible (test prediction should succeed)
    assert data["neural_network"]["accessible"] is True
    assert data["random_forest"]["accessible"] is True


def test_ml_models_health_check_with_inaccessible_model(client, tmp_path):
    """Test health check when model is loaded but not accessible for inference."""
    # Create and initialize models
    nn_model = NeuralNetworkModel(input_size=9)
    rf_model = train_random_forest(np.random.rand(50, 9), np.random.randint(0, 3, size=50))
    save_model(nn_model, "neural_network", "test_v1", base_path=tmp_path)
    save_model(rf_model, "random_forest", "test_v1", base_path=tmp_path)
    initialize_models(base_path=tmp_path)
    
    # Mock model to raise error during inference
    with patch('app.services.ml_service._get_neural_network_model') as mock_nn:
        mock_model = MagicMock()
        mock_model.eval.side_effect = Exception("Model inference failed")
        mock_nn.return_value = mock_model
        
        response = client.get("/api/v1/health/ml-models")
        assert response.status_code == 200  # Still 200, but accessible=False
        
        data = response.json()
        assert data["neural_network"]["loaded"] is True
        assert data["neural_network"]["accessible"] is False
        assert "error" in data["neural_network"] and data["neural_network"]["error"] is not None

