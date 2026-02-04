"""Main FastAPI application"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.routes import session, gns3, devices, config, inference, verify

# Setup logging
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan"""
    logger.info("Starting CCNA Network Config Generator Backend")
    logger.info(f"Mock Mode: {settings.MOCK_MODE}")
    yield
    logger.info("Shutting down")


# Create FastAPI app
app = FastAPI(
    title="CCNA Network Config Generator API",
    description="Backend API for CCNA network device configuration and management",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
origins = getattr(settings, "cors_origins_list", None) or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(session.router, prefix=settings.API_PREFIX)
app.include_router(gns3.router, prefix=settings.API_PREFIX)
app.include_router(devices.router, prefix=settings.API_PREFIX)
app.include_router(config.router, prefix=settings.API_PREFIX)
app.include_router(inference.router, prefix=settings.API_PREFIX)
app.include_router(verify.router, prefix=settings.API_PREFIX)


@app.get(f"{settings.API_PREFIX}/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "mode": "mock" if settings.MOCK_MODE else "live",
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "CCNA Network Config Generator API",
        "docs": "/docs",
        "health": f"{settings.API_PREFIX}/health"
    }
