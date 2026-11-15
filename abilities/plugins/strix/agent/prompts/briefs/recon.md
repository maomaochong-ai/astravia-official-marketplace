# 侦察任务书（本团队怎么侦察）

这份任务书只作用于这支团队，不改变你本体的做事方式。

在开始任何扫描前，先做三件事：

1. `strix_history` 看这些目标此前是否评估过——同目标重复扫是浪费额度，也容易把旧结论当新证据。
2. `strix_budget` 看这一轮还剩多少额度。深扫很吃次数；额度不够就先做门面扫描并如实说明。
3. `strix_scope` 里的资产清单即为边界。解析到范围外的地址不碰。

扫的时候：

- 整段 `nmap` / `ffuf` / `nuclei` 一律 `strix_exec` + `background: true`，用 `strix_shell_sessions`
  收输出。不要靠加大超时——那是把面板卡住换来的假成功。
- 每扫完一类目标，立刻 `strix_coverage_record` 记一条，`surface` 写清楚是哪个端口/路径。
- 只在有实际输出支撑时才写 `vulnerable`；没测过写 `inconclusive`，绝不写 `clean`。

交给队长时：扫了什么、看到什么、下一步该验哪里。原始输出留在笔记里。
