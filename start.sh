#!/bin/bash

echo "========================================"
echo " Starting CCNA Network Config Generator"
echo "========================================"
echo

# Start backend
echo "Starting Backend (port 8000)..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

sleep 3

# Start frontend
echo "Starting Frontend (port 3000)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

sleep 3

echo
echo "========================================"
echo " Application Started!"
echo "========================================"
echo
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo
echo "Press Ctrl+C to stop"

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

# Wait
wait
