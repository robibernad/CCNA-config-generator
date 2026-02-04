@echo off
echo ========================================
echo  CCNA Network Config Generator Setup
echo ========================================
echo.

REM Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.11+ from https://python.org
    pause
    exit /b 1
)

REM Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

echo [1/5] Setting up backend virtual environment...
cd backend
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate

echo [2/5] Upgrading pip (required for newer packages)...
python -m pip install --upgrade pip

echo [3/5] Installing backend dependencies...
pip install -r requirements.txt
if not exist .env (
    copy .env.example .env
)
cd ..

echo [4/5] Setting up frontend...
cd frontend
call npm install
if errorlevel 1 (
    echo Retrying with --legacy-peer-deps...
    call npm install --legacy-peer-deps
)
if not exist .env.local (
    echo NEXT_PUBLIC_API_URL=http://localhost:8000/api > .env.local
)
cd ..

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Run 'start.bat' to start the application
echo.
pause
