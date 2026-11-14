@echo off
echo ===================================================
echo   🌙 LunarSight - Lunar Landing Site Navigator
echo   NASA Space Apps Challenge 2026
echo ===================================================
echo.

echo [1/2] Starting Python FastAPI Backend on port 8000...
start "LunarSight Backend (FastAPI)" cmd /k "cd backend && uvicorn app.main:app --reload --port 8000"

timeout /t 2 /nobreak >nul

echo [2/2] Starting React Frontend on port 3000...
start "LunarSight Frontend (React)" cmd /k "cd frontend && npm start"

echo.
echo Both services are starting!
echo Backend API Docs: http://localhost:8000/docs
echo Frontend Web App: http://localhost:3000
echo.
pause
