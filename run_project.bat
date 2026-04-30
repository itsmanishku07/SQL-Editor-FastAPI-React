@echo off
echo Starting Postgres Pro Project...

start "Postgres Pro Backend" cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"

start "Postgres Pro Frontend" cmd /k "cd frontend && npm run dev"

echo All services are starting in separate windows.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
pause
