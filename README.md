# 🌐 CCNA Network Config Generator

![Status](https://img.shields.io/badge/Status-Production_Ready-green)
![Frontend](https://img.shields.io/badge/Frontend-Next.js_15-black)
![Backend](https://img.shields.io/badge/Backend-FastAPI-green)

A full-stack application for visually configuring Cisco network devices in GNS3, generating proper IOS CLI commands, and applying configurations.

## ✨ Features

- 🖥️ **Visual Configuration** - Configure devices through an intuitive UI
- ⚡ **Real-time Validation** - Catch errors before applying
- 🔧 **GNS3 Integration** - Connect to your lab environment
- 📋 **CLI Generation** - Proper Cisco IOS syntax
- 🧪 **Mock Mode** - Test without GNS3 infrastructure

## 🚀 Quick Start

### Option 1: Docker (Recommended)
```bash
docker-compose up
```

### Option 2: Windows
```cmd
setup.bat
start.bat
```

### Option 3: Linux/Mac
```bash
chmod +x setup.sh start.sh
./setup.sh
./start.sh
```

### Option 4: Manual Setup

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## 📁 Project Structure

```
ccna-network-generator/
├── frontend/                 # Next.js 15 Application
│   ├── app/                 # App Router pages
│   ├── components/          # React components
│   ├── hooks/               # Custom hooks
│   └── lib/                 # API clients, stores
│
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── main.py          # Entry point
│   │   ├── core/            # Config, security
│   │   ├── sessions/        # Session management
│   │   ├── gns3/            # GNS3 integration
│   │   ├── devices/         # Device operations
│   │   ├── config_engine/   # Config generation
│   │   └── api/routes/      # API endpoints
│   └── tests/
│
├── setup.sh / setup.bat     # Setup scripts
├── start.sh / start.bat     # Start scripts
└── docker-compose.yml       # Docker configuration
```

## 🎓 Supported Configuration

### Switching
- VLANs with names
- Trunk ports (allowed VLANs, native VLAN)
- Access ports
- EtherChannel (LACP, PAgP, static)
- Spanning Tree (PVST, Rapid-PVST)
- PortFast, BPDU Guard

### Routing
- OSPF (process, areas, networks)
- GRE tunnels
- Static routes

### Services
- HSRP (VIP, priority, preempt)
- DHCP pools with exclusions
- NAT/PAT with overload

### Security
- Standard ACLs (1-99)
- Extended ACLs (100-199, named)
- Interface/VTY application

## 📚 Documentation

- [QUICKSTART.md](./QUICKSTART.md) - Get started in 5 minutes
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical deep-dive
- [backend/README.md](./backend/README.md) - Backend details
- [backend/EXAMPLES.md](./backend/EXAMPLES.md) - API examples

## 🔒 Environment Variables

### Backend (.env)
```env
MOCK_MODE=true
CORS_ORIGINS=http://localhost:3000
SESSION_TTL=7200
LOG_LEVEL=INFO
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

