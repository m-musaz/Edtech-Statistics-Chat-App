"""Thread management endpoints."""

from fastapi import APIRouter, HTTPException

from ...core.logging import get_logger
from ...database.client import supabase_client

logger = get_logger(__name__)

router = APIRouter(tags=["threads"])


@router.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str):
    """Delete a thread and all its messages."""
    try:
        if not supabase_client.client:
            raise HTTPException(status_code=503, detail="Database not available")

        # First delete all messages in the thread
        messages_response = supabase_client.client.table("messages").delete().eq("thread_id", thread_id).execute()
        logger.info(f"Deleted {len(messages_response.data) if messages_response.data else 0} messages from thread {thread_id}")

        # Then delete the thread itself
        thread_response = supabase_client.client.table("threads").delete().eq("id", thread_id).execute()

        if thread_response.data:
            logger.info(f"Thread {thread_id} deleted successfully")
            return {"message": "Thread deleted successfully", "thread_id": thread_id}
        else:
            raise HTTPException(status_code=404, detail="Thread not found")
    except Exception as e:
        logger.error(f"Failed to delete thread {thread_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete thread")
