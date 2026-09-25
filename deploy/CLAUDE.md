# deploy/
> L2 | 父级: ../CLAUDE.md

成员清单
docker/: API/Chat 共用的开发与生产构建定义；dev 为 Compose 依赖层，production 为 Cloud Run 独立镜像
cloudbuild.yaml: API/Chat 触发器共享的参数化构建发布步骤，镜像绑定 Git 提交号，更新镜像时保留服务环境配置
README.md: 开发与生产入口、构建上下文、变量归属、触发器参数及发布验证边界

职责: 管理 Folune 后端构建与部署契约；开发和生产共用代码及 Dockerfile，通过构建阶段与运行时环境隔离，服务密钥不进入镜像层。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
