@echo off
echo ========================================
echo  Starting CCNA Network Config Generator
echo ========================================
echo.

echo Starting Backend (port 8000)...
start "CCNA Backend" cmd /k "cd backend && call venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo Starting Frontend (port 3000)...
start "CCNA Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo  Application Started!
echo ========================================
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Opening browser...
start http://localhost:3000
echo.
echo Press any key to exit (services will keep running)
pause >nul
