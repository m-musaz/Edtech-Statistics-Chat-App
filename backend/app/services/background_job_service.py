"""
Background job service using Supabase as queue.

⚠️  DEPRECATED: This service has been replaced by FastAPI's built-in BackgroundTasks.
    Analytics processing now uses FastAPI BackgroundTasks for better performance
    and simpler architecture. This file is kept for reference but is no longer used.
    
    See: app/services/chat_service.py -> process_analytics_background_task()
"""

import asyncio
import json
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from uuid import uuid4
from ..models.database import AnalyticsData
from ..services.analytics_service import AnalyticsService
from ..database.client import supabase_client
from ..core.logging import get_logger

logger = get_logger(__name__)


class BackgroundJobService:
    """Service for managing background jobs using Supabase as queue."""

    # Job statuses
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

    @staticmethod
    async def enqueue_analytics_job(analytics_data: AnalyticsData) -> str:
        """
        Enqueue an analytics job for background processing.

        Args:
            analytics_data: The analytics data to process

        Returns:
            Job ID
        """
        try:
            # Check if Supabase client is available
            if not supabase_client.client:
                logger.warning("Supabase client not available - processing analytics immediately")
                await BackgroundJobService._process_analytics_immediately(analytics_data)
                return "immediate"

            job_id = str(uuid4())

            # Create job record in a simple jobs table
            # We'll use a simple approach with a jobs table
            job_data = {
                "id": job_id,
                "type": "analytics_persistence",
                "status": BackgroundJobService.PENDING,
                "payload": analytics_data.model_dump_json(),
                "created_at": datetime.utcnow().isoformat(),
                "attempts": 0,
                "max_attempts": 3
            }

            # For simplicity, we'll use a table called 'background_jobs'
            # You may need to create this table in Supabase
            result = supabase_client.client.table("background_jobs").insert(job_data).execute()

            if result.data:
                logger.info(f"Enqueued analytics job: {job_id}")

                # Start background processing (non-blocking)
                asyncio.create_task(BackgroundJobService._process_job(job_id))

                return job_id
            else:
                raise Exception("Failed to enqueue job")

        except Exception as e:
            logger.error(f"Error enqueuing analytics job: {e}")
            # Fallback: process immediately if queue fails
            await BackgroundJobService._process_analytics_immediately(analytics_data)
            return "immediate"

    @staticmethod
    async def _process_job(job_id: str) -> None:
        """
        Process a background job.

        Args:
            job_id: The job ID to process
        """
        try:
            # Get job from database
            result = supabase_client.client.table("background_jobs").select("*").eq("id", job_id).execute()

            if not result.data:
                logger.error(f"Job {job_id} not found")
                return

            job = result.data[0]

            # Update status to processing
            supabase_client.client.table("background_jobs").update({
                "status": BackgroundJobService.PROCESSING,
                "started_at": datetime.utcnow().isoformat()
            }).eq("id", job_id).execute()

            # Parse payload
            payload = json.loads(job["payload"])
            analytics_data = AnalyticsData(**payload)

            # Detect chart type from response_dict in background
            chart_type = await AnalyticsService.detect_chart_type(analytics_data.assistant_response)
            analytics_data.chart_type = chart_type

            # Process the analytics data
            await AnalyticsService.persist_analytics_data(analytics_data)

            # Update thread title
            await AnalyticsService.update_thread_title_if_needed(str(analytics_data.thread_id), analytics_data.user_message)

            # Update status to completed
            supabase_client.client.table("background_jobs").update({
                "status": BackgroundJobService.COMPLETED,
                "completed_at": datetime.utcnow().isoformat()
            }).eq("id", job_id).execute()

            logger.info(f"Successfully processed job: {job_id}")

        except Exception as e:
            logger.error(f"Error processing job {job_id}: {e}")

            # Update status to failed and increment attempts
            attempts = job.get("attempts", 0) + 1
            max_attempts = job.get("max_attempts", 3)

            if attempts < max_attempts:
                # Retry later
                retry_at = datetime.utcnow() + timedelta(minutes=2 ** attempts)
                supabase_client.client.table("background_jobs").update({
                    "status": BackgroundJobService.PENDING,
                    "attempts": attempts,
                    "retry_at": retry_at.isoformat(),
                    "error_message": str(e)
                }).eq("id", job_id).execute()

                logger.info(f"Job {job_id} will be retried at {retry_at}")
            else:
                # Mark as failed
                supabase_client.client.table("background_jobs").update({
                    "status": BackgroundJobService.FAILED,
                    "failed_at": datetime.utcnow().isoformat(),
                    "error_message": str(e)
                }).eq("id", job_id).execute()

                logger.error(f"Job {job_id} failed after {attempts} attempts")

    @staticmethod
    async def _process_analytics_immediately(analytics_data: AnalyticsData) -> None:
        """
        Process analytics data immediately (fallback when queue fails).

        Args:
            analytics_data: The analytics data to process
        """
        try:
            # Detect chart type from response_dict in background
            chart_type = await AnalyticsService.detect_chart_type(analytics_data.assistant_response)
            analytics_data.chart_type = chart_type

            await AnalyticsService.persist_analytics_data(analytics_data)

            # Update thread title if needed (only for first message in thread)
            await AnalyticsService.update_thread_title_if_needed(
                str(analytics_data.thread_id),
                analytics_data.user_message
            )

            logger.info("Successfully processed analytics data immediately")
        except Exception as e:
            logger.error(f"Error processing analytics data immediately: {e}")

    @staticmethod
    async def process_pending_jobs() -> None:
        """Process any pending jobs that are ready for retry."""
        try:
            # Get pending jobs that are ready for retry
            now = datetime.utcnow().isoformat()
            result = supabase_client.client.table("background_jobs").select("*").eq("status", BackgroundJobService.PENDING).lte("retry_at", now).execute()

            for job in result.data:
                asyncio.create_task(BackgroundJobService._process_job(job["id"]))

        except Exception as e:
            logger.error(f"Error processing pending jobs: {e}")
