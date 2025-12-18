<div align="center">

# ESXi-Mate

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/react-18+-61dafb.svg)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ed.svg)](https://www.docker.com/)

**一个轻量级、现代化的 ESXi 单机管理 Web 界面。**

*比 vCenter 更简单，比官方 UI 更友好。*

[功能特性](#features) • [技术栈](#tech-stack) • [快速开始](#quick-start) • [本地开发](#development)

</div>

---

## 📖 <span id="intro">项目介绍</span>

**ESXi-Mate** 是一个从 [OpsNav](https://github.com/opsnav) 孵化出的独立开源项目，旨在为 ESXi 基础设施提供一个清爽、高效的管理面板。它通过 `pyVmomi` 直接与 ESXi 主机通信，无需依赖庞大的 vCenter Server。

> **适用人群**：Homelab 玩家、中小企业管理员，以及任何需要管理独立 ESXi 节点的用户。

## ✨ <span id="features">功能特性</span>

- **🚀 主机纳管**：轻松添加、监控和管理多台 ESXi 主机。
- **📊 资源监控**：实时可视化展示 CPU、内存和存储的使用情况。
- **💻 虚拟机管理**：支持电源操作（开机/关机/重置/断电）。
- **📦 克隆与置备**：支持虚拟机快速克隆，提供后台任务进度追踪。
- **🔧 Tools 集成**：通过 SSH 一键安装 VMware Tools。
- **⚡ 零依赖**：默认使用 SQLite 数据库，开箱即用，无需额外部署数据库。

## 🏗 <span id="tech-stack">技术栈</span>

| 领域 | 技术/版本 | 说明 |
|------|-----------|------|
| **后端** | **Python 3.11+** | 核心语言 |
| 框架 | **FastAPI** | 高性能 Web 框架 |
| 核心库 | **pyVmomi** | VMware vSphere API 官方 SDK |
| 数据库 | **SQLite** (默认) / MySQL | 支持 SQLAlchemy ORM |
| **前端** | **Node.js 20+** | 开发环境 |
| 框架 | **React 18** | UI 库 |
| 构建 | **Vite** | 极速构建工具 |
| 样式 | Tailwind CSS | 原子化 CSS |

## 🛠 <span id="compat">兼容性与环境要求</span>

### ESXi 版本
| 组件 | 版本 / 说明 |
|-----------|----------------|
| **VMware ESXi** | **7.0.0** (核心测试版本) |
| vCenter | 不支持 (专注于单机管理) |

### 部署环境 (Docker)
已在以下环境中验证通过：
*   **操作系统**: Linux (Ubuntu 22.04 / Debian 12 / CentOS 7+)
*   **Docker Engine**: 24.0+
*   **Docker Compose**: v2.20+

## 🚀 <span id="quick-start">快速开始 (Docker)</span>

使用 Docker Compose 是最快的上手方式。**默认配置开箱即用，无需修改任何文件即可启动。**

```bash
# 克隆仓库
git clone https://github.com/mykernel/ESXi-Mate.git
cd ESXi-Mate

# 启动服务
docker-compose up -d
```

启动后访问：**http://localhost:9528**

## ⚙️ <span id="config">高级配置 (可选)</span>

> 以下内容仅在您需要修改默认端口、数据库或跨域设置时参考，**初次使用请跳过**。

### 默认端口
- **前端 Web**: `9528`
- **后端 API**: `9601`

### 环境变量
后端默认预配置了 SQLite。你可以在 `backend/.env` 或 `docker-compose.yml` 中自定义：

| 变量名 | 默认值 | 说明 |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./esxi_mate.db` | 数据库连接字符串 (支持 MySQL) |
| `APP_PORT` | `9601` | 后端监听端口 |
| `CORS_ORIGINS` | `http://localhost:9528` | 允许的 CORS 跨域来源 |

## 💻 <span id="development">本地开发</span>

### 后端 (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### 前端 (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

## 📄 <span id="license">开源协议</span>

本项目基于 MIT 协议开源 - 详见 [LICENSE](LICENSE) 文件。

---
<div align="center">
  <sub>Built with ❤️ by the Open Source Community</sub>
</div>
