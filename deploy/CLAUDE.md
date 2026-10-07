# deploy/
> L2 | 父级: ../CLAUDE.md

成员清单
OAUTH.md: Google/GitHub 共用 PKCE 契约、两套 OAuth App 和真实验收边界；记录账号匹配分流、官方身份绑定与发布状态，不保存 Secret
docker/: API/Chat 共用的开发与生产构建定义；dev 为 Compose 依赖层，production 为 Cloud Run 独立镜像
cloudbuild.yaml: API/Chat 触发器共享的参数化构建发布步骤，镜像绑定 Git 提交号，更新镜像时保留服务环境配置
README.md: 开发与生产入口、资源/变量/身份与发布回退；区分支付供应商环境、Git 分支和数据库，说明首次支付部署必须准备的平台配置

职责: 管理 Folune 后端构建与部署契约；开发和生产共用代码及 Dockerfile，通过构建阶段与运行时环境隔离，服务密钥不进入镜像层。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
