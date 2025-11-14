# Code Review: `backend/app/services/ml_service.py`

**Review Date:** 2025-01-XX  
**Reviewer:** AI Code Reviewer  
**File:** `backend/app/services/ml_service.py` (1,243 lines)

## Executive Summary

The ML service is well-structured with good separation of concerns, comprehensive error handling, and solid test coverage. However, there are several performance, design, and maintainability issues that should be addressed.

**Overall Assessment:** ⚠️ **Good with improvements needed**

**Priority Issues:**
- 🔴 **High:** Performance bottleneck in `predict_stock()` - loads 180 days of history for every inference
- 🟡 **Medium:** Missing input validation and type safety
- 🟡 **Medium:** Inefficient feature engineering for single predictions
- 🟡 **Medium:** Potential memory leaks with global model caching
- 🟢 **Low:** Code duplication and minor design improvements

---

## 1. Performance Issues

### 1.1 🔴 **CRITICAL: Inefficient History Loading in `predict_stock()`**

**Location:** Lines 1022-1084

**Issue:** The function loads 180 days of historical data for every single prediction request, even when only the most recent feature vector is needed.

```1022:1084:backend/app/services/ml_service.py
        end_date = datetime.now(timezone.utc)
        # Use a wider window to ensure enough daily points even with holidays/missing dates
        start_date = end_date - timedelta(days=180)  # Use ~6 months of history
        
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
```

**Impact:**
- Database queries fetch large datasets unnecessarily
- High latency for inference requests
- Increased memory usage
- May violate the <1 minute latency requirement under load

**Recommendation:**
1. Cache historical feature vectors per stock (with TTL)
2. Load only the minimum required history (e.g., 7-14 days for rolling features)
3. Consider a separate optimized function for single-stock inference that doesn't need full history

**Suggested Fix:**
```python
# Option 1: Cache feature vectors
from functools import lru_cache
from datetime import timedelta

# Cache recent feature vectors per stock (TTL: 1 hour)
@lru_cache(maxsize=1000)
def _get_cached_feature_vector(stock_id: str, cache_key: str):
    # Implementation with caching

# Option 2: Load minimal history
start_date = end_date - timedelta(days=14)  # Only 2 weeks needed for rolling features
```

### 1.2 🟡 **Inefficient Feature Engineering for Single Predictions**

**Location:** Lines 107-280 (`prepare_feature_vectors`)

**Issue:** The function processes all historical data points even when only the latest feature vector is needed for inference.

**Recommendation:**
- Create a separate `prepare_single_feature_vector()` function optimized for inference
- Reuse pre-computed rolling statistics where possible

### 1.3 🟡 **Global Model Caching Without Memory Management**

**Location:** Lines 782-785, 788-835

**Issue:** Models are cached globally without any memory limits or cleanup mechanism.

```782:785:backend/app/services/ml_service.py
# Model caching for inference (loaded at startup)
_neural_network_model: Any | None = None
_neural_network_metadata: dict[str, Any] | None = None
_random_forest_model: Any | None = None
_random_forest_metadata: dict[str, Any] | None = None
```

**Recommendation:**
- Add memory monitoring
- Implement model versioning with automatic cleanup of old models
- Consider using a proper caching library (e.g., `cachetools`)

---

## 2. Code Quality & Design Issues

### 2.1 🟡 **Missing Input Validation**

**Location:** Multiple functions

**Issues:**
- `predict_stock()` doesn't validate `stock_id` format
- `prepare_feature_vectors()` doesn't validate data structure
- No validation for date ranges in `load_training_data()`

**Recommendation:**
```python
def predict_stock(
    session: AsyncSession,
    stock_id: UUID,  # Already typed, but add runtime validation
    ...
) -> dict[str, Any]:
    # Add validation
    if not isinstance(stock_id, UUID):
        raise TypeError(f"stock_id must be UUID, got {type(stock_id)}")
    
    # Validate date ranges
    if start_date >= end_date:
        raise ValueError("start_date must be before end_date")
```

### 2.2 🟡 **Inconsistent Error Handling**

**Location:** Lines 1099-1144

**Issue:** Error handling in `predict_stock()` marks models as unavailable but doesn't provide clear error context.

```1118:1122:backend/app/services/ml_service.py
            except Exception as e:
                logger.error("Neural network inference failed: %s", e, exc_info=True)
                if not rf_available:
                    raise  # If RF also unavailable, fail
                nn_available = False  # Mark as unavailable for ensemble
```

**Recommendation:**
- Create custom exception classes for better error handling
- Provide more context in error messages

### 2.3 🟡 **Code Duplication in Model Loading**

**Location:** Lines 809-833

**Issue:** Similar code patterns for loading neural network and Random Forest models.

**Recommendation:**
- Extract common loading logic into a helper function

### 2.4 🟡 **Magic Numbers and Hardcoded Values**

**Location:** Throughout the file

**Issues:**
- `future_days=7` in `_generate_labels()` (line 582)
- `buy_threshold=0.05`, `sell_threshold=-0.05` (lines 583-584)
- `epochs=50`, `batch_size=32` in training (lines 728-729)
- `hidden_size1=128`, `hidden_size2=64` in NeuralNetworkModel (line 286)
- `180 days` history window (line 1024)

**Recommendation:**
- Move to configuration constants or settings
- Make them configurable via environment variables or config file

```python
# In config.py or constants
class MLConfig:
    LABEL_FUTURE_DAYS = 7
    BUY_THRESHOLD = 0.05
    SELL_THRESHOLD = -0.05
    TRAINING_EPOCHS = 50
    TRAINING_BATCH_SIZE = 32
    INFERENCE_HISTORY_DAYS = 14  # Reduced from 180
```

### 2.5 🟢 **Import Organization**

**Location:** Lines 990-993, 1020, 1026-1027

**Issue:** Imports are scattered throughout functions instead of at the top.

```990:993:backend/app/services/ml_service.py
    import time
    
    from app.crud.market_data import get_latest_market_data
    from app.crud.sentiment_data import get_aggregated_sentiment
```

**Recommendation:**
- Move all imports to the top of the file
- Use proper import grouping (stdlib, third-party, local)

---

## 3. Logic & Algorithm Issues

### 3.1 🟡 **Ensemble Voting Logic Issue**

**Location:** Lines 1147-1155

**Issue:** With only 2 models, majority vote can result in ties. Current implementation uses `max()` which may not handle ties correctly.

```1147:1155:backend/app/services/ml_service.py
        if use_ensemble and nn_available and rf_available:
            # Ensemble: majority vote for signal, weighted average for confidence
            signals = [nn_prediction["signal"], rf_prediction["signal"]]
            signal_counts = {"buy": 0, "sell": 0, "hold": 0}
            for sig in signals:
                signal_counts[sig] += 1
            
            # Majority vote
            ensemble_signal = max(signal_counts, key=signal_counts.get)
```

**Problem:** If both models disagree (e.g., one says "buy", one says "sell"), `max()` will return one arbitrarily, not necessarily the best choice.

**Recommendation:**
- Use weighted voting based on confidence scores
- Or use probability-weighted voting instead of simple majority

```python
# Better ensemble logic
def _ensemble_vote(nn_pred: dict, rf_pred: dict) -> str:
    """Weighted ensemble voting based on confidence."""
    nn_weight = nn_pred["confidence_score"]
    rf_weight = rf_pred["confidence_score"]
    
    # Weight by confidence, not just count
    if nn_weight > rf_weight:
        return nn_pred["signal"]
    elif rf_weight > nn_weight:
        return rf_pred["signal"]
    else:
        # Tie: use probability-weighted average
        nn_probs = np.array(nn_pred["probabilities"])
        rf_probs = np.array(rf_pred["probabilities"])
        combined_probs = (nn_probs * nn_weight + rf_probs * rf_weight) / (nn_weight + rf_weight)
        return _class_to_signal(np.argmax(combined_probs))
```

### 3.2 🟡 **Label Generation Edge Cases**

**Location:** Lines 580-629 (`_generate_labels`)

**Issue:** The function doesn't handle edge cases well:
- What if there's no future data within `future_days`? (Currently defaults to "hold")
- What if price is 0 or negative?
- What if there are gaps in the data?

**Recommendation:**
- Add validation for edge cases
- Consider using forward-fill or interpolation for missing data
- Add logging for edge cases

### 3.3 🟡 **Feature Normalization Edge Cases**

**Location:** Lines 243-265

**Issue:** Division by zero protection exists, but the default value (0.5) may not be appropriate for all features.

```247:252:backend/app/services/ml_service.py
        if feature_df[col].max() != feature_df[col].min():
            normalized_df[col] = (feature_df[col] - feature_df[col].min()) / (
                feature_df[col].max() - feature_df[col].min()
            )
        else:
            normalized_df[col] = 0.5  # Default to middle value if no variation
```

**Recommendation:**
- Use feature-specific defaults (e.g., 0.0 for price_change if no variation)
- Consider using z-score normalization as an alternative

---

## 4. Security & Reliability Issues

### 4.1 🟡 **Path Traversal Risk in Model Loading**

**Location:** Lines 404-473 (`save_model`), 476-534 (`load_model`)

**Issue:** While `base_path` is validated, there's no explicit check for path traversal in version strings.

**Recommendation:**
```python
def save_model(..., version: str, ...):
    # Sanitize version string
    import re
    if not re.match(r'^[a-zA-Z0-9._-]+$', version):
        raise ValueError(f"Invalid version format: {version}")
```

### 4.2 🟡 **No Rate Limiting or Resource Limits**

**Issue:** The service doesn't limit:
- Number of concurrent training jobs
- Memory usage during training
- Inference request rate

**Recommendation:**
- Add rate limiting for inference endpoints
- Add resource monitoring for training jobs
- Consider using a job queue for training

---

## 5. Testing & Documentation

### 5.1 ✅ **Good Test Coverage**

The test file (`test_ml_service.py`) covers:
- Feature engineering
- Model training and evaluation
- Model saving/loading
- Inference with various scenarios
- Error handling

**Note:** Consider adding:
- Performance/load tests
- Integration tests with real database
- Tests for edge cases in feature engineering

### 5.2 🟡 **Documentation Gaps**

**Issues:**
- Missing examples in docstrings
- No architecture diagram or flow documentation
- Missing explanation of feature engineering choices

**Recommendation:**
- Add usage examples to key functions
- Document the feature engineering rationale
- Add performance characteristics (expected latency, throughput)

---

## 6. Specific Code Issues

### 6.1 🟡 **Type Hints Inconsistency**

**Location:** Line 353

**Issue:** Using `Any` for model type instead of Union or Protocol.

```352:356:backend/app/services/ml_service.py
def evaluate_model(
    model: Any,
    X_test: np.ndarray,
    y_test: np.ndarray,
    model_type: str = "random_forest",
) -> dict[str, float]:
```

**Recommendation:**
```python
from typing import Protocol, Union

class MLModel(Protocol):
    def predict(self, X: np.ndarray) -> np.ndarray: ...
    # Or for PyTorch models
    def forward(self, x: torch.Tensor) -> torch.Tensor: ...

def evaluate_model(
    model: Union[NeuralNetworkModel, RandomForestClassifier],
    ...
) -> dict[str, float]:
```

### 6.2 🟡 **Inconsistent Return Types**

**Location:** Line 110 (`prepare_feature_vectors`)

**Issue:** Function always returns `None` for labels but signature suggests it might return labels.

```107:131:backend/app/services/ml_service.py
def prepare_feature_vectors(
    market_data: list[dict[str, Any]],
    sentiment_data: list[dict[str, Any]],
) -> tuple[np.ndarray, np.ndarray | None]:
    """
    ...
    Returns:
        Tuple of (feature_matrix, labels) where:
        - feature_matrix: numpy array of shape (n_samples, n_features)
        - labels: Always returns None (labels generated separately by _generate_labels())
    """
```

**Recommendation:**
- Either remove the labels from return type, or
- Make it optional and document clearly

### 6.3 🟢 **Minor: Unused Variable**

**Location:** Line 698 (`train_models`)

**Issue:** `X_val` and `y_val` are created but never used.

```694:700:backend/app/services/ml_service.py
        # 4. Split into train/validation/test sets (70/15/15)
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y, test_size=0.3, random_state=42, stratify=y
        )
        X_val, X_test, y_val, y_test = train_test_split(
            X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
        )
```

**Recommendation:**
- Use validation set for early stopping or hyperparameter tuning
- Or remove if not needed

---

## 7. Recommendations Summary

### High Priority (Fix Soon)
1. ✅ **Optimize `predict_stock()` history loading** - Cache or reduce history window
2. ✅ **Fix ensemble voting logic** - Use weighted voting instead of simple majority
3. ✅ **Add input validation** - Validate all inputs to public functions

### Medium Priority (Next Sprint)
4. ✅ **Extract magic numbers to config** - Make hyperparameters configurable
5. ✅ **Improve error handling** - Use custom exceptions
6. ✅ **Add memory management** - Monitor and limit model cache size
7. ✅ **Create optimized inference path** - Separate function for single predictions

### Low Priority (Technical Debt)
8. ✅ **Reorganize imports** - Move all imports to top
9. ✅ **Reduce code duplication** - Extract common model loading logic
10. ✅ **Improve type hints** - Use Protocols or Unions instead of Any

---

## 8. Positive Aspects

✅ **Well-structured code** with clear separation of concerns  
✅ **Comprehensive error handling** in critical paths  
✅ **Good test coverage** for most scenarios  
✅ **Clear docstrings** explaining function purposes  
✅ **Model caching** for fast inference  
✅ **Ensemble support** for improved predictions  
✅ **Proper logging** throughout the service  

---

## Conclusion

The ML service is production-ready but would benefit from performance optimizations and some design improvements. The most critical issue is the inefficient history loading in `predict_stock()`, which should be addressed to meet latency requirements.

**Recommended Action:** Prioritize performance optimizations (items 1-3) before the next release.

