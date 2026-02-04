"""Configuration generation API routes"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict
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
