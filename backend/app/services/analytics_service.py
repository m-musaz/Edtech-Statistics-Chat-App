"""Analytics service for tracking usage and persistence."""

import asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime
from uuid import uuid4
from ..models.database import AnalyticsData, Role
from ..database.client import supabase_client
from ..core.logging import get_logger
from openai import AsyncOpenAI
from pydantic import BaseModel
from ..core.config import settings

logger = get_logger(__name__)

client = AsyncOpenAI(api_key=settings.openai_api_key)

class ChartType(BaseModel):
    chart_type: str

class TitleResponse(BaseModel):
    title: str

class AnalyticsService:
    """Service for handling analytics data persistence."""

    @staticmethod
    async def detect_chart_type(response_data: Dict[str, Any]) -> Any:
        """
        Detect if a chart was generated and determine the type.

        Args:
            response_data: The response data from OpenAI API

        Returns:
            ChartType enum value
        """
        try:
            # Check if chart_output exists in response
            if "chart_outputs" in response_data and response_data["chart_outputs"]:
                # Try to determine chart type from the response content
                output_items = response_data.get("output", [])
                content_to_gpt = []

                for item in output_items:
                    if item.get("type") == "code_interpreter_call" and item.get("status") == "completed":
                        executed_code = item.get("code",None)
                        if executed_code:
                            content_to_gpt.append("Code:")
                            content_to_gpt.append(executed_code)

                if(len(content_to_gpt) > 0):

                    response_params = {
                        "model": "gpt-5-nano-2025-08-07",
                        "input": "\n".join(content_to_gpt),
                        "reasoning":{ "effort": "medium" },
                        "text":{ "verbosity": "low" },
                        "instructions": "You are given the output text and code used to generate a control chart. Your job is to determine what type of control chart it is. DONOT TALK EXTRA OR GIVE ANYTHING ELSE THAN CHART TYPE. DONOT include any symbols,dashes,brackets etc and output in lowercase only",
                        "text_format":ChartType,
                    }

                    response = await client.responses.parse(**response_params)
                    chart_type = response.output_parsed.chart_type.lower()

                    return chart_type
                else:
                    return "none"

            return "none"

        except Exception as e:
            logger.error(f"Error detecting chart type: {e}")
            return "none"

    @staticmethod
    async def persist_analytics_data(analytics_data: AnalyticsData) -> None:
        """
        Persist analytics data to the database.

        Args:
            analytics_data: The analytics data to persist
        """
        try:
            # Check if Supabase client is available
            if not supabase_client.client:
                logger.warning("Supabase client not available - skipping analytics persistence")
                return

            # Get the actual user ID from the database
            actual_user_id = await AnalyticsService._ensure_user_exists(analytics_data.user_id)

            # Create message record
            # Note: downloadable_files are now stored client-side in localStorage
            message_data = {
                "id": str(analytics_data.message_id),
                "thread_id": str(analytics_data.thread_id),
                "user_id": actual_user_id,
                "role": Role.ASSISTANT.value,
                "content": analytics_data.assistant_response,
                "uploaded_file_names": [],  # Assistant messages don't show file names
                "uploaded_file_ids": [],  # Assistant messages don't have file IDs
                "metadata": {
                    "previous_response_id": None,  # Could be extracted if needed
                    "chart_generated": analytics_data.chart_type != "none"
                }
            }

            # Create analytics record
            analytics_record = {
                "id": str(uuid4()),
                "message_id": str(analytics_data.message_id),
                "latency_ms": analytics_data.latency_ms,
                "input_tokens": analytics_data.input_tokens,
                "output_tokens": analytics_data.output_tokens,
                "cost_usd": analytics_data.cost_usd,
                "chart_type": analytics_data.chart_type
            }

            # Persist to database
            await supabase_client.create_message(message_data)
            await supabase_client.create_analytics(analytics_record)

            # Update thread timestamp
            await supabase_client.update_thread_updated_at(str(analytics_data.thread_id))

            logger.info(f"Successfully persisted analytics for message {analytics_data.message_id}")

        except Exception as e:
            logger.error(f"Error persisting analytics data: {e}")
            raise

    @staticmethod
    async def create_user_message(
        thread_id: str,
        auth_user_id: str,
        user_message: str,
        file_names: List[str],
        file_ids: List[str] = None
    ) -> str:
        """
        Create a user message record.

        Args:
            thread_id: The thread ID
            auth_user_id: The auth user ID
            user_message: The user's message content
            file_names: List of uploaded file names
            file_ids: List of uploaded file IDs

        Returns:
            The created message ID
        """
        if not supabase_client.client:
            logger.warning("Supabase client not available - skipping user message creation")
            return str(uuid4())

        try:
            # Get the actual user ID from the database
            actual_user_id = await AnalyticsService._ensure_user_exists(auth_user_id)

            message_id = str(uuid4())

            message_data = {
                "id": message_id,
                "thread_id": thread_id,
                "user_id": actual_user_id,
                "role": Role.USER.value,
                "content": {"text": user_message},
                "uploaded_file_names": file_names,
                "uploaded_file_ids": file_ids or [],
                "metadata": None
            }

            await supabase_client.create_message(message_data)

            logger.info(f"Created user message: {message_id}")
            return message_id

        except Exception as e:
            logger.error(f"Error creating user message: {e}")
            raise

    @staticmethod
    async def get_or_create_thread(user_id: str, thread_id: Optional[str] = None, admin_settings_id: int = 1) -> str:
        """
        Get existing thread or create new one.

        Args:
            user_id: The user ID
            thread_id: Optional existing thread ID
            admin_settings_id: The admin settings ID (1=control, 2=plan)

        Returns:
            The thread ID to use
        """
        if not supabase_client.client:
            logger.warning("Supabase client not available - using fallback thread ID")
            return thread_id or str(uuid4())

        try:
            # First, ensure the user exists and get the actual user ID
            actual_user_id = await AnalyticsService._ensure_user_exists(user_id)

            if thread_id:
                # Check if thread exists
                thread = await supabase_client.get_thread(str(thread_id))
                if thread:
                    return str(thread_id)
                else:
                    logger.warning(f"Thread {thread_id} not found, creating new thread")

            # Create new thread with a temporary title
            thread_data = await supabase_client.create_thread(
                user_id=actual_user_id,
                title="New Chat",
                admin_settings_id=admin_settings_id
            )

            return thread_data["id"]

        except Exception as e:
            logger.error(f"Error getting or creating thread: {e}")
            raise

    @staticmethod
    async def generate_title_from_messages(messages: List[Dict[str, Any]]) -> str:
        """Generate a concise title from thread messages using GPT Responses API."""
        try:
            if not messages:
                return "New Chat"

            # Format messages for prompt (simplified for input)
            conversation_text = ""
            for msg in messages:
                role = msg.get("role", "unknown")
                content = msg.get("content", "")
                text_content = ""
                if isinstance(content, dict):
                    text_content = content.get("text", str(content))
                else:
                    text_content = str(content)
                
                conversation_text += f"{role}: {text_content}\n"

            response = await client.responses.parse(
                model="gpt-4o-mini",
                input=f"Generate a 3-4 word summary title for this conversation:\n\n{conversation_text}",
                instructions="You are a helpful assistant that generates a short, 3-4 word summary title for a conversation. Output ONLY the title, no quotes or extra text.",
                text_format=TitleResponse,
            )
            
            # Responses API returns the parsed object directly in output_parsed (or similar, depending on exact version/usage)
            # Based on previous usage in this file (line 61: response.output_parsed), we follow that.
            if response and response.output_parsed:
                title = response.output_parsed.title.strip()
                # Remove quotes if present (double check, though structured output usually handles this)
                title = title.replace('"', '').replace("'", "")
                return title
            
            return "New Chat"

        except Exception as e:
            logger.error(f"Error generating chat title: {e}")
            return "New Chat"

    @staticmethod
    async def update_thread_title_if_needed(thread_id: str, user_message: str) -> None:
        """
        Update thread title if it's still default or every 5 messages.
        
        Args:
            thread_id: The thread ID
            user_message: The latest user message (fallback usage)
        """
        try:
            # Check current title and message count
            # We run this in background so it's fine to do a few DB calls
            thread = await supabase_client.get_thread(thread_id)
            if not thread:
                return
                
            current_title = thread.get("title", "New Chat")
            message_count = await supabase_client.get_thread_message_count(thread_id)
            
            # Logic: Update if title is "New Chat" OR periodic update (every 5 messages)
            # check if message_count is at least 2 (1 user + 1 assistant) to have enough context
            should_update = (current_title == "New Chat" and message_count >= 1) or (message_count > 0 and message_count % 5 == 0)
            
            if should_update:
                logger.info(f"Updating title for thread {thread_id} (count: {message_count})")
                
                # Fetch recent messages for context (last 10 should be enough for summary)
                messages = await supabase_client.get_thread_messages(thread_id, limit=5)
                
                if messages:
                    new_title = await AnalyticsService.generate_title_from_messages(messages)
                    if new_title and new_title != "New Chat":
                        await supabase_client.update_thread_title(thread_id, new_title)
                        logger.info(f"Updated thread {thread_id} title to: {new_title}")
                
        except Exception as e:
            logger.error(f"Error updating thread title: {e}")

    @staticmethod
    async def _ensure_user_exists(user_id: str) -> str:
        """
        Ensure user exists in the database, create if not.

        Args:
            user_id: The auth user ID to check/create

        Returns:
            The actual user ID from the database
        """
        try:
            # Check if user exists
            user = await supabase_client.get_user_by_auth_id(user_id)
            if not user:
                # Create user with default email
                user = await supabase_client.create_user(
                    auth_user_id=user_id,
                    email=f"user_{user_id}@example.com"
                )
                logger.info(f"Created user: {user_id}")

            return user["id"]
        except Exception as e:
            logger.error(f"Error ensuring user exists: {e}")
            raise
