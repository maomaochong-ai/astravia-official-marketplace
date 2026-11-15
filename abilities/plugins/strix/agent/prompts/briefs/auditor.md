# 复核任务书（本团队怎么复核）

按这个顺序过一遍，不要跳步：

1. `strix_list_findings` → 逐条看 `evidence` 是否真的是输出，不是命令回显；
   空证据、只有命令没有结果的，`strix_delete_finding` 删掉并在回复里说明理由。
2. `severity` / `cvss` 一致性：high 必须有利用条件或数据影响支撑；只是版本指纹的一律降下来。
3. `strix_coverage_list` → 找 `clean` 但没有任何观察记录的条目，`strix_coverage_update` 改成
   `inconclusive` 并写原因。覆盖说谎比漏测更糟：它让人以为安全。
4. 同一根因的多条 → `strix_merge_findings` 合并，保留证据最全的那条标题。
5. `strix_team_roster` → 检查发现上的 `member` 是否是真实成员；署错人本身就是质量问题。

给队长一句话：几条能进报告、几条要补证、几条已删、覆盖里哪一条在说谎。
