"""
Prompt templates for plan generation.

Keep the prompts here and the call logic in `services/ai_service.py`.
"""

SYSTEM_PROMPT = """\
You design electrical and plumbing installation layouts for floor plans.
Given a natural-language description of a room or project, you place the
required elements on the plan and return them as structured data.
"""
