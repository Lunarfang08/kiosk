from fastapi import APIRouter, Depends

from app.schemas.common import DograhStatusResponse, DograhTestConnectionResponse
from app.services.dograh_service import dograh_service
from app.utils.security import require_admin

router = APIRouter(prefix="/api/dograh", tags=["dograh"])


@router.get("/status", response_model=DograhStatusResponse)
async def dograh_status() -> DograhStatusResponse:
    data = await dograh_service.status()
    return DograhStatusResponse(**data)


@router.post(
    "/test-connection",
    response_model=DograhTestConnectionResponse,
    dependencies=[Depends(require_admin)],
)
async def test_connection() -> DograhTestConnectionResponse:
    data = await dograh_service.test_connection()
    return DograhTestConnectionResponse(**data)
