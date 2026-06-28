"""Supabase database client."""

from typing import Optional, List, Dict, Any
from datetime import datetime
from supabase import create_client, Client
from ..core.config import settings
from ..core.logging import get_logger

logger = get_logger(__name__)


class SupabaseClient:
    """Supabase client wrapper."""

    def __init__(self):
        """Initialize Supabase client."""
        if not settings.supabase_url or not settings.supabase_anon_key:
            logger.warning("Supabase credentials not configured - analytics will be disabled")
            self.client = None
            return

        try:
            self.client: Client = create_client(
                settings.supabase_url,
                settings.supabase_anon_key
            )
            logger.info("Supabase client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            self.client = None

    async def create_user(self, auth_user_id: str, email: str) -> Dict[str, Any]:
        """Create a new user."""
        if not self.client:
            raise Exception("Supabase client not initialized")

        try:
            from uuid import uuid4
            user_id = str(uuid4())
            result = self.client.table("users").insert({
                "id": user_id,
                "auth_user_id": auth_user_id,
                "email": email,
                "last_seen_at": datetime.utcnow().isoformat()
            }).execute()

            if result.data:
                logger.info(f"Created user: {email}")
                return result.data[0]
            else:
                raise Exception("Failed to create user")

        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise

    async def get_user_by_auth_id(self, auth_user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by auth user ID."""
        if not self.client:
            return None

        try:
            result = self.client.table("users").select("*").eq("auth_user_id", auth_user_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error fetching user: {e}")
            return None

    async def create_thread(self, user_id: str, title: str, admin_settings_id: int = 1) -> Dict[str, Any]:
        """Create a new thread."""
        if not self.client:
            raise Exception("Supabase client not initialized")

        try:
            from uuid import uuid4
            thread_id = str(uuid4())
            result = self.client.table("threads").insert({
                "id": thread_id,
                "user_id": user_id,
                "title": title,
                "admin_settings_id": admin_settings_id
            }).execute()

            if result.data:
                logger.info(f"Created thread: {title}")
                return result.data[0]
            else:
                raise Exception("Failed to create thread")

        except Exception as e:
            logger.error(f"Error creating thread: {e}")
            raise

    async def get_thread(self, thread_id: str) -> Optional[Dict[str, Any]]:
        """Get thread by ID."""
        if not self.client:
            return None

        try:
            result = self.client.table("threads").select("*").eq("id", thread_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error fetching thread: {e}")
            return None

    async def create_message(self, message_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new message."""
        if not self.client:
            raise Exception("Supabase client not initialized")

        try:
            # Ensure message_data has an id
            if "id" not in message_data:
                from uuid import uuid4
                message_data["id"] = str(uuid4())
            result = self.client.table("messages").insert(message_data).execute()

            if result.data:
                logger.info(f"Created message: {message_data.get('id')}")
                return result.data[0]
            else:
                raise Exception("Failed to create message")

        except Exception as e:
            logger.error(f"Error creating message: {e}")
            raise

    async def create_analytics(self, analytics_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create analytics record."""
        if not self.client:
            raise Exception("Supabase client not initialized")

        try:
            # Ensure analytics_data has an id
            if "id" not in analytics_data:
                from uuid import uuid4
                analytics_data["id"] = str(uuid4())
            result = self.client.table("analytics").insert(analytics_data).execute()

            if result.data:
                logger.info(f"Created analytics record: {analytics_data.get('id')}")
                return result.data[0]
            else:
                raise Exception("Failed to create analytics record")

        except Exception as e:
            logger.error(f"Error creating analytics: {e}")
            raise

    async def update_thread_updated_at(self, thread_id: str) -> None:
        """Update thread's updated_at timestamp."""
        if not self.client:
            return

        try:
            self.client.table("threads").update({
                "updated_at": "now()"
            }).eq("id", thread_id).execute()

            logger.debug(f"Updated thread timestamp: {thread_id}")
        except Exception as e:
            logger.error(f"Error updating thread timestamp: {e}")

    async def update_thread_title(self, thread_id: str, title: str) -> None:
        """Update thread's title."""
        self.client.table("threads").update({"title": title}).eq("id", thread_id).execute()

    async def get_thread_message_count(self, thread_id: str) -> int:
        """Get the number of messages in a thread."""
        if not self.client:
            return 0
        try:
            result = self.client.table("messages").select("*", count="exact", head=True).eq("thread_id", thread_id).execute()
            return result.count or 0
        except Exception as e:
            logger.error(f"Error counting messages for thread {thread_id}: {e}")
            return 0

    async def get_thread_messages(self, thread_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent messages for a thread."""
        if not self.client:
            return []
        try:
            # Get messages ordered by creation time (assuming implicit insertion order or we need created_at)
            # The schema usually has created_at. Let's assume standard Supabase columns.
            # If created_at is not available, we rely on natural order but usually bad idea.
            # Let's check getting *all* and sorting or just relying on simple select.
            # Usually we want oldest first for context? Or newest first?
            # For summary, we might want the whole conversation or a sliding window.
            # The user said "summary", usually implies context.
            # Let's fetch the last 'limit' messages.
            result = self.client.table("messages").select("*").eq("thread_id", thread_id).order("created_at", desc=True).limit(limit).execute()
            messages = result.data if result.data else []
            # Return in chronological order (oldest -> newest)
            return sorted(messages, key=lambda x: x.get("created_at", ""))
        except Exception as e:
            logger.error(f"Error fetching messages for thread {thread_id}: {e}")
            return []

    async def create_feedback(self, message_id: str, user_id: str, rating: str) -> Dict[str, Any]:
        """Create or update feedback/rating record (upsert)."""
        if not self.client:
            raise Exception("Supabase client not initialized")

        try:
            success = rating == "thumbs_up"

            # Try to use upsert - this requires a unique constraint on (message_id, user_id)
            try:
                # For upsert, don't include ID - let database handle it
                feedback_data = {
                    "message_id": message_id,
                    "user_id": user_id,
                    "success": success,
                    "reason": rating
                }

                # Use upsert with conflict resolution
                result = self.client.table("feedback").upsert(
                    feedback_data,
                    on_conflict="message_id,user_id"
                ).execute()

                logger.info(f"Upserted feedback record for message {message_id}, user {user_id} with rating: {rating}")

            except Exception as upsert_error:
                # Fallback to manual check and update if upsert doesn't work
                logger.warning(f"Upsert failed, using manual approach: {upsert_error}")

                # Check if feedback already exists
                existing = self.client.table("feedback").select("*").eq("message_id", message_id).eq("user_id", user_id).execute()

                if existing.data and len(existing.data) > 0:
                    # Update existing feedback
                    feedback_id = existing.data[0]["id"]
                    update_data = {
                        "success": success,
                        "reason": rating
                    }

                    result = self.client.table("feedback").update(update_data).eq("id", feedback_id).execute()
                    logger.info(f"Updated existing feedback record: {feedback_id} with rating: {rating}")
                else:
                    # Create new feedback
                    from uuid import uuid4
                    feedback_data = {
                        "id": str(uuid4()),
                        "message_id": message_id,
                        "user_id": user_id,
                        "success": success,
                        "reason": rating
                    }

                    result = self.client.table("feedback").insert(feedback_data).execute()
                    logger.info(f"Created new feedback record: {feedback_data.get('id')} with rating: {rating}")

            if result.data:
                return result.data[0]
            else:
                raise Exception("Failed to create/update feedback record")

        except Exception as e:
            logger.error(f"Error creating/updating feedback: {e}")
            raise

    async def delete_feedback(self, message_id: str, user_id: str) -> bool:
        """Delete feedback record for a specific message and user."""
        if not self.client:
            raise Exception("Supabase client not initialized")

        try:
            result = self.client.table("feedback").delete().eq("message_id", message_id).eq("user_id", user_id).execute()

            if result.data is not None:  # Supabase returns empty list for successful deletes
                logger.info(f"Deleted feedback record for message {message_id}, user {user_id}")
                return True
            else:
                logger.warning(f"No feedback record found for message {message_id}, user {user_id}")
                return False

        except Exception as e:
            logger.error(f"Error deleting feedback: {e}")
            raise

    async def upsert_vector_store_filename(self, vector_store_id: str, vector_store_file_id: str, filename: str) -> None:
        """Upsert mapping of (vector_store_id, vector_store_file_id) to filename.

        This enables reliable filename lookup for vector store files.
        """
        if not self.client:
            return

        try:
            data = {
                "vector_store_id": vector_store_id,
                "vector_store_file_id": vector_store_file_id,
                "filename": filename,
            }
            # Prefer upsert if supported by the table configuration
            try:
                self.client.table("vector_store_file_names").upsert(
                    data,
                    on_conflict="vector_store_id,vector_store_file_id"
                ).execute()
            except Exception:
                # Fallback: try update then insert
                existing = self.client.table("vector_store_file_names").select("id").eq("vector_store_id", vector_store_id).eq("vector_store_file_id", vector_store_file_id).execute()
                if existing.data:
                    row_id = existing.data[0]["id"]
                    self.client.table("vector_store_file_names").update({"filename": filename}).eq("id", row_id).execute()
                else:
                    self.client.table("vector_store_file_names").insert(data).execute()
        except Exception as e:
            logger.warning(f"Failed to upsert vector store filename mapping: {e}")

    async def get_vector_store_filename_map(self, vector_store_id: str) -> dict:
        """Return a dict mapping vector_store_file_id -> filename for a given vector store."""
        if not self.client:
            return {}
        try:
            result = self.client.table("vector_store_file_names").select("vector_store_file_id,filename").eq("vector_store_id", vector_store_id).execute()
            mapping = {}
            if result.data:
                for row in result.data:
                    mapping[row.get("vector_store_file_id")] = row.get("filename")
            return mapping
        except Exception as e:
            logger.warning(f"Failed to load vector store filename mappings: {e}")
            return {}

    async def get_admin_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get admin user by email."""
        if not self.client:
            raise Exception("Supabase client not initialized")

        try:
            result = self.client.table("admin_users").select("*").eq("email", email).single().execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Error fetching admin user by email: {e}")
            return None

    async def get_admin_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get admin user by ID."""
        if not self.client:
            raise Exception("Supabase client not initialized")

        try:
            result = self.client.table("admin_users").select("*").eq("id", user_id).single().execute()
            return result.data if result.data else None
        except Exception as e:
            logger.error(f"Error fetching admin user by ID: {e}")
            return None

    async def get_admin_settings(self, id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Get the single admin settings row (system_prompt, help_text, about_text)."""
        if not self.client:
            raise Exception("Supabase client not initialized")

        try:
            query = self.client.table("admin_settings").select("*")
            if id:
                query = query.eq("id", id)
            else:
                # For backward compatibility, get the first row if no id specified
                query = query.limit(1)
            result = query.execute()
            if result.data and len(result.data) > 0:
                return result.data[0]
            # If no settings row exists, return defaults (do not insert on read)
            return {"system_prompt": "", "help_text": "", "about_text": "", "vector_id": ""}
        except Exception as e:
            logger.error(f"Error fetching admin settings: {e}")
            raise

    async def get_admin_settings_updated_at(self) -> Optional[str]:
        """Get only the updated_at field for lightweight polling."""
        if not self.client:
            raise Exception("Supabase client not initialized")
        try:
            result = self.client.table("admin_settings").select("updated_at").limit(1).execute()
            if result.data and len(result.data) > 0:
                return result.data[0].get("updated_at")
            return None
        except Exception as e:
            logger.error(f"Error fetching admin settings updated_at: {e}")
            return None

    async def upsert_admin_settings(self, system_prompt: str, help_text: str, about_text: str, vector_id: Optional[str] = None, id: Optional[int] = None) -> Dict[str, Any]:
        """Create or update the admin settings row by id."""
        if not self.client:
            raise Exception("Supabase client not initialized")

        try:
            update_data = {
                "system_prompt": system_prompt,
                "help_text": help_text,
                "about_text": about_text,
            }
            if vector_id is not None:
                update_data["vector_id"] = vector_id
            
            if id:
                # Update existing row by id
                updated = self.client.table("admin_settings").update(update_data).eq("id", id).execute()
                if updated.data and len(updated.data) > 0:
                    return updated.data[0]
                raise Exception(f"Settings row with id {id} not found")
            else:
                # For backward compatibility, update the first row if no id specified
                existing = self.client.table("admin_settings").select("*").limit(1).execute()
                if existing.data and len(existing.data) > 0:
                    row = existing.data[0]
                    updated = self.client.table("admin_settings").update(update_data).eq("id", row.get("id")).execute()
                    return updated.data[0] if updated.data else {**row, **update_data}
                else:
                    # Insert new row
                    created = self.client.table("admin_settings").insert(update_data).execute()
                    if created.data and len(created.data) > 0:
                        return created.data[0]
                    return update_data
        except Exception as e:
            logger.error(f"Error upserting admin settings: {e}")
            raise


# Global client instance
supabase_client = SupabaseClient()
