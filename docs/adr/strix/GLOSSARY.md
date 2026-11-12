# strix：共用词汇

只放词，不放实现决定；决定在 `docs/adr/strix/`。

- **execution environment / 执行环境**：一次扫描里工具实际被执行的地方。三种形态：
  `host`（当前用户下直接跑）、`docker`（容器内）、`wsl`（Windows 上借已有发行版）。
- **toolchain / 工具链**：可执行文件本身（nmap、nuclei 等），与执行环境无关。
- **environment mode**：本次扫描采用的执行环境形态。开始时快照，扫描中途不切换。
- **ready / 就绪**：**环境**可用。插件被加载完成不叫就绪；这两件事要分开说。
- **degraded / 降级**：环境可用但隔离较弱（通常是 `host` 形态）。
- **unavailable**：环境不可用，通常因为工具链没装上，需要宿主准备。
- **sandbox / 沙箱**：`docker` 与 `wsl` 两种形态的统称；`host` 不是沙箱。
- **bridge / 桥接服务**：插件渲染侧与 `dist/service/main.mjs` 之间的本地服务通道。
