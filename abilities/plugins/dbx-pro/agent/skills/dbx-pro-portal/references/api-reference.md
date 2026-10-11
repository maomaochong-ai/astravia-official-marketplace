# 门户 API 补充参考

本文件包含门户管理中较少使用的补充 API。核心 CRUD API 已在 SKILL.md 中描述。

## 修改默认首页

```
POST {API_BASE}/eoa/portalapp/portalDesign/updateIzDefault
Body: { "id": "门户ID", "izDefault": "1" }
```
用户在右上角头像→"切换首页"中选择门户。`izDefault: "1"` 设为默认，`"0"` 取消。

## 复制模板到个人门户

```
GET {API_BASE}/eoa/portalapp/portalDesign/copyTemplateData
```
将 template（个人门户模版）的 designJson 复制到当前用户的 personal（个人工作台）。

## 重置个人门户

```
GET {API_BASE}/eoa/portalapp/portalDesign/resetData
```
将个人工作台重置为模版内容。

## 查询门户（运行时渲染）

```
GET {API_BASE}/eoa/portalapp/portalDesign/queryPortal?portalCategory={type}
```
运行时加载门户数据。type 可选 system/template/personal，普通门户用 `id` 参数查询。

## 逻辑删除 vs 物理删除

```
DELETE {API_BASE}/eoa/portalapp/portalDesign/delete?id={id}        # 逻辑删除
DELETE {API_BASE}/eoa/portalapp/portalDesign/physicalDelete?id={id} # 物理删除
```
门户管理页面使用物理删除。

## 预览路由规则

- system/template/personal 类型：`/portal-view/{portalCategory}`
- common 类型：`/portal-view/{portalId}`

## 操作权限

- system 和 template 的设计/编辑需要 `portal:system:template:edit` 权限
- system 和 template 不允许删除
- 设置菜单按钮仅 common 类型可用

## 门户类型切换

通过 edit 接口修改 `portalCategory` 字段：
```
POST {API_BASE}/eoa/portalapp/portalDesign/edit
Body: { "id":"xxx", "name":"xxx", "code":"xxx", "portalCategory":"common", ... }
```
将 personal 改为 common 后，个人工作台位置空出，可创建新的个人工作台。

## Web 端与移动端同步规则

- **内容同步**：Web 端设计后，移动端自动同步
- **样式隔离**：移动端可独立调整组件顺序和样式
- **删除隔离**：组件删除只影响当前端

## 门户设置为菜单

普通门户可通过生成菜单 SQL 添加到系统菜单，将门户授权给角色后用户即可通过菜单访问。

## 自定义门户组件

参考文档：https://help.jeecg.com/ui/2dev/customizePortalComponent
