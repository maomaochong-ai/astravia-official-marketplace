# API 踩坑记录与错误处理

## API 踩坑记录（实战验证）

1. `POST /desform/add` 现已直接返回表单实体（含 ID），`desform_utils.py` 已优先从返回值获取 ID，旧版后端不返回时自动 fallback 到 list 搜索
2. `GET /desform/queryByCode` **不可靠**（部分表单查不到），推荐用 `GET /desform/queryByIdOrCode?desformCode={code}`
3. `queryByIdOrCode` 对新创建但未保存设计的表单也可能返回失败，此时需通过 list API 全量搜索
4. list API 的 `desformCode` 过滤参数**不可靠**（有时匹配不到），必须全量搜索后手动精确匹配
5. `PUT /desform/edit` 的 `updateCount` 必须传**当前数据库中的值**（不是 +1），后端会自动递增
6. `DELETE /desform/deleteBatch` 是**逻辑删除**（放入回收站），表单 code 仍被占用
7. `DELETE /desform/recycleBin/deleteByIds` 可彻底删除回收站中的表单，释放 code。`delete_form` 已封装完整流程，支持传 code 或 ID
8. `PUT /desform/recycleBin/recoverByIds` 可从回收站恢复表单
9. `DELETE /desform/recycleBin/empty` 清空回收站（在演示环境中可能不完全生效）
10. **删除后重建时序问题：** 彻底删除表单后，code 释放可能有延迟。如果 `add` 返回 `该code已存在`，说明该 code 之前被另一个表单占用（同 code 可能存在多条记录）。此时应通过 list 全量搜索找到占用该 code 的表单，对其执行 `deleteBatch` + `recycleBin/deleteByIds` 彻底删除后再重建
11. **`save_design` 报「未找到对应实体」：** 通常是因为使用了已被删除的旧表单 ID。`find_or_create_form` 可能返回旧 ID（缓存或竞态），此时需通过 list API 重新搜索获取最新有效 ID
12. **`echo` 管道传 JSON 时禁止手动转义中文**：bash 的 `echo` 原生支持 UTF-8，直接写原始汉字即可。手动将汉字转为 `\uXXXX` 转义极易笔误（如 `\u7efc` 综 vs `\u7efb` 绻），导致表单名称/字段名乱码。

## `create_form` vs `save_design` 使用区别

- **推荐始终使用 `create_form`**（一站式：查找/创建 + 保存设计），它会自动解包 tuple、确定标题字段、处理 updateCount
- `save_design` 是底层函数，签名为 `save_design(form_id, form_code, widgets, title_model, update_count)`
  - `widgets` 参数需要传**解包后的 widget dict 列表**（不是 tuple），tuple 需先 `[w[0] for w in widgets_tuples]` 解包
  - `title_model` 是标题字段的 model 字符串（不是 index），可通过 `widgets_tuples[0][2]` 获取
  - 如需直接调用 `save_design`，务必先通过 `queryByIdOrCode` 获取最新 `updateCount`

## 命名规则

- 表单编码使用英文命名（不用拼音），模块名作为前缀
- 格式：`{模块}_{实体}`，如 `crm_customer`、`crm_contact`、`oa_leave_apply`
- 同一模块的表单共享前缀，便于分组管理

## `find_or_create_form` 策略（desform_utils.py 中已实现）

1. 先尝试 `POST /desform/add` 创建
2. 若 add 成功且返回值含 ID → 直接使用（新版后端已支持）
3. 若 add 成功但返回值无 ID → 通过 list API 全量搜索获取 ID（旧版兜底）
4. 若 add 失败（code已存在）→ 尝试 `queryByIdOrCode` 获取 ID
5. 若 queryByIdOrCode 也失败 → 通过 list API 全量搜索获取 ID

## 错误处理

| 错误 | 解决方案 |
|------|---------|
| Token 过期（401/认证失败） | 提示用户重新获取 X-Access-Token |
| `该code已存在` | **不要直接覆盖**，提示用户确认是否覆盖（参见 SKILL.md Step 2.5 防覆盖规则），用户确认后再用 `update_form` 更新设计 |
| `未找到对应实体` | 表单数据不一致（存在于 list 但无法编辑），需用 `deleteBatch` + `recycleBin/deleteByIds` 彻底删除后重建 |
| `表单编码过长` | desformCode 缩短到 200 字符以内 |
| `当前版本已过时，请刷新重试` | updateCount 传值错误，必须传当前值（通过 queryByIdOrCode 或 list 获取） |
| `add` 返回 `result: null` | 旧版后端行为，`desform_utils.py` 已自动 fallback 到 list 搜索；新版后端已直接返回实体 |
| `queryByCode` 返回 false | 该接口不可靠，改用 `queryByIdOrCode` 或 list 全量搜索 |
| 中文乱码 | 确认使用 Python urllib（不要用 curl） |
| 连接超时 | 确认后端地址可达，检查网络 |
| 字段权限创建失败 | 非致命警告，表单已创建成功。使用 `desform_auth_retry.py --code <form_code>` 重试，或在 Python 中调用 `save_auth_from_design(form_code)` |
