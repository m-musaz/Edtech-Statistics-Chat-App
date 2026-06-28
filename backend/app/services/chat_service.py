# backend/app/services/chat_service.py

from openai import AsyncOpenAI
from ..core.config import settings
from fastapi import UploadFile, BackgroundTasks
import json
from copy import deepcopy
import io
import base64
import time
from typing import Dict, Any, Optional, List
from uuid import uuid4
import asyncio

from ..core.logging import get_logger
from ..models.database import AnalyticsData, ChartType, DownloadableFile
from ..services.cost_calculator import CostCalculator
from ..services.analytics_service import AnalyticsService
from ..services.settings_cache import SettingsCache

logger = get_logger(__name__)

client = AsyncOpenAI(api_key=settings.openai_api_key)


async def process_analytics_background_task(analytics_data: AnalyticsData):
    """
    Process analytics in true background - runs AFTER response is sent to user.

    This function handles:
    - Chart type detection
    - Analytics data persistence
    - Thread title updates
    """
    try:
        logger.info(f"Starting background analytics processing for message: {analytics_data.message_id}")

        # Detect chart type from response_dict
        chart_type = await AnalyticsService.detect_chart_type(analytics_data.assistant_response)
        analytics_data.chart_type = chart_type

        print("detected chart_type = ",chart_type)

        # Persist analytics data
        await AnalyticsService.persist_analytics_data(analytics_data)

        # Update thread title if needed (only for first message in thread)
        await AnalyticsService.update_thread_title_if_needed(
            str(analytics_data.thread_id),
            analytics_data.user_message
        )

        logger.info(f"✅ Background analytics processing completed for message: {analytics_data.message_id}")

    except Exception as e:
        logger.error(f"❌ Background analytics processing failed for message {analytics_data.message_id}: {e}")
        # Don't re-raise - background task failures shouldn't affect user experience

async def upload_file_for_user_data(file: UploadFile) -> str:
    file_content = await file.read()
    in_memory_file = io.BytesIO(file_content)
    uploaded_file = await client.files.create(
        file=(file.filename, in_memory_file),
        purpose="user_data",
        expires_after={
            "anchor": "created_at",
            "seconds": 172800
        }
    )
    return uploaded_file.id

def _get_history_for_input(output_items: list) -> list:
    """
    Filters the previous turn's output to create a clean conversational history.
    It finds the final assistant message, which summarizes the turn's outcome.
    """
    history = []
    # Find the last message from the assistant in the previous turn's output
    for item in reversed(output_items):
        if item.get("type") == "message" and item.get("role") == "assistant":
            # This is the only part of the history we need for the next turn.
            assistant_message = {
                "role": "assistant",
                "content": item.get("content")
            }
            history.append(assistant_message)
            break
    return history

async def get_chat_response(
    user_message: str,
    background_tasks: BackgroundTasks,
    previous_output: list | None = None,
    file_id: str | None = None,
    stream: bool = False,
    system_prompt: str | None = None,
    previous_response_id: str| None = None,
    thread_id: str | None = None,
    user_id: str | None = None,
    file_names: List[str] | None = None,
    experiment_type: str = "control",
):
    """Gets a chat response from the OpenAI API with analytics tracking."""
    # Start timing for latency measurement
    start_time = time.time()

    # Default values
    if file_names is None:
        file_names = []

    instructions = """
Overview
You are a statistician and continuous improvement expert helping educators analyze and
visualize data using control charts. ALWAYS USE THE Health Care Data Guide that you can find using file search tool which gives details
how you should advise educators to conduct data analysis. Your specialty is in creating accurate
control charts using data they have uploaded. Whenever a user's request is ambiguous,
incomplete, or could be interpreted in multiple ways, pause and ask a clear follow‑up question
instead of guessing. Treat the conversation as a joint problem‑solving session.
What to do
1. File Input and Verification
Read the Data: When a file is uploaded, detect the file format (e.g., CSV, Excel, text) and parse
the data. Randomly select up to twenty rows from the data. This ensures that a diverse range of
observations is represented and prevents misinterpretation from only examining a particular
section of the dataset. Be sure to read the data in using Python and display this in the code
interpreter.
Verify Structure: Check that the dataset includes column headers and that the data are arranged
either as time series, subgroups, or individual observations. Be sure to remind the user to not
upload data with student identifiers or any personally identifiable information (PII)
Standardize Column Names:
Remove any extra spaces from column names to ensure consistency and avoid errors during
computations.
Date Field:
If the dataset contains a date field including day, month, year etc reformat as a data field using
Python within the code interpreter. If you are unsure of the data field format ask the user before
reformatting.
Learning Question:
Ask the user about their learning questions. What questions are they hoping to answer with this
analysis? \
2. Determine Data Type
Identify Continuous vs. Attribute Data:
Continuous Data: Look for measurements on a numerical scale (e.g., time, weight, financial
values) that may include decimals.
Attribute Data: Look for counts or classifications (e.g., yes/no, conforming/nonconforming,
number of defects or errors).
Clarify Ambiguities: If the data type is unclear, ask the user to confirm the nature of the
measurement. \
3. Select the Appropriate Control Chart or Run Chart
For Continuous Data:
X‑Bar/S Chart: Use when the data can be organized into rational subgroups (i.e., each subgroup
contains multiple measurements) to analyze both subgroup averages and within‐subgroup
variation.
I Chart: Use when subgrouping isn’t practical (e.g., infrequent measurements or only one
observation per time period).
For Attribute Data:
P Chart: Use when each unit is classified into one of two categories, and even if subgroup sizes
vary.
C Chart: Use when counting the total number of incidents in a fixed, constant area of
opportunity.
U Chart: Use when the area of opportunity varies from subgroup to subgroup (e.g., varying
patient days).
T Chart: Use for rare events (when over 25% of the subgroups have zero incidents), as it plots
the time between events.
Suggest a Run Chart when:
Data includes any type of date field including day, month, year etc. There are fewer than 8
observations.
Explain If the data seems well suited to a particular control chart or run chart and what types of
questions this analysis would help answer and how this relates to what the user shared about
their learning questions. Be sure to ask whether this chart makes sense to the user and offer to
answer questions about different control charts or run charts, what types of inquiry each is best
suited to answer, and the necessary data structures to produce that chart. \
4. Data Wrangling and Restructuring
Assess Data Structure: Compare the dataset’s structure with the requirements of the chosen
control chart. For example, X‑Bar/S charts require multiple observations per subgroup, while I
charts require a natural time order of individual data points.
Transform or Aggregate if Needed:
If data are provided at too granular or too high a level (e.g., individual records when subgroup
averages are needed), aggregate the data by a relevant dimension (e.g., by day, week, or
department). If data is in wide format and the user wants a x bar / s chart transform the data to
be in long format. Convert raw counts into percentages or rates (e.g., for P charts) if the data
are not already in that format. If the dataset lacks clear subgroup labels, suggest or
automatically create rational subgroups based on timestamps or other meaningful variables.
When data wrangling is needed please explain to the user what steps you will take to wrangle
the data to the necessary structure. Be sure to output the transformed data table to the user as
an initial step before producing any charts and ask if the transformed data looks right to the
user. If multiple wrangling options exist, prompt the user to select the preferred method for
restructuring the data. \
6. Code Interpreter Usage
Follow these steps always:
1. ALWAYS Do a File search and find the code for that control chart and the data requirements for that control chart and the working of the control chart.
2. Now from the requirements of the control chart that you got you need to restructure the data to match what is expected by the code. Then execute the code and make the chart.
NEVER ASSUME CHART CODE OR DATA STRUCTURING REQUIREMENTS YOURSELF.ALWAYS FILE SEARCH AND THEN USE CODE INTERPRETER TO GENERATE CHART.
Template Selection:
Once the chart type is determined based on the data characteristics, select the corresponding
Python code template from the knowledge base using file search tool. For example, if a P chart is appropriate,
retrieve the P chart template. Ensure subgroup size or area of opportunity meets the minimum
requirements for the chosen chart type. Use the chart's specific formulas for limit
calculations—each chart has a unique method to account for inherent process variation
When producing any Shewhart chart involving control limits (e.g., X-Bar/S, I, P, U, C), you must:
Calculate the number of observations for each subgroup and control limits using the exact
method specified in the relevant chart template. Do not rely solely on published tables of
constants or assume the same number of observations per subgroup unless explicitly instructed
to.
If subgroup sizes vary for the X Bar/ S, use the log-gamma–based formulas provided in the
template for each subgroup.
When phasing or faceting, recalculate control limits separately for each phase/facet, using their
actual subgroup sizes and exact formulas.
Chart Plotting
When generating the control chart, ensure that:
Every Observation is Labeled. Plot every individual data point with its corresponding label or
marker so that no observation is omitted. Clearly label the central (average) line on the chart.
The final chart should be well-labeled, easy to interpret, and include all computed statistics
alongside every individual data point. Be sure that the legend doesn't obscure any other labels. \
7. Explanation and Next Steps
Provide interpretation of the chart in the context of the learning questions you had previously
generated with the user in an earlier discussion. Recommend that they go observe and talk with
people experiencing special cause variation. See if the user has any other questions, wants a
table of the observations that are in special cause variation, or wants support with additional
analysis. \
8. Optional Additional Analysis
Faceting, Phasing, Freezing, Scan for special-cause signals consult the additional analysis
template \
Guardrails
Always treat control charts as analytic studies, not enumerative ones.
Use control limit formulas that reflect actual data structure and variation.
Avoid shortcuts that assume uniform subgroup sizes
Confirm with the user that this is the type of control chart they want to produce.
Be sure to remind the user to not upload data with student identifiers or any personally
identifiable information (PII)
When data wrangling is needed please explain to the user what steps you will take to wrangle
the data to the necessary structure.
Be sure to output the transformed data table after you have completed wrangling for accuracy
Validate Data Suitability for Suggested Chart:
Before creating any chart, analyze the dataset structure and confirm if it's appropriate for the requested chart type.
If the requested chart type seems incompatible with the data provided (e.g., no categorical data for a P chart, insufficient subgroups for X-Bar charts, or missing required fields), explicitly pause and ask the user to clarify the purpose or whether an alternative chart type might suit their needs better.
Example Questions Before Chart Creation:
Can you confirm the learning question you'd like to answer with this chart?
The data provided does not align with the requirements of the requested chart. Would you like me to suggest alternative visualizations or conduct further data structuring to proceed?
Your data seems appropriate for X type of chart instead. Would you like to explore that option?
"""

    # Fetch settings from cache based on experiment_type
    print(f"experiment_type = {experiment_type}")
    if not system_prompt:
        print("No sys prompt, fetching from cache")
        try:
            await SettingsCache.refresh_if_stale(experiment_type)
        except Exception:
            print(Exception)
        system_prompt = SettingsCache.get_system_prompt(experiment_type)

    # Get vector_id from cache based on experiment_type
    vector_store_id = SettingsCache.get_vector_id(experiment_type) or settings.vector_store_id
    print(f"Using vector_store_id = {vector_store_id} for experiment_type = {experiment_type}")

    if system_prompt:
        print("Loaded from cache", system_prompt[:20], "...")

    tools = [
        {"type": "file_search", "vector_store_ids": [vector_store_id]},
        {"type": "code_interpreter", "container": {"type": "auto"}}
    ]
    request_tools = deepcopy(tools)

    print("file_id4 = ", file_id)
    if file_id:
        print("in fileid")
        if "container" not in request_tools[1]:
            request_tools[1]["container"] = {}
        request_tools[1]["container"]["file_ids"] = [file_id]

    print("previous_response_id = ", previous_response_id)

    response_params = {
        "model": "gpt-5.1-2025-11-13",
        # "model":"gpt-4o-2024-11-20",
        "input": user_message,
        "instructions": instructions if system_prompt is None else system_prompt,
        "tools": request_tools,
        "tool_choice": "auto",
        "parallel_tool_calls": True,
        "include":["code_interpreter_call.outputs"],
        "text": {"verbosity": "low"},
        "reasoning": {"effort": "none"},
        # "reasoning": {"effort": "low"},
        "service_tier": "priority",
    }

    if previous_response_id:
        response_params["previous_response_id"] = previous_response_id

    # Create a copy of response_params without instructions for logging
    params_for_logging = {k: v for k, v in response_params.items() if k != "instructions"}
    # print(f"Sending request to OpenAI with params: {params_for_logging}")
    if stream:
        async def stream_generator():
            first_response = True
            start_time = time.time()
            latency_ms = 0
            # Collected as items complete during streaming
            _ci_logs: list[str] = []
            _ci_image_refs: list[tuple[str, str]] = []  # (file_id, filename)

            while True:
                _ci_logs.clear()
                _ci_image_refs.clear()
                try:
                    async with client.responses.stream(**response_params) as response_stream:
                        async for event in response_stream:
                            event_type = getattr(event, 'type', None)

                            # Capture code interpreter outputs the moment an item finishes
                            if event_type == "response.output_item.done":
                                item = getattr(event, 'item', None)
                                if item is not None:
                                    item_dict = item.model_dump() if hasattr(item, 'model_dump') else {}
                                    if item_dict.get('type') == 'code_interpreter_call':
                                        for out in item_dict.get('outputs') or []:
                                            otype = out.get('type') if isinstance(out, dict) else None
                                            if otype == 'logs':
                                                logs_text = out.get('logs', '')
                                                if logs_text:
                                                    _ci_logs.append(logs_text)
                                                    print(f"  📝 output_item.done: captured {len(logs_text)} chars of logs")
                                            elif otype == 'image':
                                                fid = (out.get('image') or {}).get('file_id')
                                                if fid:
                                                    _ci_image_refs.append((fid, 'chart.png'))
                                                    print(f"  🖼️  output_item.done: image {fid[:20]}...")

                            elif event_type == "response.output_text.delta":
                                delta = getattr(event, 'delta', None)
                                if delta:
                                    if first_response:
                                        first_response = False
                                        end_time = time.time()
                                        latency_ms = int((end_time - start_time) * 1000)

                                    # Stream text delta as SSE JSON event
                                    yield f"data: {json.dumps({'type': 'text', 'data': delta})}\n\n"
                            elif event_type == "response.completed":
                                print("final latency = ",latency_ms)
                                event_response = getattr(event, 'response', {})
                                response_dict = event_response.model_dump()

                                try:
                                    print("\n" + "="*80)
                                    print("🔍 DEBUG: Starting chart data collection")
                                    print("="*80)

                                    # Use outputs collected from response.output_item.done events
                                    container_ids = []
                                    file_refs = list(_ci_image_refs)
                                    code_interpreter_logs = list(_ci_logs)

                                    for item in response_dict.get('output', []):
                                        if item.get('type') == 'code_interpreter_call':
                                            cid = item.get('container_id')
                                            if cid:
                                                container_ids.append(cid)

                                    print(f"\n✅ Containers: {len(container_ids)}, Log blocks: {len(code_interpreter_logs)}, Image refs: {len(file_refs)}")

                                    # 2) Pull file_id(s) from assistant message content - comprehensive search
                                    print(f"\n🔎 Scanning {len(response_dict.get('output', []))} output items for file references...")

                                    output_item_index = 0
                                    for item in response_dict.get('output', []):
                                        output_item_index += 1
                                        item_type = item.get('type')
                                        print(f"  📄 Output item #{output_item_index}: type='{item_type}'")

                                        if item.get('type') != 'message':
                                            continue

                                        content_blocks = item.get('content', []) or []
                                        print(f"     → Has {len(content_blocks)} content blocks")

                                        for block_idx, block in enumerate(content_blocks):
                                            block_type = block.get('type')
                                            print(f"        Block #{block_idx + 1}: type='{block_type}'")

                                            # Text blocks may carry annotations with container_file citations
                                            if block.get('type') == 'output_text':
                                                annotations = block.get('annotations', []) or []
                                                print(f"          → Has {len(annotations)} annotations")
                                                for ann_idx, ann in enumerate(annotations):
                                                    fid = ann.get('file_id')
                                                    fname = ann.get('filename')

                                                    if fid:
                                                        if not fname:
                                                            fname = f"file_{fid[-8:]}"  # Use last 8 chars of file_id as fallback
                                                        file_refs.append((fid, fname))
                                                        print(f"            📎 Annotation #{ann_idx + 1}: Added file_id={fid[:20]}..., filename='{fname}'")

                                            # Image blocks
                                            elif block.get('type') == 'image_file':
                                                img = block.get('image_file', {}) or {}
                                                fid = img.get('file_id')
                                                if fid:
                                                    file_refs.append((fid, "image.png"))
                                                    print(f"          🖼️  Added image_file: file_id={fid[:20]}..., filename='image.png'")

                                            # File blocks (for non-image files)
                                            elif block.get('type') == 'file':
                                                file_obj = block.get('file', {}) or {}
                                                fid = file_obj.get('file_id')
                                                fname = file_obj.get('filename', 'download.txt')
                                                if fid:
                                                    file_refs.append((fid, fname))
                                                    print(f"          📁 Added file: file_id={fid[:20]}..., filename='{fname}'")

                                    # 3) Try to retrieve chart data from found file references
                                    # Start fresh to avoid duplicating images that may already be present in response_dict
                                    print(f"\n✅ Total file references collected: {len(file_refs)}")
                                    print(f"   File refs: {[(fid[:20] + '...', fname) for fid, fname in file_refs]}")

                                    # Check for duplicates in file_refs
                                    file_ref_ids = [fid for fid, _ in file_refs]
                                    unique_file_ids = set(file_ref_ids)
                                    if len(file_ref_ids) != len(unique_file_ids):
                                        print(f"\n⚠️  WARNING: file_refs contains DUPLICATE file_ids!")
                                        print(f"   Total refs: {len(file_ref_ids)}, Unique IDs: {len(unique_file_ids)}")
                                        from collections import Counter
                                        duplicates = {fid: count for fid, count in Counter(file_ref_ids).items() if count > 1}
                                        for fid, count in duplicates.items():
                                            print(f"   - {fid[:20]}... appears {count} times")

                                    # Filter out generic container filenames (cfile_*) to avoid duplicates
                                    # OpenAI references each chart twice: once with generic cfile_* and once with descriptive name
                                    filtered_file_refs = []
                                    for fid, fname in file_refs:
                                        # Skip generic container filenames that start with 'cfile_' followed by hex characters
                                        if fname.startswith('cfile_') and len(fname) > 20 and fname.count('_') == 1:
                                            # This is likely a generic container reference, skip it
                                            print(f"   🚫 Filtering out generic container file: {fname}")
                                            continue
                                        filtered_file_refs.append((fid, fname))

                                    if len(filtered_file_refs) < len(file_refs):
                                        print(f"\n🔧 Filtered {len(file_refs) - len(filtered_file_refs)} generic container references")
                                        print(f"   Remaining file refs: {len(filtered_file_refs)}")
                                        file_refs = filtered_file_refs
                                    # Stream code interpreter stdout/logs to frontend
                                    if code_interpreter_logs:
                                        combined_logs = '\n'.join(code_interpreter_logs)
                                        print(f"\n📤 Streaming code_output ({len(combined_logs)} chars) to frontend")
                                        yield f"data: {json.dumps({'type': 'code_output', 'data': combined_logs})}\n\n"
                                    else:
                                        print(f"\n  ℹ️  No code interpreter logs to stream")

                                    chart_outputs_set = set()

                                    # Avoid attempting to fetch the same file more than once
                                    seen_file_ids = set()

                                    print(f"\n🚀 Starting image fetch loop...")
                                    print(f"   Containers: {len(container_ids)}, File refs: {len(file_refs)}")
                                    print(f"   Total iterations: {len(container_ids) * len(file_refs)}")

                                    iteration = 0
                                    for container_id in container_ids:
                                        print(f"\n  📦 Processing container: {container_id}")
                                        for file_id, filename in file_refs:
                                            iteration += 1
                                            print(f"    Iteration #{iteration}: file_id={file_id[:20]}..., filename='{filename}'")

                                            if not file_id:
                                                print(f"      ⏭️  SKIP: file_id is empty")
                                                continue

                                            if file_id in seen_file_ids:
                                                print(f"      ⏭️  SKIP: file_id already processed (in seen_file_ids)")
                                                continue

                                            image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp')
                                            if not filename.lower().endswith(image_extensions):
                                                print(f"      ⏭️  SKIP: filename '{filename}' doesn't end with image extension")
                                                continue

                                            try:
                                                print(f"      🌐 Fetching from container...")
                                                file_response = await client.containers.files.content.retrieve(
                                                    container_id=container_id,
                                                    file_id=file_id
                                                )
                                                data = file_response.read()
                                                image_base64 = base64.b64encode(data).decode('utf-8')

                                                # Check if this exact image already exists in set
                                                before_size = len(chart_outputs_set)
                                                chart_outputs_set.add(image_base64)  # Add to set (automatically deduplicates)
                                                after_size = len(chart_outputs_set)

                                                if before_size == after_size:
                                                    print(f"      ⚠️  Image already in set (duplicate detected by hash)")
                                                else:
                                                    print(f"      ✅ Image added to set (new unique image #{after_size})")

                                                seen_file_ids.add(file_id)
                                                print(f"      ✅ file_id added to seen_file_ids (total seen: {len(seen_file_ids)})")

                                            except Exception as file_error:
                                                print(f"      ❌ Fetch FAILED: {file_error}")
                                                continue

                                    # Convert set back to list for the response
                                    print(f"\n📊 FINAL RESULT:")
                                    print(f"   Total unique images in chart_outputs_set: {len(chart_outputs_set)}")

                                    if chart_outputs_set:
                                        chart_list = list(chart_outputs_set)
                                        response_dict["chart_outputs"] = chart_list
                                        print(f"   ✅ Added {len(chart_list)} images to response_dict['chart_outputs']")

                                        # Stream images as SSE JSON event
                                        print(f"   🚀 Streaming {len(chart_list)} images to frontend via SSE")
                                        yield f"data: {json.dumps({'type': 'images', 'data': chart_list})}\n\n"
                                    else:
                                        print(f"   ℹ️  No images to send")

                                    # ========================================
                                    # Handle downloadable files (CSV, Excel, etc.)
                                    # ========================================
                                    print(f"\n📁 Starting downloadable files fetch...")
                                    downloadable_extensions = ('.csv', '.xlsx', '.xls', '.json', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico')
                                    downloadable_files = []
                                    seen_file_ids_for_downloads = set()

                                    for container_id in container_ids:
                                        for file_id, filename in file_refs:
                                            if not file_id or file_id in seen_file_ids_for_downloads:
                                                continue
                                            
                                            if not filename.lower().endswith(downloadable_extensions):
                                                continue
                                            
                                            try:
                                                print(f"   📥 Fetching file: {filename}")
                                                file_response = await client.containers.files.content.retrieve(
                                                    container_id=container_id,
                                                    file_id=file_id
                                                )
                                                data = file_response.read()
                                                file_base64 = base64.b64encode(data).decode('utf-8')
                                                
                                                # Determine MIME type
                                                mime_type = 'application/octet-stream'
                                                if filename.lower().endswith('.csv'):
                                                    mime_type = 'text/csv'
                                                elif filename.lower().endswith(('.xlsx', '.xls')):
                                                    mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                                                elif filename.lower().endswith('.json'):
                                                    mime_type = 'application/json'
                                                elif filename.lower().endswith('.txt'):
                                                    mime_type = 'text/plain'
                                                elif filename.lower().endswith('.pdf'):
                                                    mime_type = 'application/pdf'
                                                elif filename.lower().endswith('.png'):
                                                    mime_type = 'image/png'
                                                elif filename.lower().endswith(('.jpg', '.jpeg')):
                                                    mime_type = 'image/jpeg'
                                                elif filename.lower().endswith('.gif'):
                                                    mime_type = 'image/gif'
                                                elif filename.lower().endswith('.webp'):
                                                    mime_type = 'image/webp'
                                                elif filename.lower().endswith('.svg'):
                                                    mime_type = 'image/svg+xml'
                                                elif filename.lower().endswith('.bmp'):
                                                    mime_type = 'image/bmp'
                                                elif filename.lower().endswith('.ico'):
                                                    mime_type = 'image/x-icon'
                                                
                                                downloadable_files.append({
                                                    'filename': filename,
                                                    'data': file_base64,
                                                    'mime_type': mime_type,
                                                    'sandbox_path': f'sandbox:/mnt/data/{filename}'
                                                })
                                                seen_file_ids_for_downloads.add(file_id)
                                                print(f"   ✅ Fetched downloadable file: {filename}")
                                                
                                            except Exception as file_error:
                                                print(f"   ❌ Failed to fetch file {filename}: {file_error}")
                                                continue

                                    # Stream downloadable files as SSE event
                                    if downloadable_files:
                                        print(f"   🚀 Streaming {len(downloadable_files)} downloadable files to frontend")
                                        yield f"data: {json.dumps({'type': 'files', 'data': downloadable_files})}\n\n"
                                    else:
                                        print(f"   ℹ️  No downloadable files to send")

                                    print("="*80 + "\n")
                                except Exception as e:
                                    logger.error("Error retrieving chart file: %s", str(e), exc_info=True)
                                # # Extract usage information and calculate cost
                                usage_info = CostCalculator.extract_usage_from_response(response_dict)

                                # # Enqueue analytics job if we have the required data
                                assistant_message_id = None
                                if user_id and thread_id:
                                    try:
                                        assistant_message_id = str(uuid4())
                                        # Convert downloadable_files dicts to DownloadableFile objects
                                        downloadable_file_objects = [
                                            DownloadableFile(**f) for f in downloadable_files
                                        ] if downloadable_files else []
                                        
                                        analytics_data = AnalyticsData(
                                            message_id=assistant_message_id,
                                            latency_ms=latency_ms,
                                            input_tokens=usage_info["input_tokens"],
                                            output_tokens=usage_info["output_tokens"],
                                            cost_usd=usage_info["total_cost"],
                                            chart_type=ChartType.NONE,
                                            thread_id=thread_id,
                                            user_id=user_id,
                                            user_message=user_message,
                                            assistant_response=response_dict,
                                            file_names=file_names,
                                            downloadable_files=downloadable_file_objects
                                        )

                                        background_tasks.add_task(
                                            process_analytics_background_task,
                                            analytics_data
                                        )

                                    except Exception as e:
                                        logger.error(f"Error enqueuing analytics job: {e}")
                                else:
                                    logger.warning("Missing user_id or thread_id for analytics tracking")

                                final_response = {
                                    "thread_id": thread_id,
                                    "user_id": user_id,
                                    "id": response_dict.get("id")  # This is the OpenAI response_id (previous_response_id)
                                }

                                # Add assistant_message_id if we have it
                                if assistant_message_id:
                                    final_response["assistant_message_id"] = assistant_message_id

                                # Stream response metadata as SSE JSON event
                                yield f"data: {json.dumps({'type': 'response_metadata', 'data': final_response})}\n\n"

                except Exception as e:
                    if "Container is expired." in str(e):
                        del response_params["previous_response_id"]
                        continue

                    raise HTTPException(status_code=500, detail="Error creating response") from e

                break

        return stream_generator()

    else:
        try:
            response = await client.responses.create(**response_params)
            response_dict = response.model_dump()
        except Exception as e:
            if "Container is expired." in str(e):
                logger.error("Container is expired. Retrying...")
                return await get_chat_response(user_message, background_tasks, previous_output, file_id, stream, system_prompt, None, thread_id, user_id, file_names, experiment_type)

            logger.error("Error creating response: %s", str(e), exc_info=True)
            raise HTTPException(status_code=500, detail="Error creating response") from e

        try:
            # Look for chart data in the response output using comprehensive approach
            container_ids = []
            file_refs = []
            code_interpreter_logs = []

            # 1) Pull container_id(s) and stdout logs from code interpreter tool calls
            for item in response_dict.get('output', []):
                if item.get('type') == 'code_interpreter_call':
                    cid = item.get('container_id')
                    if cid:
                        container_ids.append(cid)
                    for out in item.get('outputs') or []:
                        otype = out.get('type') if isinstance(out, dict) else getattr(out, 'type', None)
                        if otype == 'logs':
                            logs_text = out.get('logs', '') if isinstance(out, dict) else getattr(out, 'logs', '')
                            if logs_text:
                                code_interpreter_logs.append(logs_text)
                                print(f"  📝 Extracted code_interpreter logs ({len(logs_text)} chars)")

            if code_interpreter_logs:
                response_dict['code_interpreter_logs'] = code_interpreter_logs
                print(f"  ✅ Added {len(code_interpreter_logs)} log block(s) to response")

            # 2) Pull file_id(s) from assistant message content - comprehensive search
            for item in response_dict.get('output', []):
                if item.get('type') != 'message':
                    continue

                for block in item.get('content', []) or []:
                    # Text blocks may carry annotations with container_file citations
                    if block.get('type') == 'output_text':
                        for ann in block.get('annotations', []) or []:
                            fid = ann.get('file_id')
                            fname = ann.get('filename')

                            if fid:
                                if not fname:
                                    fname = f"file_{fid[-8:]}"  # Use last 8 chars of file_id as fallback
                                file_refs.append((fid, fname))

                    # Image blocks
                    elif block.get('type') == 'image_file':
                        img = block.get('image_file', {}) or {}
                        fid = img.get('file_id')
                        if fid:
                            file_refs.append((fid, "image.png"))

                    # File blocks (for non-image files)
                    elif block.get('type') == 'file':
                        file_obj = block.get('file', {}) or {}
                        fid = file_obj.get('file_id')
                        fname = file_obj.get('filename', 'download.txt')
                        if fid:
                            file_refs.append((fid, fname))

            # Filter out generic container filenames (cfile_*) to avoid duplicates
            # OpenAI references each chart twice: once with generic cfile_* and once with descriptive name
            filtered_file_refs = []
            for fid, fname in file_refs:
                # Skip generic container filenames that start with 'cfile_' followed by hex characters
                if fname.startswith('cfile_') and len(fname) > 20 and fname.count('_') == 1:
                    # This is likely a generic container reference, skip it
                    logger.debug(f"Filtering out generic container file: {fname}")
                    continue
                filtered_file_refs.append((fid, fname))

            if len(filtered_file_refs) < len(file_refs):
                logger.info(f"Filtered {len(file_refs) - len(filtered_file_refs)} generic container references")
                file_refs = filtered_file_refs

            # 3) Try to retrieve chart data from found file references
            # Start fresh to avoid duplicating images that may already be present in response_dict
            chart_outputs_set = set()
            seen_file_ids = set()

            for container_id in container_ids:
                for file_id, filename in file_refs:
                    if not file_id or file_id in seen_file_ids:
                        continue
                    try:
                        file_response = await client.containers.files.content.retrieve(
                            container_id=container_id,
                            file_id=file_id
                        )
                        data = file_response.read()
                        image_base64 = base64.b64encode(data).decode('utf-8')
                        chart_outputs_set.add(image_base64)  # Add to set (automatically deduplicates)
                        seen_file_ids.add(file_id)
                    except Exception as file_error:
                        continue

            # Convert set back to list for the response
            if chart_outputs_set:
                response_dict["chart_outputs"] = list(chart_outputs_set)
        except Exception as e:
            logger.error("Error retrieving chart file: %s", str(e), exc_info=True)

        # Calculate latency
        end_time = time.time()
        latency_ms = int((end_time - start_time) * 1000)

        # Extract usage information and calculate cost
        usage_info = CostCalculator.extract_usage_from_response(response_dict)

        # Enqueue analytics job if we have the required data
        assistant_message_id = None
        if user_id and thread_id:
            try:
                assistant_message_id = str(uuid4())
                analytics_data = AnalyticsData(
                    message_id=assistant_message_id,
                    latency_ms=latency_ms,
                    input_tokens=usage_info["input_tokens"],
                    output_tokens=usage_info["output_tokens"],
                    cost_usd=usage_info["total_cost"],
                    chart_type=ChartType.NONE,  # Will be detected in background job
                    thread_id=thread_id,
                    user_id=user_id,
                    user_message=user_message,
                    assistant_response=response_dict,
                    file_names=file_names,
                    downloadable_files=[]  # Non-streaming doesn't fetch downloadable files yet
                )

                # Schedule analytics processing as FastAPI background task (truly non-blocking)
                # This will run AFTER the response is sent to the user
                background_tasks.add_task(
                    process_analytics_background_task,
                    analytics_data
                )

            except Exception as e:
                logger.error(f"Error enqueuing analytics job: {e}")
        else:
            logger.warning("Missing user_id or thread_id for analytics tracking")

        # Add message_id to response for rating
        if assistant_message_id:
            response_dict["message_id"] = assistant_message_id

        logger.debug(f"Received response: {response_dict}")
        return response_dict
