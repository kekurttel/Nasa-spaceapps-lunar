import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import router as api_router
from app.mission_router import router as mission_router
from app.science_router import router as science_router
from app.contracts_router import router as contracts_router

app = FastAPI(
    title="Lunar Landing Site Navigator API",
    description="Scientific Ephemeris and Mission Planning Engine for NASA Lunar South Pole Exploration",
    version="1.0.0"
)

# Comma-separated browser origins; same-origin /api deployments need no override.
cors_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ALLOW_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    # The API uses no cookie authentication; avoid credentialed wildcard CORS.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(mission_router)
app.include_router(science_router)
app.include_router(contracts_router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Lunar Landing Site Navigator API",
        "challenge": "NASA Space Apps Challenge 2026",
        "endpoints": ["/api/presets", "/api/ephemeris", "/api/ephemeris/single", "/docs"]
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
