from typing import Dict, Any
from openai import AsyncOpenAI
from pydantic import BaseModel

client = AsyncOpenAI(api_key="")

class ChartType(BaseModel):
    chart_type: str



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
                        "instructions": "You are given the output text and code used to generate a control chart. Your job is to determine what type of control chart it is. DONOT TALK EXTRA OR GIVE ANYTHING ELSE THAN CHART TYPE.",
                        "text_format":ChartType,
                    }

                    response = await client.responses.parse(**response_params)
                    chart_type = response.output_parsed.chart_type.lower()
                    print(chart_type)
                    return chart_type
                else:
                    return "none"

            return "none"

        except Exception as e:
            print(f"Error detecting chart type: {e}")
            return "none"


response_data = {
    "id": "resp_68d067cc1d0881a1806c5c3bc471d38709663de16514ef0a",
    "created_at": 1758488524,
    "error": None,
    "incomplete_details": None,
    "instructions": "\nOverview\nYou are a statistician and continuous improvement expert helping educators analyze and\nvisualize data using control charts. The Health Care Data Guide in the knowledge base details\nhow you should advise educators to conduct data analysis. Your specialty is in creating accurate\ncontrol charts using data they have uploaded. Whenever a user's request is ambiguous,\nincomplete, or could be interpreted in multiple ways, pause and ask a clear follow‑up question\ninstead of guessing. Treat the conversation as a joint problem‑solving session.\nWhat to do\n1. File Input and Verification\nRead the Data: When a file is uploaded, detect the file format (e.g., CSV, Excel, text) and parse\nthe data. Randomly select up to twenty rows from the data. This ensures that a diverse range of\nobservations is represented and prevents misinterpretation from only examining a particular\nsection of the dataset. Be sure to read the data in using Python and display this in the code\ninterpreter.\nVerify Structure: Check that the dataset includes column headers and that the data are arranged\neither as time series, subgroups, or individual observations. Be sure to remind the user to not\nupload data with student identifiers or any personally identifiable information (PII)\nStandardize Column Names:\nRemove any extra spaces from column names to ensure consistency and avoid errors during\ncomputations.\nDate Field:\nIf the dataset contains a date field including day, month, year etc reformat as a data field using\nPython within the code interpreter. If you are unsure of the data field format ask the user before\nreformatting.\nLearning Question:\nAsk the user about their learning questions. What questions are they hoping to answer with this\nanalysis? 2. Determine Data Type\nIdentify Continuous vs. Attribute Data:\nContinuous Data: Look for measurements on a numerical scale (e.g., time, weight, financial\nvalues) that may include decimals.\nAttribute Data: Look for counts or classifications (e.g., yes/no, conforming/nonconforming,\nnumber of defects or errors).\nClarify Ambiguities: If the data type is unclear, ask the user to confirm the nature of the\nmeasurement. 3. Select the Appropriate Control Chart or Run Chart\nFor Continuous Data:\nX‑Bar/S Chart: Use when the data can be organized into rational subgroups (i.e., each subgroup\ncontains multiple measurements) to analyze both subgroup averages and within‐subgroup\nvariation.\nI Chart: Use when subgrouping isn’t practical (e.g., infrequent measurements or only one\nobservation per time period).\nFor Attribute Data:\nP Chart: Use when each unit is classified into one of two categories, and even if subgroup sizes\nvary.\nC Chart: Use when counting the total number of incidents in a fixed, constant area of\nopportunity.\nU Chart: Use when the area of opportunity varies from subgroup to subgroup (e.g., varying\npatient days).\nT Chart: Use for rare events (when over 25% of the subgroups have zero incidents), as it plots\nthe time between events.\nSuggest a Run Chart when:\nData includes any type of date field including day, month, year etc. There are fewer than 8\nobservations.\nExplain If the data seems well suited to a particular control chart or run chart and what types of\nquestions this analysis would help answer and how this relates to what the user shared about\ntheir learning questions. Be sure to ask whether this chart makes sense to the user and offer to\nanswer questions about different control charts or run charts, what types of inquiry each is best\nsuited to answer, and the necessary data structures to produce that chart. 4. Data Wrangling and Restructuring\nAssess Data Structure: Compare the dataset’s structure with the requirements of the chosen\ncontrol chart. For example, X‑Bar/S charts require multiple observations per subgroup, while I\ncharts require a natural time order of individual data points.\nTransform or Aggregate if Needed:\nIf data are provided at too granular or too high a level (e.g., individual records when subgroup\naverages are needed), aggregate the data by a relevant dimension (e.g., by day, week, or\ndepartment). If data is in wide format and the user wants a x bar / s chart transform the data to\nbe in long format. Convert raw counts into percentages or rates (e.g., for P charts) if the data\nare not already in that format. If the dataset lacks clear subgroup labels, suggest or\nautomatically create rational subgroups based on timestamps or other meaningful variables.\nWhen data wrangling is needed please explain to the user what steps you will take to wrangle\nthe data to the necessary structure. Be sure to output the transformed data table to the user as\nan initial step before producing any charts and ask if the transformed data looks right to the\nuser. If multiple wrangling options exist, prompt the user to select the preferred method for\nrestructuring the data. 6. Code Interpreter Usage\nTemplate Selection:\nOnce the chart type is determined based on the data characteristics, select the corresponding\nPython code template from the knowledge base. For example, if a P chart is appropriate,\nretrieve the P chart template. Ensure subgroup size or area of opportunity meets the minimum\nrequirements for the chosen chart type. Use the chart's specific formulas for limit\ncalculations—each chart has a unique method to account for inherent process variation\nWhen producing any Shewhart chart involving control limits (e.g., X-Bar/S, I, P, U, C), you must:\nCalculate the number of observations for each subgroup and control limits using the exact\nmethod specified in the relevant chart template. Do not rely solely on published tables of\nconstants or assume the same number of observations per subgroup unless explicitly instructed\nto.\nIf subgroup sizes vary for the X Bar/ S, use the log-gamma–based formulas provided in the\ntemplate for each subgroup.\nWhen phasing or faceting, recalculate control limits separately for each phase/facet, using their\nactual subgroup sizes and exact formulas.\nChart Plotting\nWhen generating the control chart, ensure that:\nEvery Observation is Labeled. Plot every individual data point with its corresponding label or\nmarker so that no observation is omitted. Clearly label the central (average) line on the chart.\nThe final chart should be well-labeled, easy to interpret, and include all computed statistics\nalongside every individual data point. Be sure that the legend doesn't obscure any other labels. 7. Explanation and Next Steps\nProvide interpretation of the chart in the context of the learning questions you had previously\ngenerated with the user in an earlier discussion. Recommend that they go observe and talk with\npeople experiencing special cause variation. See if the user has any other questions, wants a\ntable of the observations that are in special cause variation, or wants support with additional\nanalysis. 8. Optional Additional Analysis\nFaceting, Phasing, Freezing, Scan for special-cause signals consult the additional analysis\ntemplate Guardrails\nAlways treat control charts as analytic studies, not enumerative ones.\nUse control limit formulas that reflect actual data structure and variation.\nAvoid shortcuts that assume uniform subgroup sizes\nConfirm with the user that this is the type of control chart they want to produce.\nBe sure to remind the user to not upload data with student identifiers or any personally\nidentifiable information (PII)\nWhen data wrangling is needed please explain to the user what steps you will take to wrangle\nthe data to the necessary structure.\nBe sure to output the transformed data table after you have completed wrangling for accuracy\n",
    "metadata": {},
    "model": "gpt-4o-2024-11-20",
    "object": "response",
    "output": [
        {
            "id": "ci_68d067ccfe2881a1b0640de11c13ae3709663de16514ef0a",
            "code": "import numpy as np\r\nimport matplotlib.pyplot as plt\r\n\r\n# Step 1: Verify - Rename columns for easier manipulation\r\ndata.rename(columns=lambda x: x.strip(), inplace=True)\r\n\r\n# Step 2: Calculate the proportion (P) and overall weighted average proportion (P_bar)\r\ndata['P'] = data['Number_CA_Students'] / data['Number_Students']\r\noverall_P_bar = data['Number_CA_Students'].sum() / data['Number_Students'].sum()\r\n\r\n# Step 3: Determine control limits (LCL and UCL)\r\ndata['Std_Error'] = np.sqrt((overall_P_bar * (1 - overall_P_bar)) / data['Number_Students'])\r\ndata['LCL'] = np.maximum(0, overall_P_bar - 3 * data['Std_Error'])  # Ensure LCL is not negative\r\ndata['UCL'] = np.minimum(1, overall_P_bar + 3 * data['Std_Error'])  # Ensure UCL is not above 1\r\n\r\n# Step 4: Plot the Funnel P Chart\r\nplt.figure(figsize=(12, 8))\r\n\r\n# Scatter plot of schools' proportions (P)\r\nplt.scatter(data['Number_Students'], data['P'], label=\"Proportion (\\u03C1)\", color='blue', alpha=0.7)\r\n\r\n# Plot the control limits\r\nstudents = np.linspace(data['Number_Students'].min(), data['Number_Students'].max(), 500)\r\ncontrol_limits_std_error = np.sqrt((overall_P_bar * (1 - overall_P_bar)) / students)\r\nLCL_smooth = np.maximum(0, overall_P_bar - 3 * control_limits_std_error)\r\nUCL_smooth = np.minimum(1, overall_P_bar + 3 * control_limits_std_error)\r\n\r\nplt.plot(students, LCL_smooth, label=\"Lower Control Limit (LCL)\", color='red', linestyle='--')\r\nplt.plot(students, UCL_smooth, label=\"Upper Control Limit (UCL)\", color='green', linestyle='--')\r\n\r\n# Average line (P_bar)\r\nplt.axhline(y=overall_P_bar, color='black', linestyle='-', label=\"Average (\\u03C1\\u0305)\")\r\n\r\n# Add labels and legend\r\nplt.title(\"Funnel P Chart: Chronic Absenteeism\", fontsize=16)\r\nplt.xlabel(\"Number of Students (n)\", fontsize=14)\r\nplt.ylabel(\"Proportion of Chronically Absent Students (\\u03C1)\", fontsize=14)\r\nplt.legend(fontsize=12, loc=\"upper right\")\r\nplt.grid(alpha=0.3)\r\nplt.tight_layout()\r\nplt.show()",
            "container_id": "cntr_68d0675f9cc88191833e1fd7732009d20abbd3f954078c41",
            "outputs": None,
            "status": "completed",
            "type": "code_interpreter_call"
        },
        {
            "id": "msg_68d067d4c7fc81a195d8b6908f23689209663de16514ef0a",
            "content": [
                {
                    "annotations": [
                        {
                            "container_id": "cntr_68d0675f9cc88191833e1fd7732009d20abbd3f954078c41",
                            "end_index": 0,
                            "file_id": "cfile_68d067d3d2ec8191803a3c8ef1dcde50",
                            "filename": "cfile_68d067d3d2ec8191803a3c8ef1dcde50.png",
                            "start_index": 0,
                            "type": "container_file_citation"
                        }
                    ],
                    "text": "Here is the Funnel P Chart for chronic absenteeism:\n\n- **Blue dots** represent the proportion (\\(P\\)) of chronically absent students in each school.\n- **Black line** is the overall average (\\(P_\\text{bar}\\)).\n- **Red dashed line** is the lower control limit (LCL).\n- **Green dashed line** is the upper control limit (UCL).\n\nThis chart highlights how schools' proportions vary in relation to their sample sizes, with smoother control limits calculated for the population distribution.\n\nLet me know if additional adjustments or interpretations are required!",
                    "type": "output_text",
                    "logprobs": []
                }
            ],
            "role": "assistant",
            "status": "completed",
            "type": "message"
        }
    ],
    "parallel_tool_calls": True,
    "temperature": 1,
    "tool_choice": "auto",
    "tools": [
        {
            "container": {
                "type": "auto",
                "file_ids": None
            },
            "type": "code_interpreter"
        },
        {
            "type": "file_search",
            "vector_store_ids": [
                "vs_68a2628f4b608191853d663dfb3808e4"
            ],
            "filters": None,
            "max_num_results": 20,
            "ranking_options": {
                "ranker": "auto",
                "score_threshold": 0
            }
        }
    ],
    "top_p": 1,
    "background": False,
    "conversation": None,
    "max_output_tokens": None,
    "max_tool_calls": None,
    "previous_response_id": "resp_68d067aada2081a18e1a747911e8f57a09663de16514ef0a",
    "prompt": None,
    "prompt_cache_key": None,
    "reasoning": {
        "effort": None,
        "generate_summary": None,
        "summary": None
    },
    "safety_identifier": None,
    "service_tier": "default",
    "status": "completed",
    "text": {
        "format": {
            "type": "text"
        },
        "verbosity": "medium"
    },
    "top_logprobs": 0,
    "truncation": "disabled",
    "usage": {
        "input_tokens": 7918,
        "input_tokens_details": {
            "cached_tokens": 2688
        },
        "output_tokens": 662,
        "output_tokens_details": {
            "reasoning_tokens": 0
        },
        "total_tokens": 8580
    },
    "user": None,
    "billing": {
        "payer": "developer"
    },
    "store": True,
    "chart_outputs": [
        "yes"
    ]
}

import asyncio

async def main():
    await detect_chart_type(response_data)

asyncio.run(main())



