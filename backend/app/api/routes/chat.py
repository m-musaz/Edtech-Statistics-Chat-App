"""Chat and messaging endpoints."""

from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Request, Response, BackgroundTasks
from fastapi.responses import StreamingResponse

from ...core.logging import get_logger
from ...core.config import settings
from ...services.chat_service import get_chat_response, upload_file_for_user_data
from ...services.analytics_service import AnalyticsService
from ...database.client import supabase_client
from ...core.jwt_utils import create_jwt_token, verify_jwt_token, create_session_payload

logger = get_logger(__name__)

router = APIRouter(tags=["chat"])

@router.get("/")
async def root() -> dict:
    logger.debug("Root endpoint requested")
    return {"message": "HTHGSE Shewhart Chatbot API"}


@router.post("/upload-file")
async def upload_file(
    file: UploadFile | None = File(None),
):
    """Upload file endpoint."""
    logger.debug("Upload file request received")

    if file is None:
        raise HTTPException(status_code=400, detail="No file provided")

    # Validate file size against config setting
    # Read file content for validation
    file_content = await file.read()
    file_size = len(file_content)

    if file_size > settings.max_file_size:
        max_size_mb = settings.max_file_size / (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum file size is {max_size_mb:.0f}MB (OpenAI limit for CSV/spreadsheet files)."
        )

    # Reset file pointer so it can be read again in upload_file_for_user_data
    await file.seek(0)

    return await upload_file_for_user_data(file)


@router.post("/chat")
async def chat(
    background_tasks: BackgroundTasks,
    request: Request,
    response: Response,
    user_message: str = Form(...),
    user_id: str | None = Form(None),
    thread_id: str | None = Form(None),
    previous_response_id: str | None = Form(None),
    existing_file_id: str | None = Form(None),
    file_name: str | None = Form(None),
    stream: bool = Form(False),
    experiment_type: str = Form("control"),
):
    """Chat endpoint with analytics tracking."""
    logger.debug("Chat request received")

    try:
        # Check for existing session cookie first
        session_cookie = request.cookies.get("sess")
        cookie_user_id = None
        is_admin_session = False

        if session_cookie:
            try:
                # Verify JWT token and extract user_id
                payload = verify_jwt_token(session_cookie)
                cookie_user_id = payload.get("uid")
                is_admin_session = payload.get("is_admin", False)
                logger.info(f"Found existing session for user_id: {cookie_user_id}, is_admin: {is_admin_session}")
            except Exception as e:
                logger.warning(f"Invalid session cookie: {e}")
                cookie_user_id = None
                is_admin_session = False

        # Track if we need to set a cookie for streaming response
        need_to_set_cookie = False
        cookie_payload = None
        
        # If admin user is accessing chat, create new regular user session
        if is_admin_session:
            from uuid import uuid4
            user_id = str(uuid4())
            logger.info(f"Admin accessing chat - creating new regular user session: {user_id}")

            # Create regular user JWT token (no is_admin flag)
            user_agent = request.headers.get("user-agent", "")
            cookie_payload = create_session_payload(user_id, user_agent)
            jwt_token = create_jwt_token(cookie_payload)
            need_to_set_cookie = True

            response.set_cookie(
                key="sess",
                value=jwt_token,
                max_age=31536000,  # 1 year
                httponly=True,
                secure=True,  # HTTPS only in production
                samesite="none"
            )
            logger.info(f"Replaced admin session with regular user session: {user_id}")
        
        # Use cookie user_id if available (and not admin), otherwise use provided user_id, otherwise generate new
        elif cookie_user_id:
            user_id = cookie_user_id
            logger.info(f"Using user_id from session cookie: {user_id}")
        elif user_id:
            logger.info(f"Using provided user_id: {user_id}")
        else:
            # Generate new user_id and create session cookie
            from uuid import uuid4
            user_id = str(uuid4())
            logger.info(f"Generated new user_id: {user_id}")

            # Create JWT token and set secure cookie
            user_agent = request.headers.get("user-agent", "")
            cookie_payload = create_session_payload(user_id, user_agent)
            jwt_token = create_jwt_token(cookie_payload)
            need_to_set_cookie = True

            response.set_cookie(
                key="sess",
                value=jwt_token,
                max_age=31536000,  # 1 year
                httponly=True,
                secure=True,  # HTTPS only in production
                samesite="none"
            )
            logger.info(f"Set session cookie for new user_id: {user_id}")

        # Map experiment_type to admin_settings_id
        admin_settings_id = 1 if experiment_type == "control" else 2

        # Get or create thread
        final_thread_id = await AnalyticsService.get_or_create_thread(
            user_id=user_id,
            thread_id=thread_id,
            admin_settings_id=admin_settings_id
        )
        # Prepare file names and IDs for background job
        file_names = []
        file_ids = []
        # Only store file metadata when file_name is provided (new upload)
        if existing_file_id and file_name:
            print("New file upload - storing metadata")
            file_names = [file_name]
            file_ids = [existing_file_id]
        elif existing_file_id:
            print("Using existing file for context - not storing metadata")

        user_message_id = await AnalyticsService.create_user_message(
            thread_id=final_thread_id,
            auth_user_id=user_id,
            user_message=user_message,
            file_names=file_names,
            file_ids=file_ids
        )

        previous_output = None

        chat_response = await get_chat_response(
            user_message=user_message,
            background_tasks=background_tasks,
            previous_output=previous_output,
            file_id=existing_file_id,
            stream=stream,
            previous_response_id=previous_response_id,
            thread_id=final_thread_id,
            user_id=user_id,
            file_names=file_names,
            experiment_type=experiment_type,
        )

        if stream:
            # Create StreamingResponse (SSE). Ensure proper headers for SSE over some proxies/CDNs.
            streaming_response = StreamingResponse(chat_response, media_type="text/event-stream")
            streaming_response.headers["Cache-Control"] = "no-cache"
            streaming_response.headers["Connection"] = "keep-alive"
            streaming_response.headers["X-Accel-Buffering"] = "no"  # Disable nginx buffering if present
            
            # Set cookie on streaming response if needed
            if need_to_set_cookie and cookie_payload:
                jwt_token = create_jwt_token(cookie_payload)
                streaming_response.set_cookie(
                    key="sess",
                    value=jwt_token,
                    max_age=31536000,  # 1 year
                    httponly=True,
                    secure=True,  # HTTPS only in production
                    samesite="none"
                )
            
            return streaming_response
        else:
            # Add thread_id and message_id to response for client
            chat_response["thread_id"] = final_thread_id
            chat_response["user_id"] = user_id
            # Get the assistant message_id from the response if available
            if "message_id" in chat_response:
                chat_response["assistant_message_id"] = chat_response["message_id"]
            return chat_response

    except Exception as e:
        logger.error("Chat request failed: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Chat request failed") from e


@router.get("/threads/{user_id}")
async def get_user_threads(user_id: str):
    """Get all threads for a user."""
    if not supabase_client.client:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        result = supabase_client.client.table("threads").select("*").eq("user_id", user_id).order("updated_at", desc=True).execute()
        return {"threads": result.data}
    except Exception as e:
        logger.error(f"Error fetching threads: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch threads") from e


@router.post("/threads/{thread_id}/messages")
async def get_thread_messages(request: Request, thread_id: str):
    """Get all messages for a thread (with user verification)."""
    try:
        # Get user from session cookie
        session_cookie = request.cookies.get("sess")
        if not session_cookie:
            raise HTTPException(status_code=401, detail="No session found")

        payload = verify_jwt_token(session_cookie)
        user_id = payload.get("uid")
        actual_user_id = await AnalyticsService._ensure_user_exists(user_id)

        # Verify user owns the thread
        thread = await supabase_client.get_thread(thread_id)
        if not thread or thread["user_id"] != actual_user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Get thread messages with feedback
        # Join messages with feedback table to get user's success data
        result = supabase_client.client.table("messages").select(
            "*, feedback!message_id(success, user_id)"
        ).eq("thread_id", thread_id).order("created_at", desc=False).execute()
        
        # Process the data to flatten feedback and handle null values
        processed_messages = []
        for msg in result.data:
            # Extract feedback data from joined table for current user only
            success_data = None
            
            if msg.get("feedback") and len(msg["feedback"]) > 0:
                # Find feedback from the current user
                user_feedback = None
                for feedback_record in msg["feedback"]:
                    if feedback_record.get("user_id") == actual_user_id:
                        user_feedback = feedback_record
                        break
                
                if user_feedback:
                    success_data = user_feedback.get("success")  # true/false or None
            
            # Create processed message with flattened feedback fields
            processed_msg = {
                **msg,
                "rating": "thumbs_up" if success_data is True else "thumbs_down" if success_data is False else None,
                "rating_success": success_data,  # null if no feedback, else true/false
            }
            # Remove the nested feedback array
            processed_msg.pop("feedback", None)
            processed_messages.append(processed_msg)
        
        return {"messages": processed_messages}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch messages") from e


@router.get("/analytics/{message_id}")
async def get_message_analytics(message_id: str):
    """Get analytics for a specific message."""
    if not supabase_client.client:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        result = supabase_client.client.table("analytics").select("*").eq("message_id", message_id).execute()
        if result.data:
            return {"analytics": result.data[0]}
        else:
            raise HTTPException(status_code=404, detail="Analytics not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch analytics") from e


@router.post("/logout")
async def logout(response: Response):
    """Logout endpoint that clears session cookie."""
    try:
        # Clear the session cookie
        response.delete_cookie(
            key="sess",
            httponly=True,
            secure=True,
            samesite="none"
        )
        logger.info("Session cookie cleared - user logged out")
        return {"status": "success", "message": "Logged out successfully"}
    except Exception as e:
        logger.error(f"Logout failed: {e}")
        raise HTTPException(status_code=500, detail="Logout failed") from e


@router.post("/rate")
async def rate_completion(
    request: Request,
    message_id: str = Form(...),
    rating: str = Form(...)
):
    """Rate a completion with thumbs up/down. Updates existing rating if already exists."""
    try:
        # Get user_id from session cookie
        session_cookie = request.cookies.get("sess")
        if not session_cookie:
            raise HTTPException(status_code=401, detail="No session found")

        try:
            payload = verify_jwt_token(session_cookie)
            user_id = payload.get("uid")
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid session")
        except Exception as e:
            logger.warning(f"Invalid session cookie: {e}")
            raise HTTPException(status_code=401, detail="Invalid session")

        # Validate rating
        if rating not in ["thumbs_up", "thumbs_down"]:
            raise HTTPException(status_code=400, detail="Invalid rating. Use 'thumbs_up' or 'thumbs_down'")

        # Ensure user exists in database and get the actual database user ID
        if user_id == "anonymous-user":
            # Use a consistent UUID for anonymous users
            actual_user_id = "00000000-0000-0000-0000-000000000000"
        else:
            actual_user_id = await AnalyticsService._ensure_user_exists(user_id)

        # Convert rating to boolean for success field (thumbs_up = True, thumbs_down = False)
        success = rating == "thumbs_up"

        # Create or update feedback
        feedback_result = await supabase_client.create_feedback(
            message_id=message_id,
            user_id=actual_user_id,
            rating=rating
        )

        logger.info(f"Feedback recorded - Message: {message_id}, User: {actual_user_id}, Rating: {rating}")
        return {"message": "Rating recorded successfully", "feedback": feedback_result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording rating: {e}")
        raise HTTPException(status_code=500, detail="Failed to record rating") from e


@router.post("/threads")
async def get_user_threads(
    request: Request,
    admin_settings_id: int = Form(1),
):
    """Get all threads for the current user filtered by admin_settings_id."""
    try:
        # Get user from session cookie
        session_cookie = request.cookies.get("sess")
        if not session_cookie:
            raise HTTPException(status_code=401, detail="No session found")

        payload = verify_jwt_token(session_cookie)
        user_id = payload.get("uid")
        actual_user_id = await AnalyticsService._ensure_user_exists(user_id)

        # Get threads filtered by admin_settings_id
        result = supabase_client.client.table("threads").select("*").eq("user_id", actual_user_id).eq("admin_settings_id", admin_settings_id).order("updated_at", desc=True).execute()
        return {"threads": result.data}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching threads: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch threads") from e
