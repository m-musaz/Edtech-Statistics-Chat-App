"""Admin authentication endpoints."""

from fastapi import APIRouter, HTTPException, Request, Response, Query, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional

from ...core.logging import get_logger
from ...database.client import supabase_client
from ...core.jwt_utils import create_jwt_token
from ...services.settings_cache import SettingsCache
from ...core.config import settings

logger = get_logger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def admin_login(request: AdminLoginRequest, response: Response):
    """Admin login endpoint."""
    try:
        import bcrypt

        # Get admin user by email
        admin_user = await supabase_client.get_admin_user_by_email(request.email)

        if not admin_user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Verify password
        if not bcrypt.checkpw(request.password.encode('utf-8'), admin_user['password'].encode('utf-8')):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Create JWT payload with admin flag
        payload = {
            'uid': admin_user['id'],
            'email': admin_user['email'],
            'is_admin': True,
            'user_agent_hash': ''  # Could add user agent hashing if needed
        }

        # Create JWT token
        jwt_token = create_jwt_token(payload)

        # Set secure HTTP-only cookie (same as regular user sessions)
        response.set_cookie(
            key="sess",
            value=jwt_token,
            max_age=31536000,  # 1 year
            httponly=True,
            secure=True,  # HTTPS only in production
            samesite="none"
        )

        logger.info(f"Admin login successful for: {request.email}")

        return {
            "message": "Login successful",
            "user": {
                "id": admin_user['id'],
                "email": admin_user['email'],
                "is_admin": True
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin login failed: {e}")
        raise HTTPException(status_code=500, detail="Login failed")


@router.get("/verify")
async def verify_admin(request: Request):
    """Verify admin JWT token."""
    try:
        from ...core.jwt_utils import verify_jwt_token

        # Get JWT token from cookie
        session_cookie = request.cookies.get("sess")

        if not session_cookie:
            raise HTTPException(status_code=401, detail="No session found")

        # Verify JWT token
        try:
            payload = verify_jwt_token(session_cookie)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        # Check if user is admin
        if not payload.get('is_admin'):
            raise HTTPException(status_code=403, detail="Admin access required")

        # Get current admin user data
        admin_user = await supabase_client.get_admin_user_by_id(payload.get('uid'))

        if not admin_user:
            raise HTTPException(status_code=401, detail="Admin user not found")

        return {
            "user": {
                "id": admin_user['id'],
                "email": admin_user['email'],
                "is_admin": True
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin verification failed: {e}")
        raise HTTPException(status_code=401, detail="Verification failed")


@router.post("/logout")
async def admin_logout(response: Response):
    """Admin logout endpoint."""
    # Clear the session cookie
    response.delete_cookie(key="sess")
    return {"message": "Logout successful"}


class AdminSettingsUpdate(BaseModel):
    system_prompt: str
    help_text: str
    about_text: str
    id: Optional[int] = None


def _require_admin(request: Request):
    from ...core.jwt_utils import verify_jwt_token
    session_cookie = request.cookies.get("sess")
    if not session_cookie:
        raise HTTPException(status_code=401, detail="No session found")
    try:
        payload = verify_jwt_token(session_cookie)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not payload.get('is_admin'):
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload


@router.get("/settings")
async def get_admin_settings(request: Request):
    """Return admin settings (system_prompt, help_text, about_text, vector_id). Admin only."""
    _require_admin(request)
    try:
        # Read id parameter directly from query string to avoid Python built-in conflict
        id_param = request.query_params.get("id")
        settings_id = int(id_param) if id_param else None
        
        logger.info(f"GET /settings called with id param={id_param}, settings_id={settings_id} (type: {type(settings_id)})")
        query_params = dict(request.query_params)
        logger.info(f"Raw query params: {query_params}")
        
        settings_row = await supabase_client.get_admin_settings(id=settings_id)
        logger.info(f"Settings row returned: id={settings_row.get('id')}, system_prompt length={len(settings_row.get('system_prompt', ''))}")
        return {
            "system_prompt": settings_row.get("system_prompt", ""),
            "help_text": settings_row.get("help_text", ""),
            "about_text": settings_row.get("about_text", ""),
            "vector_id": settings_row.get("vector_id", ""),
        }
    except HTTPException:
        raise
    except ValueError:
        logger.error(f"Invalid id parameter: {request.query_params.get('id')}")
        raise HTTPException(status_code=400, detail="Invalid id parameter")
    except Exception as e:
        logger.error(f"Failed to fetch admin settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch admin settings")


@router.put("/settings")
async def update_admin_settings(request: Request, payload: AdminSettingsUpdate):
    """Update admin settings. Admin only."""
    _require_admin(request)
    try:
        updated = await supabase_client.upsert_admin_settings(
            system_prompt=payload.system_prompt,
            help_text=payload.help_text,
            about_text=payload.about_text,
            id=payload.id,
        )
        # Write-through cache update
        try:
            SettingsCache.set_system_prompt(updated.get("system_prompt", ""), updated.get("updated_at"))
        except Exception:
            pass
        return {
            "system_prompt": updated.get("system_prompt", ""),
            "help_text": updated.get("help_text", ""),
            "about_text": updated.get("about_text", ""),
            "vector_id": updated.get("vector_id", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update admin settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to update admin settings")


@router.get("/help-text")
async def get_public_help_text():
    """Public endpoint to fetch help_text for user HelpModal (no auth)."""
    try:
        settings_row = await supabase_client.get_admin_settings()
        return {"help_text": settings_row.get("help_text", "")}
    except Exception as e:
        logger.error(f"Failed to fetch public help text: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch help text")


@router.get("/about-text")
async def get_public_about_text():
    """Public endpoint to fetch about_text for user About page (no auth)."""
    try:
        settings_row = await supabase_client.get_admin_settings()
        return {"about_text": settings_row.get("about_text", "")}
    except Exception as e:
        logger.error(f"Failed to fetch public about text: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch about text")


@router.get("/vector-store-files")
async def get_vector_store_files(
    request: Request,
    settings_id: Optional[int] = Query(None, alias="id", description="Settings id: 1 for Control Chart Generator, 2 for Planned Experiment Generator"),
    after: Optional[str] = Query(None, description="A cursor for use in pagination"),
    before: Optional[str] = Query(None, description="A cursor for use in pagination"),
    filter_status: Optional[str] = Query(None, description="Filter by file status", regex="^(in_progress|completed|failed|cancelled)$"),
    limit: Optional[int] = Query(20, description="Limit on number of objects returned", ge=1, le=100),
    order: Optional[str] = Query("desc", description="Sort order", regex="^(asc|desc)$")
):
    """Get list of files in the OpenAI vector store. Admin only."""
    _require_admin(request)

    try:
        from openai import AsyncOpenAI

        # Get vector_store_id from database settings
        if settings_id is None:
            raise HTTPException(status_code=400, detail="settings_id is required")
        
        admin_settings = await supabase_client.get_admin_settings(id=settings_id)
        vector_store_id = admin_settings.get("vector_id") if admin_settings else None

        if not vector_store_id:
            logger.warning(f"Vector store ID not configured for settings_id={settings_id}, returning empty result")
            return {
                "data": [],
                "object": "list",
                "first_id": None,
                "last_id": None,
                "has_more": False
            }

        if not settings.openai_api_key:
            logger.warning("OpenAI API key not configured, returning empty result")
            return {
                "data": [],
                "object": "list",
                "first_id": None,
                "last_id": None,
                "has_more": False
            }

        client = AsyncOpenAI(api_key=settings.openai_api_key)

        # Prepare query parameters
        query_params = {
            "limit": limit,
            "order": order
        }

        if after:
            query_params["after"] = after
        if before:
            query_params["before"] = before
        if filter_status:
            query_params["filter"] = filter_status

        # Call OpenAI API to list vector store files
        vector_store_files = await client.vector_stores.files.list(
            vector_store_id=vector_store_id,
            **query_params
        )

        # Load filename mapping from DB
        filename_map = await supabase_client.get_vector_store_filename_map(vector_store_id)

        # Build response using attributes/metadata.filename set at upload time, preferring DB mapping
        enriched = []
        for f in vector_store_files.data:
            metadata = getattr(f, "metadata", None) or (f.get("metadata") if isinstance(f, dict) else None)
            attributes = getattr(f, "attributes", None) or (f.get("attributes") if isinstance(f, dict) else None)
            filename = None
            file_id = getattr(f, "file_id", None) or (f.get("file_id") if isinstance(f, dict) else None)

            # Prefer DB mapping if available
            vs_file_id = getattr(f, "id", None) or (f.get("id") if isinstance(f, dict) else None)
            if vs_file_id and filename_map.get(vs_file_id):
                filename = filename_map.get(vs_file_id)
            # Next prefer attributes
            elif isinstance(attributes, dict) and attributes.get("filename"):
                filename = attributes.get("filename")
            # Then metadata
            elif isinstance(metadata, dict) and metadata.get("filename"):
                filename = metadata.get("filename")
            # Last resort: look up file metadata from Files API
            elif file_id:
                try:
                    file_obj = await client.files.retrieve(file_id)
                    filename = getattr(file_obj, "filename", None) or (file_obj.get("filename") if isinstance(file_obj, dict) else None)
                except Exception:
                    filename = None

            enriched.append({
                "id": getattr(f, "id", None) or (f.get("id") if isinstance(f, dict) else None),
                "object": getattr(f, "object", None) or (f.get("object") if isinstance(f, dict) else None),
                "created_at": getattr(f, "created_at", None) or (f.get("created_at") if isinstance(f, dict) else None),
                "vector_store_id": getattr(f, "vector_store_id", None) or (f.get("vector_store_id") if isinstance(f, dict) else None),
                "status": getattr(f, "status", None) or (f.get("status") if isinstance(f, dict) else None),
                "chunking_strategy": getattr(f, "chunking_strategy", None) or (f.get("chunking_strategy") if isinstance(f, dict) else None),
                "file_id": getattr(f, "file_id", None) or (f.get("file_id") if isinstance(f, dict) else None),
                "filename": filename,
            })

        return {
            "data": enriched,
            "object": getattr(vector_store_files, "object", None),
            "first_id": getattr(vector_store_files, "first_id", None),
            "last_id": getattr(vector_store_files, "last_id", None),
            "has_more": getattr(vector_store_files, "has_more", False)
        }

    except Exception as e:
        logger.error(f"Failed to fetch vector store files: {e}")
        # Return empty result instead of throwing error for better UX
        return {
            "data": [],
            "object": "list",
            "first_id": None,
            "last_id": None,
            "has_more": False
        }


@router.post("/vector-store-files")
async def add_vector_store_file(
    request: Request,
    file: UploadFile = File(...),
    purpose: str = Form(default="assistants"),
    settings_id: Optional[int] = Form(None, alias="id", description="Settings id: 1 for Control Chart Generator, 2 for Planned Experiment Generator")
):
    """Add a file to the OpenAI vector store. Admin only."""
    _require_admin(request)

    try:
        from openai import AsyncOpenAI

        # Get vector_store_id from database settings
        if settings_id is None:
            raise HTTPException(status_code=400, detail="settings_id is required")
        
        admin_settings = await supabase_client.get_admin_settings(id=settings_id)
        vector_store_id = admin_settings.get("vector_id") if admin_settings else None

        if not vector_store_id:
            raise HTTPException(status_code=400, detail="Vector store ID not configured for this settings")

        if not settings.openai_api_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured")

        client = AsyncOpenAI(api_key=settings.openai_api_key)

        # Read file content
        file_content = await file.read()

        # Upload file to OpenAI
        uploaded_file = await client.files.create(
            file=(file.filename, file_content, file.content_type or "text/plain"),
            purpose=purpose
        )

        # Add file to vector store with attributes for filename if supported
        vector_store_file = await client.vector_stores.files.create(
            vector_store_id=vector_store_id,
            file_id=uploaded_file.id,
            attributes={"filename": file.filename}
        )

        # Store filename mapping in DB for reliability
        try:
            await supabase_client.upsert_vector_store_filename(
                vector_store_id=vector_store_id,
                vector_store_file_id=vector_store_file.id,
                filename=file.filename,
            )
        except Exception:
            pass

        logger.info(f"Added file {file.filename} to vector store: {vector_store_file.id}")

        return {
            "id": vector_store_file.id,
            "object": vector_store_file.object,
            "created_at": vector_store_file.created_at,
            "vector_store_id": vector_store_file.vector_store_id,
            "status": vector_store_file.status,
            "filename": file.filename
        }

    except Exception as e:
        logger.error(f"Failed to add file to vector store: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add file to vector store: {str(e)}")


@router.delete("/vector-store-files/{file_id}")
async def delete_vector_store_file(
    request: Request,
    file_id: str,
    settings_id: Optional[int] = Query(None, alias="id", description="Settings id: 1 for Control Chart Generator, 2 for Planned Experiment Generator")
):
    """Delete a file from the OpenAI vector store. Admin only."""
    _require_admin(request)

    try:
        from openai import AsyncOpenAI

        # Get vector_store_id from database settings
        if settings_id is None:
            raise HTTPException(status_code=400, detail="settings_id is required")
        
        admin_settings = await supabase_client.get_admin_settings(id=settings_id)
        vector_store_id = admin_settings.get("vector_id") if admin_settings else None

        if not vector_store_id:
            raise HTTPException(status_code=400, detail="Vector store ID not configured for this settings")

        if not settings.openai_api_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured")

        client = AsyncOpenAI(api_key=settings.openai_api_key)

        # Delete file from vector store
        await client.vector_stores.files.delete(
            vector_store_id=vector_store_id,
            file_id=file_id
        )

        logger.info(f"Deleted file {file_id} from vector store")

        return {"message": f"File {file_id} deleted successfully"}

    except Exception as e:
        logger.error(f"Failed to delete file from vector store: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file from vector store: {str(e)}")


@router.get("/vector-store")
async def get_vector_store_info(request: Request, settings_id: Optional[int] = Query(None, alias="id", description="Settings id: 1 for Control Chart Generator, 2 for Planned Experiment Generator")):
    """Get vector store metadata like name, created_at, updated_at (if available), file_count, and total bytes used. Admin only."""
    _require_admin(request)

    try:
        from openai import AsyncOpenAI

        # Get vector_store_id from database settings
        if settings_id is None:
            raise HTTPException(status_code=400, detail="settings_id is required")
        
        admin_settings = await supabase_client.get_admin_settings(id=settings_id)
        vector_store_id = admin_settings.get("vector_id") if admin_settings else None

        if not vector_store_id:
            raise HTTPException(status_code=400, detail="Vector store ID not configured for this settings")

        if not settings.openai_api_key:
            raise HTTPException(status_code=400, detail="OpenAI API key not configured")

        client = AsyncOpenAI(api_key=settings.openai_api_key)

        # Retrieve vector store details
        vs = await client.vector_stores.retrieve(vector_store_id)

        # Best-effort compute total bytes and file_count
        total_bytes = 0
        file_count = 0
        has_more = True
        after_cursor = None
        # Paginate through files in batches to accumulate sizes
        while has_more:
            params = {"limit": 100, "order": "desc"}
            if after_cursor:
                params["after"] = after_cursor
            files_page = await client.vector_stores.files.list(vector_store_id=vector_store_id, **params)
            page_data = getattr(files_page, "data", [])
            file_count += len(page_data)
            for f in page_data:
                try:
                    file_id = getattr(f, "file_id", None) or (f.get("file_id") if isinstance(f, dict) else None)
                    if file_id:
                        file_obj = await client.files.retrieve(file_id)
                        file_bytes = getattr(file_obj, "bytes", None) or (file_obj.get("bytes") if isinstance(file_obj, dict) else 0)
                        total_bytes += int(file_bytes or 0)
                except Exception:
                    # Skip if any file retrieval fails
                    pass

            has_more = bool(getattr(files_page, "has_more", False))
            after_cursor = getattr(files_page, "last_id", None)

        return {
            "id": getattr(vs, "id", None) or (vs.get("id") if isinstance(vs, dict) else None),
            "object": getattr(vs, "object", None) or (vs.get("object") if isinstance(vs, dict) else None),
            "name": getattr(vs, "name", None) or (vs.get("name") if isinstance(vs, dict) else None),
            "created_at": getattr(vs, "created_at", None) or (vs.get("created_at") if isinstance(vs, dict) else None),
            "updated_at": getattr(vs, "updated_at", None) or (vs.get("updated_at") if isinstance(vs, dict) else None),
            "file_count": file_count,
            "total_bytes": total_bytes,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch vector store info: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch vector store info")


