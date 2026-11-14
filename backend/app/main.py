from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import router as api_router

app = FastAPI(
    title="Lunar Landing Site Navigator API",
    description="Scientific Ephemeris and Mission Planning Engine for NASA Lunar South Pole Exploration",
    version="1.0.0"
)

# Enable CORS for local dev and frontend deployments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

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
