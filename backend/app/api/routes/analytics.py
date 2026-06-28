"""Analytics and metrics endpoints using optimized RPC functions."""

from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request

from ...core.logging import get_logger
from ...database.client import supabase_client
from .common import verify_admin_access

logger = get_logger(__name__)

router = APIRouter(tags=["analytics"])


# ============================================================================
# Legacy helper functions (kept for backwards compatibility with files endpoint)
# ============================================================================

async def get_thread_ids_for_admin_settings(admin_settings_id: int) -> List[str]:
    """
    Get all thread IDs with the given admin_settings_id.
    Used only for files analytics which doesn't have an RPC function yet.
    """
    if not supabase_client.client:
        return []

    try:
        threads_result = supabase_client.client.table("threads").select("id").eq("admin_settings_id", admin_settings_id).execute()

        if not threads_result.data:
            return []

        return [t["id"] for t in threads_result.data]

    except Exception as e:
        logger.error(f"Error getting thread IDs for admin_settings_id {admin_settings_id}: {e}")
        return []


# ============================================================================
# RPC-based Analytics Endpoints (Optimized)
# ============================================================================

@router.get("/analytics/metrics/latency")
async def get_latency_analytics(
    request: Request,
    from_date: str = None,
    to_date: str = None,
    granularity: str = "day",
    user_id: str = None,
    admin_settings_id: Optional[int] = None
):
    """
    Get latency analytics with distributions and time series.
    
    Uses optimized RPC function that performs all computation at the database level.

    Supported granularities:
    - 'hour': Groups data by hour (YYYY-MM-DD HH:00)
    - 'day': Groups data by day (YYYY-MM-DD)
    - 'week': Groups data by week starting Monday (YYYY-MM-DD)
    - 'month': Groups data by month (YYYY-MM)
    - 'year': Groups data by year (YYYY)

    Optional admin_settings_id filter:
    - 1: Control Chart Generator
    - 2: Planned Experiment Generator
    """
    await verify_admin_access(request)

    try:
        if not supabase_client.client:
            raise HTTPException(status_code=503, detail="Database not available")

        # Call the RPC function
        result = supabase_client.client.rpc(
            'get_latency_analytics',
            {
                'p_admin_settings_id': admin_settings_id,
                'p_from_date': from_date,
                'p_to_date': to_date,
                'p_granularity': granularity
            }
        ).execute()

        if result.data:
            return result.data
        
        # Return empty result if no data
        return {
            "summary": {"p50_ms": 0, "p90_ms": 0, "p99_ms": 0, "mean_ms": 0},
            "series": []
        }

    except Exception as e:
        logger.error(f"Error fetching latency analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch latency analytics") from e


@router.get("/analytics/metrics/cost")
async def get_cost_analytics(
    request: Request,
    from_date: str = None,
    to_date: str = None,
    granularity: str = "day",
    user_id: str = None,
    admin_settings_id: Optional[int] = None
):
    """
    Get cost analytics over time and by model with token usage data.
    
    Uses optimized RPC function that performs all computation at the database level.

    Returns cost breakdown alongside input/output token usage.
    Supported granularities: 'hour', 'day', 'week', 'month', 'year'

    Optional admin_settings_id filter:
    - 1: Control Chart Generator
    - 2: Planned Experiment Generator
    """
    await verify_admin_access(request)

    try:
        if not supabase_client.client:
            raise HTTPException(status_code=503, detail="Database not available")

        # Call the RPC function
        result = supabase_client.client.rpc(
            'get_cost_analytics',
            {
                'p_admin_settings_id': admin_settings_id,
                'p_from_date': from_date,
                'p_to_date': to_date,
                'p_granularity': granularity
            }
        ).execute()

        if result.data:
            return result.data
        
        # Return empty result if no data
        return {
            "total_usd": 0.0,
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "series": []
        }

    except Exception as e:
        logger.error(f"Error fetching cost analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch cost analytics") from e


@router.get("/analytics/metrics/files")
async def get_files_analytics(
    request: Request,
    from_date: str = None,
    to_date: str = None,
    user_id: str = None,
    limit: int = 50,
    cursor: str = None,
    admin_settings_id: Optional[int] = None
):
    """
    Get file analytics with names, counts and types.
    
    Note: This endpoint still uses the legacy query approach as it requires
    processing file names from message content.

    Optional admin_settings_id filter:
    - 1: Control Chart Generator
    - 2: Planned Experiment Generator
    """
    await verify_admin_access(request)

    try:
        if not supabase_client.client:
            raise HTTPException(status_code=503, detail="Database not available")

        # Get thread IDs for filtering if admin_settings_id is provided
        thread_ids = None
        if admin_settings_id is not None:
            thread_ids = await get_thread_ids_for_admin_settings(admin_settings_id)
            if not thread_ids:
                return {
                    "items": [],
                    "next_cursor": None
                }

        # Build query - get file names from messages table
        query = supabase_client.client.table("messages").select("uploaded_file_names, created_at, thread_id")

        # Apply filters
        if from_date:
            query = query.gte("created_at", from_date)
        if to_date:
            query = query.lte("created_at", to_date)
        if user_id:
            query = query.eq("user_id", user_id)

        result = query.execute()

        # Filter by thread_ids if admin_settings_id was provided
        if thread_ids is not None:
            thread_ids_set = set(thread_ids)
            result.data = [row for row in result.data if row.get("thread_id") in thread_ids_set]

        # Process file data
        file_stats = {}
        for row in result.data:
            file_names = row.get("uploaded_file_names", [])
            for file_name in file_names:
                if file_name:
                    # Extract file extension
                    file_type = file_name.split('.')[-1].lower() if '.' in file_name else 'unknown'

                    if file_name not in file_stats:
                        file_stats[file_name] = {"count": 0, "types": set()}

                    file_stats[file_name]["count"] += 1
                    file_stats[file_name]["types"].add(file_type)

        # Convert to response format
        items = []
        for file_name, stats in file_stats.items():
            items.append({
                "file_id": file_name,
                "count": stats["count"],
                "types": list(stats["types"])
            })

        # Sort by count descending
        items.sort(key=lambda x: x["count"], reverse=True)

        # Apply pagination
        if limit and limit > 0:
            items = items[:limit]

        return {
            "items": items,
            "next_cursor": None
        }

    except Exception as e:
        logger.error(f"Error fetching files analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch files analytics") from e


@router.get("/analytics/metrics/charts")
async def get_charts_analytics(
    request: Request,
    from_date: str = None,
    to_date: str = None,
    granularity: str = "day",
    user_id: str = None,
    admin_settings_id: Optional[int] = None
):
    """
    Get chart generation analytics.
    
    Uses optimized RPC function that performs all computation at the database level.

    Optional admin_settings_id filter:
    - 1: Control Chart Generator
    - 2: Planned Experiment Generator
    """
    await verify_admin_access(request)

    try:
        if not supabase_client.client:
            raise HTTPException(status_code=503, detail="Database not available")

        # Call the RPC function
        result = supabase_client.client.rpc(
            'get_charts_analytics',
            {
                'p_admin_settings_id': admin_settings_id,
                'p_from_date': from_date,
                'p_to_date': to_date,
                'p_granularity': granularity
            }
        ).execute()

        if result.data:
            return result.data
        
        # Return empty result if no data
        return {
            "rate": {"generated_pct": 0.0},
            "by_type": [],
            "series": []
        }

    except Exception as e:
        logger.error(f"Error fetching charts analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch charts analytics") from e


@router.get("/analytics/metrics/usage")
async def get_usage_analytics(
    request: Request,
    from_date: str = None,
    to_date: str = None,
    granularity: str = "day",
    admin_settings_id: Optional[int] = None
):
    """
    Get usage analytics including chats per user and active users over time.
    
    Uses optimized RPC function that performs all computation at the database level.

    Active users are counted based on users who sent messages (role='user') within each time period.

    Frontend-Backend Granularity Mapping:
    - Frontend 'daily' view (7 days) → sends 'day' granularity → returns 'daily_active_users'
    - Frontend 'weekly' view (4 weeks) → sends 'week' granularity → returns 'week_active_users'
    - Frontend 'monthly' view (12 months) → sends 'month' granularity → returns 'month_active_users'
    - Frontend 'yearly' view (10 years) → sends 'year' granularity → returns 'year_active_users'

    Optional admin_settings_id filter:
    - 1: Control Chart Generator
    - 2: Planned Experiment Generator
    """
    await verify_admin_access(request)

    try:
        if not supabase_client.client:
            raise HTTPException(status_code=503, detail="Database not available")

        # Call the RPC function
        result = supabase_client.client.rpc(
            'get_usage_analytics',
            {
                'p_admin_settings_id': admin_settings_id,
                'p_from_date': from_date,
                'p_to_date': to_date,
                'p_granularity': granularity
            }
        ).execute()

        if result.data:
            return result.data
        
        # Return empty result if no data
        return {
            "chats_per_user": [],
            "avg_session_length": {"messages_per_session": 0, "words_per_session": 0},
            "active_users": []
        }

    except Exception as e:
        logger.error(f"Error fetching usage analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch usage analytics") from e


@router.get("/analytics/metrics/recent-latencies")
async def get_recent_latencies(
    request: Request,
    limit: int = 20,
    admin_settings_id: Optional[int] = None
):
    """
    Get the most recent latencies (up to 50).
    
    Uses optimized RPC function that performs all computation at the database level.

    Optional admin_settings_id filter:
    - 1: Control Chart Generator
    - 2: Planned Experiment Generator
    """
    try:
        await verify_admin_access(request)

        if not supabase_client.client:
            raise HTTPException(status_code=503, detail="Database not available")

        # Enforce limits
        if limit > 50:
            limit = 50
        if limit < 1:
            limit = 20

        # Call the RPC function
        result = supabase_client.client.rpc(
            'get_recent_latencies',
            {
                'p_admin_settings_id': admin_settings_id,
                'p_limit': limit
            }
        ).execute()

        if result.data:
            return result.data
        
        # Return empty result if no data
        return {"recent_latencies": []}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching recent latencies: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch recent latencies") from e
