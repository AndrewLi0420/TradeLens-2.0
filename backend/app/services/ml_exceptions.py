"""Custom exceptions for ML service"""
from __future__ import annotations


class MLServiceError(Exception):
    """Base exception for ML service errors"""
    pass


class ModelNotLoadedError(MLServiceError):
    """Raised when a model is not loaded but is required for inference"""
    pass


class InvalidInputError(MLServiceError):
    """Raised when input validation fails"""
    pass


class FeatureEngineeringError(MLServiceError):
    """Raised when feature engineering fails"""
    pass


class InferenceError(MLServiceError):
    """Raised when model inference fails"""
    pass

