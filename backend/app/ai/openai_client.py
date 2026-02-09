"""OpenAI integration for config validation and enhancement"""
import os
from typing import Optional, List
from loguru import logger
import httpx
from pydantic import BaseModel


class ValidationIssue(BaseModel):
    """Single validation issue"""
    severity: str  # "error", "warning", "info"
    message: str
    section: Optional[str] = None
    recommended_fix: Optional[str] = None


class AIValidationResult(BaseModel):
    """AI validation result"""
    is_compliant: bool
    issues: List[ValidationIssue]
    enhanced_config: Optional[str] = None
    notes: str = ""


# System prompt for consistent AI behavior
SYSTEM_PROMPT = """You are a Cisco CCNA expert assistant. Your task is to validate and enhance Cisco IOS configurations for lab scenarios.

Guidelines:
- Focus on CCNA-level best practices
- Be specific and actionable in recommendations
- Identify security issues (weak passwords, missing SSH, etc.)
- Check for common misconfigurations
- Suggest only necessary changes, not over-engineering
- Return structured JSON output only
- Do not include commentary outside the JSON structure"""


class OpenAIClient:
    """OpenAI API client for configuration validation"""

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model = os.getenv("OPENAI_MODEL", "gpt-4")  # Configurable model
        self.available = bool(self.api_key)

    async def validate_config(
        self,
        lab_requirements: str,
        raw_config: str,
        running_config: Optional[str] = None
    ) -> AIValidationResult:
        """Validate configuration against lab requirements"""

        if not self.available:
            return AIValidationResult(
                is_compliant=True,
                issues=[],
                notes="AI validation unavailable (no API key configured)"
            )

        try:
            prompt = self._build_validation_prompt(
                lab_requirements, raw_config, running_config
            )

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.1,  # Low temperature for consistency
                        "response_format": {"type": "json_object"}
                    },
                    timeout=60.0
                )
                response.raise_for_status()

                result = response.json()
                content = result["choices"][0]["message"]["content"]

                # Parse JSON response
                import json
                data = json.loads(content)

                return AIValidationResult(
                    is_compliant=data.get("is_compliant", False),
                    issues=[ValidationIssue(**issue) for issue in data.get("issues", [])],
                    enhanced_config=data.get("enhanced_config"),
                    notes=data.get("notes", "")
                )

        except Exception as e:
            logger.error(f"AI validation failed: {e}")
            return AIValidationResult(
                is_compliant=True,
                issues=[ValidationIssue(
                    severity="error",
                    message=f"AI validation error: {str(e)}"
                )],
                notes="AI validation encountered an error"
            )

    def _build_validation_prompt(
        self,
        requirements: str,
        raw: str,
        running: Optional[str]
    ) -> str:
        """Build the validation prompt"""
        parts = [
            "# Task: Validate Cisco IOS Configuration",
            "",
            "## Lab Requirements:",
            requirements,
            "",
            "## Generated Configuration:",
            raw,
        ]

        if running:
            parts.extend([
                "",
                "## Current Running Configuration:",
                running
            ])

        parts.extend([
            "",
            "## Instructions:",
            "1. Compare the generated config against lab requirements",
            "2. Identify missing commands, incorrect settings, or security issues",
            "3. Check for best practices (CCNA level)",
            "4. Provide specific, actionable recommendations",
            "",
            "Return JSON with this structure:",
            "{",
            '  "is_compliant": boolean,',
            '  "issues": [{"severity": "error|warning|info", "message": "...", "section": "...", "recommended_fix": "..."}],',
            '  "enhanced_config": "full suggested config or null",',
            '  "notes": "summary of findings"',
            "}"
        ])

        return "\n".join(parts)
