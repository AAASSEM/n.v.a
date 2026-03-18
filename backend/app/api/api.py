from fastapi import APIRouter
from app.api.endpoints import auth, users, companies, profiling, data_elements, submissions, meters, dashboard, developer_admin, frameworks, reports

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(profiling.router, prefix="/profiling", tags=["profiling"])
api_router.include_router(data_elements.router, prefix="/data-elements", tags=["data-elements"])
api_router.include_router(submissions.router, prefix="/submissions", tags=["submissions"])
api_router.include_router(meters.router, prefix="/meters", tags=["meters"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(developer_admin.router, prefix="/developer-admin", tags=["developer-admin"])
api_router.include_router(frameworks.router, prefix="/frameworks", tags=["frameworks"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
