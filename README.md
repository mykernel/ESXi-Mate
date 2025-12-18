# ESXi-Mate

ESXi-Mate 是从 opsnav 拆分出来的独立 ESXi 主机与虚拟机管理项目。

已验证环境：**VMware ESXi 7.0.0**。其他 ESXi 版本及 vCenter **暂未测试，不做保证**。

## 端口规划
- 后端 API: `9601`
- 前端 Web: `9528`

## 本地开发（前后端）

### 后端
```bash
cd backend
cp .env.example .env
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

访问：`http://localhost:9601/api/docs`

### 前端
```bash
cd frontend
npm install
npm run dev
```

访问：`http://localhost:9528`

## Docker Compose 部署
```bash
docker compose up --build
```

前端：`http://localhost:9528`  
后端：`http://localhost:9601/api/docs`

## 国内网络加速（推荐）

### Docker 镜像加速器（示例：腾讯云）
在国内网络环境下，建议配置 Docker Registry Mirror，否则拉取基础镜像可能很慢或失败。

1. 创建或编辑 `/etc/docker/daemon.json`：
```json
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
```

2. 重启 Docker：
```bash
sudo systemctl restart docker
```

3. 验证：
```bash
docker info | grep -A2 "Registry Mirrors"
```

### pip/npm 国内源
本项目 Dockerfile 已默认配置：
- pip：使用阿里云 PyPI 镜像（构建时参数 `PIP_INDEX_URL`）
- npm：使用 `npmmirror`（构建时 `npm config set registry https://registry.npmmirror.com`）

## 环境变量说明（后端）
`backend/.env.example` 提供默认配置示例，默认使用 SQLite：
- `DATABASE_URL=sqlite:///./esxi_mate.db`
- `APP_PORT=9601`
- `CORS_ORIGINS=http://localhost:9528`

如需 MySQL，可改用：
```
DATABASE_URL=mysql+pymysql://user:password@127.0.0.1:3306/esxi_mate?charset=utf8mb4
```
