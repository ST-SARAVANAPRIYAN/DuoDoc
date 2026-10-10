"""
System Status & Diagnostic Routes
"""

from fastapi import APIRouter
from config import get_system_status

router = APIRouter(prefix="/api/system", tags=["System"])


@router.get("/status")
def system_status():
    """
    Returns GPU hardware specs, memory usage, and availability of model checkpoints.
    """
    return get_system_status()
