#!/bin/bash

echo "========================================"
echo " CCNA Network Config Generator Setup"
echo "========================================"
echo

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.11+"
    exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo "Please install Node.js 18+"
    exit 1
fi

echo "[1/5] Setting up backend virtual environment..."
cd backend
python3 -m venv venv
source venv/bin/activate

echo "[2/5] Upgrading pip (required for newer packages)..."
python -m pip install --upgrade pip

echo "[3/5] Installing backend dependencies..."
pip install -r requirements.txt
if [ ! -f .env ]; then
    cp .env.example .env
fi
cd ..

echo "[4/5] Setting up frontend..."
cd frontend
npm install
if [ ! -f .env.local ]; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
fi
cd ..

echo
echo "========================================"
echo " Setup Complete!"
echo "========================================"
echo
echo "Run './start.sh' to start the application"
