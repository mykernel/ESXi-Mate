# ESXi-Mate

独立的 ESXi 主机与虚拟机管理前后端（从 opsnav 拆分）。  
已验证环境：**VMware ESXi 7.0.0**；其他 ESXi 版本与 vCenter 暂未测试、不保证兼容。

## 核心特性
- ESXi 主机纳管/探测、列表、排序、同步
- 虚拟机列表与电源操作
- 虚拟机克隆、VMware Tools 安装（异步任务）
- 默认 SQLite 零配置启动，可选 MySQL

## 端口规划
- 后端 API: `9601`
- 前端 Web: `9528`

## 快速开始

### Docker Compose（推荐）
```bash
docker compose up --build
```
- 前端：`http://localhost:9528`
- 后端：`http://localhost:9601/api/docs`

### 本地开发
**后端**
```bash
cd backend
cp .env.example .env
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```
访问：`http://localhost:9601/api/docs`

**前端**
```bash
cd frontend
npm install
npm run dev
```
访问：`http://localhost:9528`

## 配置（后端 .env 关键变量）
`backend/.env.example` 示例（默认 SQLite）：
- `DATABASE_URL=sqlite:///./esxi_mate.db`
- `APP_PORT=9601`
- `CORS_ORIGINS=http://localhost:9528`

> CORS_ORIGINS 需包含实际前端访问域名/端口，多个以逗号分隔，例如：  
> `CORS_ORIGINS=http://localhost:9528,http://<your-server-ip>:9528`  
> 使用 https 时请写成 `https://...`，不建议用通配符。

使用 MySQL 示例：
```
DATABASE_URL=mysql+pymysql://user:password@127.0.0.1:3306/esxi_mate?charset=utf8mb4
```

## 国内网络加速
### Docker 镜像加速（示例腾讯云）
`/etc/docker/daemon.json`：
```json
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
```
然后重启 Docker：`sudo systemctl restart docker`

### pip/npm
- pip：阿里云 PyPI（构建时 `PIP_INDEX_URL`）
- npm：`npmmirror`（构建时 `npm config set registry https://registry.npmmirror.com`）
