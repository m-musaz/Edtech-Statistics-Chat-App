"""Process-local cache for admin settings (system_prompt only).

Provides:
- Warm cache at startup
- TTL-based refresh guard
- Light polling of updated_at to detect external changes
- Write-through on admin update
- Support for multiple equipment types (control/plan)
"""

from __future__ import annotations

import asyncio
import time
from typing import Optional, Dict

from ..database.client import supabase_client
from ..core.logging import get_logger

logger = get_logger(__name__)

# Mapping of equipment_type to admin_settings id
EQUIPMENT_TYPE_TO_ID: Dict[str, int] = {
    "control": 1,
    "plan": 2,
}


class SettingsCache:
    # Cached fields - now keyed by equipment_type
    _settings_by_type: Dict[str, Dict[str, Optional[str]]] = {}
    _last_refresh_by_type: Dict[str, float] = {}

    # Config
    _ttl_seconds: int = 600  # 10 minutes
    _poll_interval_seconds: int = 60  # light poll cadence

    # Concurrency guard
    _lock: asyncio.Lock = asyncio.Lock()
    _poll_task: Optional[asyncio.Task] = None

    @classmethod
    async def warm(cls) -> None:
        """Warm the cache from database for all equipment types."""
        try:
            for equipment_type in EQUIPMENT_TYPE_TO_ID.keys():
                await cls._refresh_from_db(equipment_type)
            logger.info("SettingsCache warmed for all equipment types")
        except Exception as e:
            logger.error("Failed to warm SettingsCache: %s", e)

    @classmethod
    def get_system_prompt(cls, equipment_type: str = "control") -> Optional[str]:
        settings = cls._settings_by_type.get(equipment_type, {})
        return settings.get("system_prompt")

    @classmethod
    def get_vector_id(cls, equipment_type: str = "control") -> Optional[str]:
        settings = cls._settings_by_type.get(equipment_type, {})
        return settings.get("vector_id")

    @classmethod
    def get_settings(cls, equipment_type: str = "control") -> Dict[str, Optional[str]]:
        """Get all cached settings for an equipment type."""
        return cls._settings_by_type.get(equipment_type, {})

    @classmethod
    def set_settings(cls, equipment_type: str, system_prompt: str, vector_id: Optional[str] = None, updated_at: Optional[str] = None) -> None:
        cls._settings_by_type[equipment_type] = {
            "system_prompt": system_prompt,
            "vector_id": vector_id,
            "updated_at": updated_at,
        }
        cls._last_refresh_by_type[equipment_type] = time.time()

    @classmethod
    async def refresh_if_stale(cls, equipment_type: str = "control") -> None:
        """Refresh from DB if TTL expired for a specific equipment type."""
        last_refresh = cls._last_refresh_by_type.get(equipment_type, 0.0)
        if (time.time() - last_refresh) < cls._ttl_seconds:
            return
        async with cls._lock:
            last_refresh = cls._last_refresh_by_type.get(equipment_type, 0.0)
            if (time.time() - last_refresh) < cls._ttl_seconds:
                return
            print(f"Refreshing settings for {equipment_type}")
            await cls._refresh_from_db(equipment_type)

    @classmethod
    async def _refresh_from_db(cls, equipment_type: str = "control") -> None:
        settings_id = EQUIPMENT_TYPE_TO_ID.get(equipment_type, 1)
        print(f"Refreshing settings for {equipment_type} with settings_id = {settings_id}")
        row = await supabase_client.get_admin_settings(id=settings_id)
        system_prompt = (row or {}).get("system_prompt", "")
        vector_id = (row or {}).get("vector_id", "")
        updated_at = (row or {}).get("updated_at")
        cls.set_settings(equipment_type, system_prompt, vector_id, updated_at)
        logger.debug(f"Refreshed settings for {equipment_type}: prompt_len={len(system_prompt)}, vector_id={vector_id}")

    @classmethod
    async def _poll_updated_at(cls) -> None:
        """Background task to lightly poll updated_at and refresh if changed."""
        while True:
            try:
                await asyncio.sleep(cls._poll_interval_seconds)
                # Poll all equipment types
                for equipment_type in EQUIPMENT_TYPE_TO_ID.keys():
                    settings = cls._settings_by_type.get(equipment_type, {})
                    cached_updated_at = settings.get("updated_at")
                    settings_id = EQUIPMENT_TYPE_TO_ID[equipment_type]
                    row = await supabase_client.get_admin_settings(id=settings_id)
                    new_updated_at = (row or {}).get("updated_at")
                    if new_updated_at and new_updated_at != cached_updated_at:
                        logger.info(f"Detected settings change for {equipment_type}; refreshing cache")
                        await cls._refresh_from_db(equipment_type)
            except Exception as e:
                logger.error("SettingsCache polling error: %s", e)

    @classmethod
    def start_polling(cls) -> None:
        if cls._poll_task is None or cls._poll_task.done():
            cls._poll_task = asyncio.create_task(cls._poll_updated_at())


