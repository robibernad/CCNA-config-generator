"""Configuration generation API routes"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from loguru import logger

from app.sessions.models import Session
from app.api.routes.session import get_session_from_header
from app.config_engine.models import IntendedConfig
from app.config_engine.generator import ConfigGenerator

router = APIRouter(prefix="/config", tags=["config"])


class GenerateConfigRequest(BaseModel):
    """Config generation request"""
    intended_config: IntendedConfig = Field(..., alias="intendedConfig")


class GenerateConfigResponse(BaseModel):
    """Config generation response"""
    per_module: Dict[str, str] = Field(..., alias="perModule")
    merged: str
    warnings: List[str]
    errors: List[Dict]


@router.post("/generate", response_model=GenerateConfigResponse)
async def generate_config(
    request: GenerateConfigRequest,
    session: Session = Depends(get_session_from_header)
):
    """Generate configuration for a device"""
    try:
        generator = ConfigGenerator()
        result = generator.generate(request.intended_config)
        
        if result["errors"]:
            raise HTTPException(
                status_code=400,
                detail={"errors": result["errors"], "warnings": result["warnings"]}
            )
        
        return GenerateConfigResponse(
            perModule=result["perModule"],
            merged=result["merged"],
            warnings=result["warnings"],
            errors=result["errors"]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Config generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ AI Validation ============


class ValidateConfigRequest(BaseModel):
    """Config validation request"""
    lab_requirements: str = Field(..., alias="labRequirements")
    raw_config: str = Field(..., alias="rawConfig")
    running_config: Optional[str] = Field(None, alias="runningConfig")

    class Config:
        populate_by_name = True


class ValidationIssue(BaseModel):
    """Single validation issue"""
    severity: str
    message: str
    section: Optional[str] = None
    recommended_fix: Optional[str] = Field(None, alias="recommendedFix")

    class Config:
        populate_by_name = True


class ValidateConfigResponse(BaseModel):
    """Config validation response"""
    is_compliant: bool = Field(..., alias="isCompliant")
    issues: List[ValidationIssue]
    enhanced_config: Optional[str] = Field(None, alias="enhancedConfig")
    notes: str

    class Config:
        populate_by_name = True


@router.post("/validate", response_model=ValidateConfigResponse)
async def validate_config(
    request: ValidateConfigRequest,
    session: Session = Depends(get_session_from_header)
):
    """Validate configuration using AI"""
    try:
        from app.ai.openai_client import OpenAIClient

        client = OpenAIClient()
        result = await client.validate_config(
            lab_requirements=request.lab_requirements,
            raw_config=request.raw_config,
            running_config=request.running_config
        )

        return ValidateConfigResponse(
            isCompliant=result.is_compliant,
            issues=[
                ValidationIssue(
                    severity=issue.severity,
                    message=issue.message,
                    section=issue.section,
                    recommendedFix=issue.recommended_fix
                )
                for issue in result.issues
            ],
            enhancedConfig=result.enhanced_config,
            notes=result.notes
        )

    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
