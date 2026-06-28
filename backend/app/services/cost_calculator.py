"""Cost calculation service for OpenAI tokens."""

from typing import Dict, Any
from decimal import Decimal, ROUND_HALF_UP
from ..core.logging import get_logger

logger = get_logger(__name__)


class CostCalculator:
    """Calculate costs for OpenAI API usage."""

    # GPT-4o pricing per 1M tokens (as provided)
    INPUT_TOKEN_COST_PER_MILLION = 4.00  # $4.00 per 1M input tokens
    OUTPUT_TOKEN_COST_PER_MILLION = 16.00  # $16.00 per 1M output tokens

    @classmethod
    def calculate_cost(
        cls,
        input_tokens: int,
        output_tokens: int
    ) -> float:
        """
        Calculate the cost in USD for given input and output tokens.

        Args:
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Total cost in USD (rounded to 6 decimal places)
        """
        try:
            # Convert to millions for calculation
            input_cost = (input_tokens / 1_000_000) * cls.INPUT_TOKEN_COST_PER_MILLION
            output_cost = (output_tokens / 1_000_000) * cls.OUTPUT_TOKEN_COST_PER_MILLION

            total_cost = input_cost + output_cost

            # Round to 6 decimal places
            rounded_cost = round(total_cost, 6)

            logger.debug(
                f"Cost calculation: {input_tokens} input tokens, "
                f"{output_tokens} output tokens = ${rounded_cost}"
            )

            return rounded_cost

        except Exception as e:
            logger.error(f"Error calculating cost: {e}")
            return 0.0

    @classmethod
    def extract_usage_from_response(cls, response_data: Dict[str, Any]) -> Dict[str, int]:
        """
        Extract token usage from OpenAI response.

        Args:
            response_data: The response data from OpenAI API

        Returns:
            Dictionary with input_tokens, output_tokens, and total_cost
        """
        try:
            # Extract usage information from the response
            # The structure may vary depending on the API response format
            usage = response_data.get("usage", {})

            input_tokens = usage.get("input_tokens", 0)
            output_tokens = usage.get("output_tokens", 0)

            # Calculate cost
            total_cost = cls.calculate_cost(input_tokens, output_tokens)

            return {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_cost": total_cost
            }

        except Exception as e:
            logger.error(f"Error extracting usage from response: {e}")
            return {
                "input_tokens": 0,
                "output_tokens": 0,
                "total_cost": 0.0
            }
