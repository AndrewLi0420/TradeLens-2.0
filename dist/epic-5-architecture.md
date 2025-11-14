# Epic 5: Data Collection & Model Training Infrastructure - Architecture Document

**Author:** Winston (Architect)  
**Date:** 2025-01-11  
**Epic:** Epic 5 - Data Collection & Model Training Infrastructure Improvements  
**Project:** OpenAlpha (TradeLens)

---

## Executive Summary

Epic 5 addresses critical infrastructure gaps in data collection and model training to ensure reliable, unlimited data access and automated model retraining. The architecture introduces a unified data collection service with yfinance as primary source and Alpha Vantage as fallback, implements proper async execution patterns, establishes automated training pipelines, and adds comprehensive error handling. This architecture enables scaling to 500+ stocks without API rate limits while maintaining model accuracy through automated retraining.

**Key Architectural Principles:**
- **Resilience First:** Fallback mechanisms and circuit breakers ensure data collection reliability
- **Async-First Design:** All blocking operations run in thread pools to prevent event loop blocking
- **Separation of Concerns:** Data collection, training, and inference are isolated services
- **Observability:** Comprehensive logging and metrics for monitoring pipeline health

---

## Decision Summary

| Category | Decision | Version | Affects Stories | Rationale |
| -------- | -------- | ------- | --------------- | --------- |
| Data Source Primary | yfinance | Latest stable | 5.1, 5.2, 5.5, 5.6 | Unlimited calls, no API key, reliable for historical data |
| Data Source Fallback | Alpha Vantage | Existing | 5.1, 5.5 | Backup when yfinance fails, already integrated |
| Async Execution | asyncio.to_thread() | Python 3.9+ | 5.2 | Standard library, no extra dependencies |
| Thread Pool | DefaultExecutor | Built-in | 5.2 | Sufficient for yfinance blocking calls |
| Training Scheduler | APScheduler | 3.x (existing) | 5.3 | Already in use, consistent with existing jobs |
| Model Lifecycle | Versioned Artifacts | Timestamp-based | 5.3, 5.4 | Simple versioning, rollback capability |
| Error Handling | Circuit Breaker Pattern | Custom implementation | 5.5 | Prevents cascading failures |
| Retry Strategy | Exponential Backoff | Custom | 5.5 | Standard resilience pattern |
| Performance Target | 500 stocks in <10 min | Measured | 5.6 | Ensures hourly job completion |

---

## Service Architecture

### Unified Data Collection Service

**Location:** `backend/app/services/data_collection.py`

**Architecture Pattern:** Strategy Pattern with Fallback Chain

```
collect_market_data(symbol)
    ↓
Primary: collect_from_yfinance(symbol) [async via thread pool]
    ↓ (on failure)
Fallback: collect_from_alpha_vantage(symbol) [existing async]
    ↓ (on failure)
Return None (logged, retried next cycle)
```

**Component Responsibilities:**

1. **Primary Collector (yfinance)**
   - Wraps `yf.Ticker().history()` in `asyncio.to_thread()`
   - Normalizes symbols (BRK.B → BRK-B)
   - Extracts latest price/volume from DataFrame
   - Returns standardized dict: `{price, volume, timestamp}`

2. **Fallback Collector (Alpha Vantage)**
   - Existing implementation in `collect_market_data_from_alpha_vantage()`
   - Rate-limited (5 calls/minute)
   - Used only when yfinance fails

3. **Unified Interface**
   - Single `collect_market_data()` function
   - Configuration option: `PREFERRED_DATA_SOURCE` (yfinance/alphavantage)
   - Logging indicates which source was used

**Async Execution Pattern:**
```python
async def collect_from_yfinance(symbol: str) -> dict | None:
    """Collect data using yfinance in thread pool"""
    loop = asyncio.get_event_loop()
    try:
        # Run blocking yfinance call in thread pool
        df = await loop.run_in_executor(
            None,  # Use default executor
            _fetch_yfinance_data,  # Blocking function
            symbol
        )
        return _parse_yfinance_data(df)
    except Exception as e:
        logger.error(f"yfinance failed for {symbol}: {e}")
        return None
```

---

### Automated Model Training Pipeline

**Location:** `backend/app/tasks/ml_training.py` (new)

**Integration with APScheduler:**
- New scheduled job in `backend/app/lifetime.py`
- Runs daily at 2:00 AM UTC (after data collection completes)
- Uses existing `train_models()` from `ml_service.py`

**Training Workflow:**
```
APScheduler Trigger (2 AM UTC)
    ↓
Check data availability (minimum threshold)
    ↓
Load historical data from database
    ↓
Train models (neural network + random forest)
    ↓
Save models with version (timestamp)
    ↓
Reload models in memory (for inference)
    ↓
Log metrics and completion status
```

**Model Lifecycle Management:**
- **Versioning:** `neural_network_YYYYMMDD_HHMMSS.pth`
- **Storage:** `ml-models/` directory (existing)
- **Rollback:** Keep last N versions (configurable, default: 3)
- **Reload:** Call `initialize_models()` after training completes

**Resource Isolation:**
- Training runs in separate async task (non-blocking)
- Uses existing database connection pool
- Memory: Models loaded temporarily during training, then saved to disk

---

### Admin Training API Endpoint

**Location:** `backend/app/api/v1/endpoints/admin.py` (new file)

**Architecture Pattern:** Async Task Queue Pattern

```
POST /api/v1/admin/ml/train
    ↓
Validate admin authentication
    ↓
Create background task (FastAPI BackgroundTasks or APScheduler)
    ↓
Return immediately with task_id
    ↓
Training runs asynchronously
    ↓
Status endpoint: GET /api/v1/admin/ml/train/status/{task_id}
```

**Authentication:**
- Requires admin role (extend existing auth system)
- Use FastAPI dependency: `Depends(get_admin_user)`

**Task Management:**
- Store task status in memory dict or Redis (optional)
- Task states: `pending`, `running`, `completed`, `failed`
- Return task_id for status checking

---

## Error Handling & Resilience Architecture

### Circuit Breaker Pattern

**Purpose:** Prevent cascading failures when data source consistently fails

**Implementation:**
```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=300):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.timeout = timeout  # seconds
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half-open
```

**States:**
- **Closed:** Normal operation, requests pass through
- **Open:** Too many failures, reject requests immediately
- **Half-Open:** Test if source recovered, allow limited requests

**Usage:**
- One circuit breaker per data source (yfinance, Alpha Vantage)
- Track failures per source
- When circuit opens, immediately try fallback source

### Retry Strategy

**Pattern:** Exponential Backoff with Jitter

**Configuration:**
- Max retries: 3 attempts
- Base delay: 1 second
- Max delay: 60 seconds
- Jitter: ±20% random variation

**Implementation:**
```python
async def retry_with_backoff(func, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await func()
        except RetryableError as e:
            if attempt == max_retries - 1:
                raise
            delay = min(2 ** attempt + random.uniform(-0.2, 0.2), 60)
            await asyncio.sleep(delay)
```

**Retryable Errors:**
- Network timeouts
- 5xx HTTP errors
- Temporary API unavailability

**Non-Retryable Errors:**
- 4xx HTTP errors (client errors)
- Invalid symbol format
- Authentication failures

---

## Performance Optimization Architecture

### Concurrent Collection Strategy

**Current Limitation:** Alpha Vantage rate limit (5 calls/minute) constrains batch size

**With yfinance:** No rate limits, larger batches possible

**Optimized Batch Processing:**
```python
# Before (Alpha Vantage): 50 stocks/batch, 12s delay = ~10 min for 500 stocks
# After (yfinance): 100 stocks/batch, 0.5s delay = ~5 min for 500 stocks
```

**Concurrency Configuration:**
- Batch size: 100 stocks (increased from 50)
- Concurrent requests per batch: 20 (thread pool size)
- Inter-batch delay: 0.5 seconds (reduced from 1s)

**Memory Management:**
- Process batches sequentially (not all at once)
- Release DataFrame memory after processing each stock
- Database writes batched (commit every 50 records)

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| 30 stocks collection | <30 seconds | End-to-end time |
| 500 stocks collection | <10 minutes | End-to-end time |
| Memory usage | <500 MB peak | During collection |
| Database write throughput | >100 records/second | Batch commits |

---

## Project Structure Changes

```
backend/
├── app/
│   ├── services/
│   │   ├── data_collection.py          # MODIFIED: Unified service with yfinance
│   │   └── ml_service.py              # EXISTING: Training functions
│   ├── tasks/
│   │   ├── market_data.py             # EXISTING: Collection job
│   │   └── ml_training.py           # NEW: Automated training job
│   ├── api/
│   │   └── v1/
│   │       └── endpoints/
│   │           └── admin.py         # NEW: Admin training endpoint
│   └── core/
│       └── config.py                  # MODIFIED: Add data source preference
├── ml-models/                         # EXISTING: Model storage
└── requirements.txt                   # MODIFIED: Add yfinance
```

---

## Integration Points

### 1. Data Collection → Database
- **Service:** `data_collection.py` → `crud/market_data.py`
- **Pattern:** Async CRUD operations
- **Transaction:** Per-stock commit (idempotent via timestamp)

### 2. Training Pipeline → Model Storage
- **Service:** `ml_service.py` → `ml-models/` directory
- **Pattern:** File-based artifact storage
- **Versioning:** Timestamp-based filenames

### 3. Training → Model Reload
- **Service:** `ml_training.py` → `ml_service.initialize_models()`
- **Pattern:** In-memory model cache refresh
- **Timing:** After successful training completion

### 4. Admin API → Training Service
- **Endpoint:** `admin.py` → `ml_service.train_models()`
- **Pattern:** Async background task
- **Response:** Immediate with task_id, status via separate endpoint

---

## Implementation Patterns

### Pattern 1: Unified Data Collection Interface

**Naming Convention:**
- Function: `collect_market_data(symbol: str) -> dict | None`
- Primary: `_collect_from_yfinance(symbol: str) -> dict | None` (private)
- Fallback: `collect_market_data_from_alpha_vantage(symbol: str) -> dict | None` (existing)

**Error Handling:**
- Primary failure → Log warning, try fallback
- Fallback failure → Log error, return None
- Both fail → Return None (retried next cycle)

**Logging Format:**
```
INFO: Collected data for AAPL using yfinance (primary)
WARN: yfinance failed for BRK.B, using Alpha Vantage fallback
ERROR: Both sources failed for INVALID, skipping
```

### Pattern 2: Async Blocking Call Wrapper

**Convention:**
```python
async def async_wrapper(blocking_func, *args, **kwargs):
    """Wrap blocking function in thread pool"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, blocking_func, *args, **kwargs)
```

**Usage:**
```python
# yfinance blocking call
df = await async_wrapper(yf.Ticker(symbol).history, period="1d")
```

### Pattern 3: Circuit Breaker Integration

**Location:** `backend/app/services/circuit_breaker.py` (new utility)

**Usage:**
```python
from app.services.circuit_breaker import CircuitBreaker

yfinance_circuit = CircuitBreaker(failure_threshold=5, timeout=300)

async def collect_market_data(symbol: str):
    if yfinance_circuit.is_open():
        # Skip yfinance, go straight to fallback
        return await collect_from_alpha_vantage(symbol)
    
    try:
        result = await collect_from_yfinance(symbol)
        yfinance_circuit.record_success()
        return result
    except Exception as e:
        yfinance_circuit.record_failure()
        # Try fallback...
```

### Pattern 4: Training Job Error Isolation

**Principle:** Training failures must not crash scheduler

**Implementation:**
```python
async def ml_training_job():
    try:
        # Training logic
        results = await train_models(...)
        logger.info(f"Training completed: {results}")
    except ValueError as e:
        # Insufficient data - not an error, just skip
        logger.warning(f"Training skipped: {e}")
    except Exception as e:
        # Real error - log but don't crash
        logger.error(f"Training failed: {e}", exc_info=True)
        # Scheduler continues running other jobs
```

---

## Data Architecture

### Symbol Normalization

**Problem:** Yahoo Finance uses different symbol formats (BRK.B → BRK-B)

**Solution:** Normalization function
```python
def normalize_symbol_for_yfinance(symbol: str) -> str:
    """Convert symbol to Yahoo Finance format"""
    return symbol.replace(".", "-").upper()
```

**Storage:** Original symbol format preserved in database, normalization only for API calls

### Data Format Consistency

**Standard Format:**
```python
{
    "price": float,      # Latest closing price
    "volume": int,        # Trading volume
    "timestamp": datetime # UTC, timezone-naive
}
```

**Both sources must return this format** (yfinance adapter converts DataFrame to this)

---

## Security Architecture

### Admin Endpoint Authentication

**Requirement:** Only admins can trigger training

**Implementation:**
```python
from app.core.auth import get_current_user
from app.users.models import User

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_superuser:  # Extend User model
        raise HTTPException(403, "Admin access required")
    return current_user
```

**Rate Limiting:**
- Max 1 training job per hour (prevent abuse)
- Store last training time in memory/Redis

---

## Performance Considerations

### Thread Pool Sizing

**Default Executor:** Python's default thread pool (typically 5-32 threads)

**For yfinance:** Default is sufficient (I/O-bound operations)

**Monitoring:** Track thread pool queue size, adjust if needed

### Database Write Optimization

**Current:** Per-stock commit (safe but slow)

**Optimized:** Batch commits every 50 stocks
```python
batch = []
for stock in stocks:
    data = await collect_market_data(stock.symbol)
    batch.append(data)
    if len(batch) >= 50:
        await session.commit()  # Batch commit
        batch = []
```

**Trade-off:** Slightly less safe (batch rollback on error) but much faster

---

## Deployment Architecture

### Model Training Resource Requirements

**Memory:** ~2-4 GB during training (temporary)
**CPU:** Training is CPU-intensive but runs once daily
**Storage:** ~50-100 MB per model version (keep last 3 versions)

**Render Free Tier:** Sufficient for daily training (runs off-peak hours)

### Monitoring & Observability

**Logging:**
- Data collection: Per-stock success/failure
- Training: Start, completion, metrics, errors
- Circuit breakers: State transitions logged

**Metrics to Track:**
- Collection success rate (per source)
- Average collection time
- Training duration
- Model accuracy trends

---

## Development Environment

### Prerequisites

**New Dependency:**
```bash
pip install yfinance
```

**Update requirements.txt:**
```
yfinance>=0.2.0
```

### Configuration

**Environment Variables:**
```bash
# Data source preference (optional, defaults to yfinance)
PREFERRED_DATA_SOURCE=yfinance  # or "alphavantage"

# Training schedule (optional, defaults to 2 AM UTC)
ML_TRAINING_HOUR=2
ML_TRAINING_MINUTE=0
```

---

## Architecture Decision Records (ADRs)

### ADR-005-01: yfinance as Primary Data Source

**Decision:** Use yfinance as primary data source with Alpha Vantage as fallback

**Rationale:**
- Unlimited API calls (no rate limits)
- No API key required
- Reliable historical data
- Free and open source

**Alternatives Considered:**
- Alpha Vantage only: Rate-limited (5 calls/min), would take 100+ minutes for 500 stocks
- Multiple paid APIs: Cost prohibitive for MVP

**Consequences:**
- Must handle async execution (yfinance is blocking)
- Symbol normalization required (BRK.B → BRK-B)
- Fallback still needed for reliability

---

### ADR-005-02: asyncio.to_thread() for Blocking Calls

**Decision:** Use `asyncio.to_thread()` (Python 3.9+) to wrap yfinance blocking calls

**Rationale:**
- Standard library (no extra dependencies)
- Simple API
- Sufficient for I/O-bound operations

**Alternatives Considered:**
- Custom thread pool: More control but unnecessary complexity
- Process pool: Overkill for I/O-bound operations

**Consequences:**
- Requires Python 3.9+ (already using 3.11+)
- Default executor sufficient (no tuning needed)

---

### ADR-005-03: Daily Automated Training

**Decision:** Schedule model training daily at 2 AM UTC via APScheduler

**Rationale:**
- Ensures models stay current with latest data
- Runs during off-peak hours
- Integrates with existing scheduler infrastructure

**Alternatives Considered:**
- Weekly training: Less frequent updates, models may degrade
- On-demand only: Requires manual intervention, easy to forget

**Consequences:**
- Daily training adds ~10-30 minutes of CPU usage
- Must handle training failures gracefully (don't crash scheduler)

---

### ADR-005-04: Circuit Breaker Pattern for Data Sources

**Decision:** Implement circuit breaker pattern for data source failures

**Rationale:**
- Prevents cascading failures
- Fast failure when source is down
- Automatic recovery testing

**Alternatives Considered:**
- Always retry: Wastes time on known failures
- No retry: Too aggressive, may miss temporary issues

**Consequences:**
- Adds complexity (circuit breaker state management)
- Requires tuning (failure threshold, timeout)

---

## Epic 5 Story Mapping

| Story | Architecture Component | Key Decisions |
|-------|----------------------|---------------|
| 5.1: Unified Data Collection | `data_collection.py` | yfinance primary, Alpha Vantage fallback |
| 5.2: Async Execution | `data_collection.py` | asyncio.to_thread() wrapper |
| 5.3: Automated Training | `tasks/ml_training.py` | APScheduler daily job |
| 5.4: Training API | `api/v1/endpoints/admin.py` | Async background task pattern |
| 5.5: Error Handling | `services/circuit_breaker.py` | Circuit breaker + retry logic |
| 5.6: Performance Optimization | `tasks/market_data.py` | Batch size, concurrency tuning |

---

## Consistency Rules

### Naming Conventions

- **Data collection functions:** `collect_market_data()`, `collect_from_yfinance()`, `collect_from_alpha_vantage()`
- **Training functions:** `train_models()`, `ml_training_job()`
- **Circuit breakers:** `{source}_circuit` (e.g., `yfinance_circuit`)

### Error Handling

- **Primary source failure:** Log warning, try fallback
- **Both sources fail:** Log error, return None (retried next cycle)
- **Training failure:** Log error, don't crash scheduler

### Logging Format

- **Data collection:** `INFO: Collected {symbol} using {source}`
- **Training:** `INFO: Training started/completed with metrics: {metrics}`
- **Circuit breaker:** `WARN: {source} circuit opened after {failures} failures`

---

_Generated by BMAD Decision Architecture Workflow_  
_Date: 2025-01-11_  
_For: Andrew_

