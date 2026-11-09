# magpie 决策记录

`abilities/plugins/magpie` 的设计记录。这个插件只做一件事：把本机 magpie 网关的模型目录接进
Astravia。下面记的是这件事上真正做过取舍的地方。

| 编号 | 决定的 |
| --- | --- |
| [0001](0001-the-panel-installs-what-it-connects-to.md) | 面板自己装它要连的东西：feed 取官方构建、按公布的 SHA-256 校验、落到 `~/.local/bin`，再以子进程跑 `magpie serve`；不打包二进制、不装系统服务、不 sudo |
