<div align="center">

# ESXi-Mate

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/react-18+-61dafb.svg)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ed.svg)](https://www.docker.com/)

**A lightweight, modern web interface for managing standalone VMware ESXi hosts.**

*Simpler than vCenter, friendlier than the default UI.*

[Features](#features) • [Quick Start](#quick-start) • [Development](#development) • [License](#license)

</div>

---

## 📖 Introduction

**ESXi-Mate** is an open-source project designed to provide a clean and efficient dashboard for managing ESXi infrastructure. It utilizes `pyVmomi` to communicate directly with ESXi hosts without the need for vCenter Server.

> **Target Audience**: Homelab users, SMB administrators, and anyone managing standalone ESXi nodes.

## ✨ Features

- **🚀 Host Management**: Add, monitor, and organize ESXi hosts.
- **📊 Resource Monitoring**: Real-time CPU, Memory, and Storage usage visualization.
- **💻 VM Operations**: Power control (On/Off/Reset/Shutdown).
- **📦 Clone & Provision**: Clone VMs quickly with task tracking.
- **🔧 Tools Integration**: One-click VMware Tools installation via SSH.
- **⚡ Zero Dependency**: Uses SQLite by default. No heavy database required.

## 🛠 Compatibility

| Component | Version / Note |
|-----------|----------------|
| **VMware ESXi** | **7.0.0** (Verified) |
| vCenter | Not supported (Standalone focus) |

## 🚀 Quick Start (Docker)

The fastest way to get started is using Docker Compose.

```bash
# Clone the repository
git clone https://github.com/mykernel/ESXi-Mate.git
cd ESXi-Mate

# Start services
docker-compose up -d
```

Access the dashboard at: **http://localhost:9528**

## ⚙️ Configuration

### Default Ports
- **Frontend**: `9528`
- **Backend API**: `9601`

### Environment Variables
The backend is pre-configured for SQLite. You can customize it in `backend/.env` or `docker-compose.yml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./esxi_mate.db` | DB Connection String (Supports MySQL) |
| `APP_PORT` | `9601` | Backend Port |
| `CORS_ORIGINS` | `http://localhost:9528` | Allowed CORS Origins |

## 💻 Local Development

### Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
<div align="center">
  <sub>Built with ❤️ by the Open Source Community</sub>
</div>
