# ⚡ Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.11+ (for backend)
- **Docker** (optional, for containerized setup)

## 🚀 Fastest Way: Docker

```bash
cd ccna-network-generator
docker-compose up
```

Open http://localhost:3000 - done!

## 🪟 Windows Setup

### Step 1: Setup
Double-click `setup.bat` or run:
```cmd
setup.bat
```

### Step 2: Start
Double-click `start.bat` or run:
```cmd
start.bat
```

Two windows will open - one for backend, one for frontend.

## 🐧 Linux/Mac Setup

### Step 1: Make scripts executable
```bash
chmod +x setup.sh start.sh
```

### Step 2: Setup
```bash
./setup.sh
```

### Step 3: Start
```bash
./start.sh
```

## 🔧 Manual Setup

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```

## 🧪 Test Mock Mode

1. Open http://localhost:3000
2. Click "Use Mock Server"
3. Select a project
4. Choose a device
5. Configure and see generated CLI!

## 📡 Connect to Real GNS3

1. Start your GNS3 server
2. Open http://localhost:3000
3. Enter server URL (e.g., `http://192.168.1.100:3080`)
4. Enter device credentials
5. Click "Connect"

## 🎯 What's Next?

- Read the full [README.md](./README.md)
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
- See [backend/EXAMPLES.md](./backend/EXAMPLES.md) for API usage
