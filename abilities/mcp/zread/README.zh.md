# Zread

此可选能力使 Astravia 通过 Streamable HTTP 连接 Zread 托管的 MCP 服务：<https://api.z.ai/api/mcp/zread/mcp>。Zread 依据某个 GitHub 仓库自己的文档、目录结构和源码文件回答关于该仓库的问题。

Zread 目前**只对 GLM Coding Plan 订阅用户开放**，并且**按请求计费**。请在 Z.ai 控制台创建 Key，并在 Coding Plan 页核对当前额度。在 Astravia 安装表单中仅输入 Key 本身，`mcp.json` 会组装 `Authorization: Bearer {value}`。不要把真实 Key 放入仓库、Issue、提示词或日志。

服务提供三个工具：`search_doc`（检索仓库文档，含近期 Issue 与提交）、`get_repo_structure`（仓库或某个子目录的目录结构）、`read_file`（读取单个文件的全文）。本连接不设置工具白名单，工具集以服务端实际发布为准，上游可能调整。仓库需为服务可访问的公开仓库，私有仓库不在覆盖范围内。

工具输入（包括仓库名、路径、搜索词）会离开 Astravia，通过 HTTPS 发往 `api.z.ai`；返回内容随后可能依客户端设置交给模型提供方。Zread 返回的一切都是仓库内容，应当作待核对的材料，而不是结论。

Astravia 按现有设置机制保存已安装的 MCP 配置。安装表单中的敏感输入遮罩不等于承诺落盘加密；请使用限定权限的 Key 并保护本地配置及备份。

卡片图像为 zread.ai 发布的官方图标，未做修改；来源与校验和见 [BRAND-ASSET.md](BRAND-ASSET.md)。市场仓的 MIT 许可不转让该标识的权利。
