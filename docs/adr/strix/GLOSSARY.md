# strix：共用词汇

只放词，不放实现决定；决定在 `docs/adr/strix/`。

- **execution environment / 执行环境**：一次扫描里工具实际被执行的地方。三种形态：
  `host`（当前用户下直接跑）、`docker`（容器内）、`wsl`（Windows 上借已有发行版）。
- **toolchain / 工具链**：可执行文件本身（nmap、nuclei 等），与执行环境无关。
- **environment mode**：本次扫描采用的执行环境形态。开始时快照，扫描中途不切换。
- **scan mode / 扫描模式**：`quick` / `standard` / `deep` / `diff`，决定预算与覆盖面；
  与 environment mode 是两件事，同为会话属性、同样在开始时快照。
- **ready / 就绪**：**环境**可用。插件被加载完成不叫就绪；这两件事要分开说。
- **degraded / 降级**：环境可用但隔离较弱（通常是 `host` 形态）。
- **unavailable**：环境不可用，通常因为工具链没装上，需要宿主准备。
- **sandbox / 沙箱**：`docker` 与 `wsl` 两种形态的统称；`host` 不是沙箱。
- **bridge / 桥接服务**：插件渲染侧与 `dist/service/main.mjs` 之间的本地服务通道。
- **panel / 面板**：宿主里的活动标签，只做展示与操作。
- **loop / 循环**：驱动模型与工具往返的那段逻辑。**归宿主**，插件不持有（0003）。
- **sandbox worker / 沙箱 worker**：同一次评估里在**同一个沙箱**内并行分工的进程，共享
  findings 台账；由插件发起，宿主看不见。**不是**宿主子智能体。
- **host subagent / 宿主子智能体**：宿主的会话级并行任务，有自己的会话与生命周期，
  出现在宿主的子智能体面板里。插件只能观察它的启停，不能派生。
- **finding / 发现**：一条可复核的漏洞或风险项，带证据与复现路径，落在 findings 台账。
- **coverage / 覆盖**：已测过与未测过的面，决定报告能否收尾。
- **scan mode 与 environment mode 不可混称**：前者说「测多深」，后者说「在哪测」。
