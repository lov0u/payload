# Payload CMS - 纯后端部署

这是一个纯后端的 Payload CMS 项目，基于官方 blank 模板创建，删除了前端部分，只保留管理后台和 API。

## 项目结构

```
payload-standalone/
├── src/
│   ├── collections/      # 数据集合定义
│   │   ├── Users.ts     # 用户集合
│   │   ├── Media.ts     # 媒体集合
│   │   ├── Folders.ts   # 文件夹集合
│   │   └── Tags.ts      # 标签集合
│   ├── app/
│   │   └── (payload)/   # Payload 管理后台和 API
│   └── payload.config.ts # Payload 配置
├── docker-compose.yml   # Docker 编排
├── Dockerfile          # Docker 构建文件
└── .github/workflows/  # CI/CD 工作流
```

## 技术栈

- **Payload CMS 3.20.0** - 内容管理系统
- **PostgreSQL 16** - 数据库
- **Next.js 15** - 框架
- **Docker** - 容器化部署

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 http://localhost:3000/admin 创建管理员账户

## Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f payload
```

## 自动部署

项目已配置 GitHub Actions 自动部署流程：
- 推送到 main 分支自动触发
- 构建 Docker 镜像并推送到阿里云 ACR
- 服务器自动拉取最新镜像并重启

## 环境变量

在 `.env` 文件中配置：
- `PAYLOAD_SECRET` - Payload 加密密钥
- `DATABASE_URI` - PostgreSQL 连接字符串
- `NEXT_PUBLIC_SERVER_URL` - 公开访问 URL

## GitHub Secrets 配置

需要在 GitHub 仓库设置以下 Secrets：
- `ACR_USERNAME` - 阿里云 ACR 用户名
- `ACR_PASSWORD` - 阿里云 ACR 密码
- `SERVER_HOST` - 服务器 IP
- `SERVER_USER` - SSH 用户名
- `SERVER_SSH_KEY` - SSH 私钥

## 访问地址

- 管理后台：https://payload.ra0.cn/admin
- API：https://payload.ra0.cn/api

## 说明

这个项目只包含 Payload CMS 后端，没有前端网站。如果需要前端，可以参考官方 templates 目录下的其他模板。
