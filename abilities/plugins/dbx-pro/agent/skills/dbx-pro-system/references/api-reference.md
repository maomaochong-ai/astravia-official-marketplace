# JeecgBoot 系统管理模块 API 完整参考

---

## 1. 用户管理 `/sys/user`

**Controller:** `system/controller/SysUserController.java`
**前端API:** `user/user.api.ts`

### 基础 CRUD

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/user/list` | 分页查询用户（租户隔离） | Query: `pageNo`, `pageSize`, SysUser字段 |
| GET | `/sys/user/listAll` | 查全部用户（不做租户隔离） | Query: `pageNo`, `pageSize`, SysUser字段 |
| POST | `/sys/user/add` | 新增用户 | Body: JSONObject（SysUser字段 + `selectedroles` + `selecteddeparts` + `relTenantIds`） |
| PUT/POST | `/sys/user/edit` | 编辑用户 | Body: JSONObject（含 `id`） |
| DELETE | `/sys/user/delete` | 删除单个用户 | Query: `id` |
| DELETE | `/sys/user/deleteBatch` | 批量删除 | Query: `ids`（逗号分隔） |
| GET | `/sys/user/queryById` | 按ID查询 | Query: `id` |

### 查询相关

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/user/queryByIds` | 按多ID批量查询 | Query: `userIds`（逗号分隔） |
| GET | `/sys/user/queryByNames` | 按多用户名批量查询 | Query: `userNames`（逗号分隔） |
| GET | `/sys/user/queryUserAndDeptByName` | 按用户名查用户及部门 | Query: `userName` |
| GET | `/sys/user/queryByOrgCode` | 按orgCode查用户（含子部门） | Query: `orgCode`, SysUser字段, `pageNo`, `pageSize` |
| GET | `/sys/user/queryUserComponentData` | 用户选择组件专用分页查询 | Query: `departId`, `username`, `realname`, `id`, `isMultiTranslate`, `pageNo`, `pageSize` |
| GET | `/sys/user/selectUserList` | 流程用户选择组件分页查询 | Query: `departId`, `roleId`, `keyword`, `excludeUserIdList`, `includeUsernameList`, `pageNo`, `pageSize` |
| GET | `/sys/user/appUserList` | APP端用户列表 | Query: `keyword`, `username`, `syncFlow`, `pageNo`, `pageSize` |
| GET | `/sys/user/checkOnlyUser` | 校验用户账号唯一 | Query: SysUser字段（通常传 `username`） |
| GET | `/sys/user/searchByKeyword` | 关键词搜索部门和用户 | Query: `keyword` |

### 角色-用户关系

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/user/queryUserRole` | 查用户拥有的角色ID列表 | Query: `userid` |
| GET | `/sys/user/userRoleList` | 角色下用户分页列表 | Query: `roleId`, `username`, `realname`, `pageNo`, `pageSize` |
| POST | `/sys/user/addSysUserRole` | 给角色添加用户 | Body: `{"roleId":"...", "userIdList":["..."]}` |
| DELETE | `/sys/user/deleteUserRole` | 删除角色用户关系 | Query: `roleId`, `userId` |
| DELETE | `/sys/user/deleteUserRoleBatch` | 批量删除角色用户关系 | Query: `roleId`, `userIds`（逗号分隔） |

### 部门-用户关系

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/user/userDepartList` | 查用户关联的部门列表 | Query: `userId` |
| GET | `/sys/user/departUserList` | 部门用户分页列表 | Query: `depId`, `username`, `pageNo`, `pageSize` |
| GET | `/sys/user/queryByDepId` | 按部门ID查用户 | Query: `id`（部门ID）, `realname` |
| POST | `/sys/user/editSysDepartWithUser` | 给部门添加用户 | Body: `{"depId":"...", "userIdList":["..."]}` |
| DELETE | `/sys/user/deleteUserInDepart` | 删除部门用户关系 | Query: `depId`, `userId` |
| DELETE | `/sys/user/deleteUserInDepartBatch` | 批量删除部门用户关系 | Query: `depId`, `userIds`（逗号分隔） |
| GET | `/sys/user/getCurrentUserDeparts` | 查当前登录用户的所有部门 | 无参数 |

### 用户组关系

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| POST | `/sys/user/addSysUserGroup` | 给用户组添加用户 | Body: `{"groupId":"...", "userIdList":["..."]}` |
| DELETE | `/sys/user/deleteGroupUser` | 删除用户组用户关系 | Query: `groupId`, `userId` |
| DELETE | `/sys/user/deleteUserGroupBatch` | 批量删除用户组用户关系 | Query: `groupId`, `userIds` |
| GET | `/sys/user/groupUserList` | 用户组下用户分页查询 | Query: `groupId`, `username`, `realname`, `pageNo`, `pageSize` |

### 密码相关

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| PUT | `/sys/user/resetPassword` | 重置为系统默认密码（admin权限） | Query: `usernames`（逗号分隔） |
| PUT | `/sys/user/changePassword` | 管理员修改密码 | Body: SysUser（`username`, `password`） |
| PUT | `/sys/user/updatePassword` | 用户自改密码 | Body: `{"username":"...","oldpassword":"...","password":"...","confirmpassword":"..."}` |

### 冻结/回收站

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| PUT | `/sys/user/frozenBatch` | 冻结/解冻 | Body: `{"ids":"...", "status":"0或1"}` |
| GET | `/sys/user/recycleBin` | 回收站列表 | 无参数 |
| PUT | `/sys/user/putRecycleBin` | 还原 | Body: `{"userIds":"..."}` |
| DELETE | `/sys/user/deleteRecycleBin` | 彻底删除 | Query: `userIds`（逗号分隔） |

### 导入导出

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/user/exportXls` | 导出Excel | Query: SysUser字段, `selections`, `departId`, `exportFields` |
| POST | `/sys/user/importExcel` | 导入Excel | Multipart 文件上传 |

### 其他

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/user/generateUserId` | 生成UUID | 无参数 |
| GET | `/sys/user/getUserSectionInfoByToken` | 按Token获取用户基本信息（表单设计器用） | Query: `token` |
| PUT | `/sys/user/userQuitAgent` | 用户离职（设代理人） | Body: SysUserAgent |
| GET | `/sys/user/getQuitList` | 离职用户列表 | 无参数 |
| PUT | `/sys/user/putCancelQuit` | 取消离职 | Body: `{"userIds":"...","usernames":"..."}` |
| PUT | `/sys/user/changeLoginTenantId` | 切换登录租户 | Body: SysUser（含 `loginTenantId`） |

**SysUser 主要字段：** `id`, `username`, `realname`, `password`, `avatar`, `birthday`, `sex`(1男2女), `email`, `phone`, `orgCode`, `status`(0冻结/1正常), `post`(岗位ID), `departIds`(负责部门), `userIdentity`(1普通/2上级), `loginTenantId`

---

## 2. 角色管理 `/sys/role`

**Controller:** `system/controller/SysRoleController.java`
**前端API:** `role/role.api.ts`

### 基础 CRUD

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/role/list` | 分页查询（不做租户隔离） | Query: `pageNo`, `pageSize`, SysRole字段, `isMultiTranslate` |
| GET | `/sys/role/listByTenant` | 分页查询（租户隔离） | Query: `pageNo`, `pageSize`, SysRole字段 |
| POST | `/sys/role/add` | 新增角色 | Body: SysRole（`roleName`, `roleCode`, `description`） |
| PUT/POST | `/sys/role/edit` | 编辑角色 | Body: SysRole（含 `id`） |
| DELETE | `/sys/role/delete` | 删除单个 | Query: `id` |
| DELETE | `/sys/role/deleteBatch` | 批量删除 | Query: `ids`（逗号分隔） |
| GET | `/sys/role/queryById` | 按ID查询 | Query: `id` |

### 查询相关

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/role/queryall` | 全部角色（租户隔离） | 无参数 |
| GET | `/sys/role/queryallNoByTenant` | 全部系统角色（不做租户隔离） | 无参数 |
| GET | `/sys/role/checkRoleCode` | 校验角色编码唯一 | Query: `id`（编辑时传）, `roleCode` |
| GET | `/sys/role/queryPageRoleCount` | 角色及用户数量 | Query: `pageNo`, `pageSize` |

### 权限管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/role/queryTreeList` | 菜单权限树（角色授权用） | 无参数 |
| GET | `/sys/role/datarule/{permissionId}/{roleId}` | 查角色菜单数据规则 | PathVar: `permissionId`, `roleId` |
| POST | `/sys/role/datarule` | 保存数据规则 | Body: `{"permissionId":"...","roleId":"...","dataRuleIds":"..."}` |
| GET | `/sys/permission/queryRolePermission` | 查角色权限 | Query: `roleId` |
| POST | `/sys/permission/saveRolePermission` | 保存角色权限 | Body: `{"roleId":"...","permissionIds":"...","lastpermissionIds":"..."}` |

### 导入导出

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/role/exportXls` | 导出Excel | Query: SysRole字段, `exportFields` |
| POST | `/sys/role/importExcel` | 导入Excel | Multipart 文件上传 |

**SysRole 主要字段：** `id`, `roleName`, `roleCode`, `description`, `tenantId`, `createTime`

---

## 3. 部门管理 `/sys/sysDepart`

**Controller:** `system/controller/SysDepartController.java`
**前端API:** `depart/depart.api.ts`, `departUser/depart.user.api.ts`

### 基础 CRUD

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| POST | `/sys/sysDepart/add` | 新增部门 | Body: SysDepart（`departName`, `parentId`, `orgCode`, `orgCategory`） |
| PUT/POST | `/sys/sysDepart/edit` | 编辑部门 | Body: SysDepart（含 `id`） |
| DELETE | `/sys/sysDepart/delete` | 删除单个 | Query: `id` |
| DELETE | `/sys/sysDepart/deleteBatch` | 批量删除（含子级） | Query: `ids`（逗号分隔） |

### 树查询

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/sysDepart/queryTreeList` | 查所有部门树 | Query: `ids`（可选，回显用） |
| GET | `/sys/sysDepart/queryDepartTreeSync` | 异步加载部门树节点 | Query: `pid`, `ids`, `primaryKey`(id或orgCode) |
| GET | `/sys/sysDepart/queryDepartAndPostTreeSync` | 异步加载部门+岗位树 | Query: `pid`, `ids`, `primaryKey`, `departIds`, `name` |
| GET | `/sys/sysDepart/queryMyDeptTreeList` | 我负责的部门树 | 无参数 |
| GET | `/sys/sysDepart/queryIdTree` | 部门ID树（选择组件用） | 无参数 |
| GET | `/sys/sysDepart/queryTreeByKeyWord` | 按关键词搜索部门树+用户 | Query: `keyWord` |

### 查询相关

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/sysDepart/searchBy` | **按名称查部门 ID（推荐）**，支持模糊搜索，取返回列表第一条 | Query: `keyWord`(URL编码), `orgCategory`(1,2,3,4), `myDeptSearch`, `departIds` |
| GET | `/sys/sysDepart/listAll` | 所有部门列表（扁平） | Query: `id`（可选） |
| GET | `/sys/sysDepart/queryByIds` | 批量按ID查询 | Query: `deptIds`（逗号分隔） |
| GET | `/sys/sysDepart/queryAllParentId` | 某部门所有父级ID | Query: `departId` 或 `orgCode` |
| GET | `/sys/sysDepart/getDepartName` | 按orgCode获取部门信息 | Query: `orgCode` |
| GET | `/sys/sysDepart/getDepartPathNameByOrgCode` | 部门完整路径名 | Query: `orgCode`, `depId` |
| GET | `/sys/sysDepart/getMyDepartList` | 当前用户部门列表 | 无参数 |

### 岗位/职级相关

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/sysDepart/getPositionByDepartId` | 按部门ID和职级获取岗位 | Query: `parentId`, `departId`, `positionId` |
| GET | `/sys/sysDepart/getRankRelation` | 部门职级关系 | Query: `departId` |
| GET | `/sys/sysDepart/getALLRankRelation` | 所有职级关系 | Query: `departId`（可选） |
| GET | `/sys/sysDepart/getDepPostIdByDepId` | 部门下岗位ID | Query: `depIds`（逗号分隔） |

### 部门用户相关

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/sysDepart/getUsersByDepartId` | 按部门ID获取用户 | Query: `id` |
| GET | `/sys/sysDepart/getDepartmentHead` | 部门负责人分页列表 | Query: `departId`, `pageNo`, `pageSize` |
| PUT | `/sys/sysDepart/updateChangeDepart` | 更新部门位置（拖拽排序） | Body: SysChangeDepartVo |

### 导入导出

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/sysDepart/exportXls` | 导出Excel | Query: SysDepart字段, `selections` |
| POST | `/sys/sysDepart/importExcel` | 导入Excel | Multipart 文件上传 |

**SysDepart 主要字段：** `id`, `parentId`, `departName`, `departNameAbbr`, `orgCode`, `orgCategory`(1公司/4子公司/2部门/3岗位), `departOrder`, `mobile`, `fax`, `address`, `memo`

---

## 4. 职务/职级管理 `/sys/position`

**Controller:** `system/controller/SysPositionController.java`
**前端API:** `position/position.api.ts`

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/position/list` | 分页查询（按postLevel升序） | Query: `pageNo`, `pageSize`, SysPosition字段 |
| POST | `/sys/position/add` | 新增（code为空自动生成） | Body: SysPosition（`name`, `code`, `postLevel`） |
| PUT/POST | `/sys/position/edit` | 编辑 | Body: SysPosition（含 `id`） |
| DELETE | `/sys/position/delete` | 删除（同时删用户关系） | Query: `id` |
| DELETE | `/sys/position/deleteBatch` | 批量删除 | Query: `ids`（逗号分隔） |
| GET | `/sys/position/queryById` | 按ID查询 | Query: `id` |
| GET | `/sys/position/queryByCode` | 按code查询 | Query: `code` |
| GET | `/sys/position/queryByIds` | 多ID批量查询 | Query: `ids`（逗号分隔） |
| GET | `/sys/position/getPositionUserList` | 职务下用户分页列表 | Query: `positionId`, `pageNo`, `pageSize` |
| POST | `/sys/position/savePositionUser` | 添加用户到职务 | Query: `userIds`（逗号分隔）, `positionId` |
| DELETE | `/sys/position/removePositionUser` | 从职务移除用户 | Query: `userIds`（逗号分隔）, `positionId` |
| GET | `/sys/position/exportXls` | 导出Excel | Query: SysPosition字段, `selections`, `exportFields` |
| POST | `/sys/position/importExcel` | 导入Excel | Multipart 文件上传 |

**SysPosition 主要字段：** `id`, `code`, `name`, `postLevel`(1高管/2中层/3基层/4实习), `companyId`, `remark`, `tenantId`

---

## 5. 字典管理 `/sys/dict`

**Controller:** `system/controller/SysDictController.java`
**前端API:** `dict/dict.api.ts`

### 字典 CRUD

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/dict/list` | 分页列表 | Query: `pageNo`, `pageSize`, `keywords`（模糊匹配code+name） |
| POST | `/sys/dict/add` | 新增字典 | Body: SysDict（`dictName`, `dictCode`, `description`） |
| PUT/POST | `/sys/dict/edit` | 编辑字典 | Body: SysDict（含 `id`） |
| DELETE | `/sys/dict/delete` | 删除 | Query: `id` |
| DELETE | `/sys/dict/deleteBatch` | 批量删除 | Query: `ids`（逗号分隔） |

### 字典项查询（高频使用）

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/api/getDictItems?dictCode={dictCode}` | **获取字典选项列表** | Query: `dictCode` |
| GET | `/sys/dict/getDictText/{dictCode}/{key}` | 获取字典文本值 | Path: `dictCode`, `key` |
| GET | `/sys/dict/queryAllDictItems` | 获取全部字典数据（Map） | 无参数 |
| GET | `/sys/dict/loadDict/{dictCode}` | 下拉搜索异步加载 | Path: `dictCode`; Query: `keyword`, `sign`, `pageNo`, `pageSize` |
| GET | `/sys/dict/loadDictItem/{dictCode}` | 按key批量查文本 | Path: `dictCode`; Query: `key`, `sign`, `delNotExist` |

### 表字典查询

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/dict/loadTreeData` | 表字典树形数据 | Query: `pid`, `pidField`, `tableName`, `text`, `code`, `hasChildField`, `condition`, `sign` |
| GET | `/sys/dict/queryTableData` | 表字典分页查询（deprecated） | Query: DictQuery字段, `pageNo`, `pageSize`, `sign` |
| GET | `/sys/dict/treeList` | 树形字典数据 | Query: `pageNo`, `pageSize`, SysDict字段 |

### 回收站

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/dict/deleteList` | 回收站列表 | 无参数 |
| PUT | `/sys/dict/back/{id}` | 还原单条 | Path: `id` |
| PUT | `/sys/dict/putRecycleBin` | 批量还原 | Body: `{"ids":"id1,id2,..."}` |
| DELETE | `/sys/dict/deletePhysic/{id}` | 物理删除单条 | Path: `id` |
| DELETE | `/sys/dict/deleteRecycleBin` | 批量物理删除 | Query: `ids`（逗号分隔） |

### 缓存/导入导出

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET/POST | `/sys/dict/refleshCache` | 刷新字典缓存 | 无参数 |
| GET | `/sys/dict/exportXls` | 导出Excel | Query: SysDict字段, `selections` |
| POST | `/sys/dict/importExcel` | 导入Excel | Multipart 文件上传 |

**SysDict 主要字段：** `id`, `dictName`, `dictCode`, `description`, `tenantId`

---

## 6. 字典项管理 `/sys/dictItem`

**Controller:** `system/controller/SysDictItemController.java`
**前端API:** `dict/dict.api.ts`

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/dictItem/list` | 分页查询字典项 | Query: `pageNo`, `pageSize`, `dictId`（必传） |
| POST | `/sys/dictItem/add` | 新增字典项 | Body: `{"dictId":"...", "itemText":"...", "itemValue":"...", "description":"...", "sortOrder":1, "status":1}` |
| PUT/POST | `/sys/dictItem/edit` | 编辑字典项 | Body: SysDictItem（含 `id`） |
| DELETE | `/sys/dictItem/delete` | 删除 | Query: `id` |
| DELETE | `/sys/dictItem/deleteBatch` | 批量删除 | Query: `ids`（逗号分隔） |
| GET | `/sys/dictItem/dictItemCheck` | 字典值重复校验 | Query: `itemValue`, `dictId`, `id`（可选） |

**SysDictItem 主要字段：** `id`, `dictId`, `itemText`, `itemValue`, `itemColor`, `description`, `sortOrder`, `status`(0禁用/1启用)


**Python 请求示例（避免中文乱码）：**
```python
import urllib.request
import json

API = '<api_base>'
TOKEN = 'your-token'

def request(path, data=None, method='GET'):
    url = API + path
    headers = {
        'X-Access-Token': TOKEN,
        'Content-Type': 'application/json; charset=utf-8',  # 必须指定 UTF-8
    }
    if data:
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')  # ensure_ascii=False 避免中文乱码
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
    else:
        req = urllib.request.Request(url, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))
```

---

## 7. 租户管理 `/sys/tenant`

**Controller:** `system/controller/SysTenantController.java`
**前端API:** `tenant/tenant.api.ts`

### 基础 CRUD

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/tenant/list` | 分页查询 | Query: `pageNo`, `pageSize`, SysTenant字段, `beginDate`, `endDate` |
| POST | `/sys/tenant/add` | 新增租户 | Body: SysTenant（`name`, `beginDate`, `endDate`, `status`） |
| PUT/POST | `/sys/tenant/edit` | 编辑租户 | Body: SysTenant（含 `id`） |
| DELETE/POST | `/sys/tenant/delete` | 删除 | Query: `id` |
| DELETE | `/sys/tenant/deleteBatch` | 批量删除 | Query: `ids`（逗号分隔） |
| GET | `/sys/tenant/queryById` | 按ID查询 | Query: `id` |
| GET | `/sys/tenant/queryList` | 查询有效租户列表 | Query: `ids`（可选） |

### 用户-租户关系

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/tenant/getCurrentUserTenant` | 当前用户所有有效租户 | 无参数 |
| PUT | `/sys/tenant/invitationUserJoin` | 邀请用户加入租户 | Query: `ids`, `phone`/`username` |
| GET | `/sys/tenant/getTenantUserList` | 租户用户列表（分页） | Query: `pageNo`, `pageSize`, `userTenantId`, SysUser字段 |
| PUT | `/sys/tenant/leaveTenant` | 请离用户 | Query: `userIds`, `tenantId` |
| PUT | `/sys/tenant/agreeOrRejectUserJoin` | 同意/拒绝加入 | Body: SysUserTenant（`userId`, `status`） |
| PUT | `/sys/tenant/updateUserTenantStatus` | 更新用户租户状态 | Body: SysUserTenant |
| GET | `/sys/tenant/getTenantPageListByUserId` | 按用户ID查租户 | Query: `pageNo`, `pageSize`, SysUserTenantVo字段 |
| GET | `/sys/tenant/getTenantListByUserId` | 按userId获取租户列表 | Query: `userTenantStatus` |
| GET | `/sys/tenant/getUserTenantPageList` | 用户租户分页数据 | Query: `pageNo`, `pageSize`, `userTenantStatus`, `type` |

### 产品包管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/tenant/packList` | 产品包分页列表 | Query: `pageNo`, `pageSize`, SysTenantPack字段 |
| POST | `/sys/tenant/addPackPermission` | 创建产品包 | Body: SysTenantPack |
| PUT | `/sys/tenant/editPackPermission` | 编辑产品包 | Body: SysTenantPack |
| DELETE | `/sys/tenant/deleteTenantPack` | 删除产品包 | Query: `ids` |
| POST | `/sys/tenant/addTenantPackUser` | 添加用户到产品包 | Body: `{"tenantId":"...","packId":"...","userIds":"..."}` |
| PUT | `/sys/tenant/deleteTenantPackUser` | 从产品包移除用户 | Body: SysTenantPackUser |
| GET | `/sys/tenant/queryTenantPackUserList` | 产品包下用户列表 | Query: `tenantId`, `packId`, `status`, `pageNo`, `pageSize` |
| POST | `/sys/tenant/syncDefaultPack` | 初始化/同步默认产品包 | Query: `tenantId` |

### 回收站

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/tenant/recycleBinPageList` | 已删除租户列表 | Query: `pageNo`, `pageSize` |
| DELETE | `/sys/tenant/deleteLogicDeleted` | 彻底删除 | Query: `ids` |
| PUT | `/sys/tenant/revertTenantLogic` | 还原 | Query: `ids` |

### 其他

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| PUT/POST | `/sys/tenant/editOwnTenant` | 编辑自己的租户 | Body: SysTenant |
| POST | `/sys/tenant/saveTenantJoinUser` | 创建租户并关联当前用户 | Body: SysTenant |
| PUT | `/sys/tenant/cancelTenant` | 注销租户 | Body: SysTenant; Param: `loginPassword` |
| GET | `/sys/tenant/getTenantStatusCount` | 租户用户数量 | Query: `status`(default=1) |
| POST | `/sys/tenant/changeOwenUserTenant` | 变更租户拥有者 | Query: `userId`, `tenantId` |
| GET | `/sys/tenant/getTenantCount` | 当前租户部门和成员数量 | 无参数 |
| GET | `/sys/tenant/queryTenantAuthInfo` | 租户信息及管理员权限 | Query: `id` |

**SysTenant 主要字段：** `id`, `name`, `beginDate`, `endDate`, `status`(0禁用/1正常), `houseNumber`(门牌号), `applyStatus`

---

## 8. 分类字典 `/sys/category`

**Controller:** `system/controller/SysCategoryController.java`
**前端API:** `category/category.api.ts`

### 基础 CRUD

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/category/rootList` | 根节点分页列表 | Query: `pageNo`, `pageSize`, SysCategory字段（默认 `pid=0`） |
| GET | `/sys/category/childList` | 子节点列表 | Query: SysCategory字段 |
| POST | `/sys/category/add` | 新增 | Body: SysCategory（`name`, `code`, `pid`） |
| PUT/POST | `/sys/category/edit` | 编辑 | Body: SysCategory（含 `id`） |
| DELETE | `/sys/category/delete` | 删除 | Query: `id` |
| DELETE | `/sys/category/deleteBatch` | 批量删除 | Query: `ids`（逗号分隔） |
| GET | `/sys/category/queryById` | 按ID查询 | Query: `id` |

### 树查询

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/category/loadTreeRoot` | 加载一级节点（或全量） | Query: `async`(Boolean), `pcode` |
| GET | `/sys/category/loadTreeChildren` | 加载子节点 | Query: `pid` |
| GET | `/sys/category/loadTreeData` | 分类字典树控件数据 | Query: `pid`, `pcode`, `condition`(JSON) |
| GET | `/sys/category/loadDictItem` | 回显控件值 | Query: `ids`（逗号分隔）, `delNotExist` |
| GET | `/sys/category/loadAllData` | 全量数据（按code） | Query: `code`（必传） |
| GET | `/sys/category/getChildListBatch` | 批量查子节点 | Query: `parentIds`（逗号分隔） |
| GET | `/sys/category/loadOne` | 按字段回显单条 | Query: `field`, `val` |

### 其他

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/category/checkCode` | 校验编码规范性 | Query: `pid`, `code` |
| GET | `/sys/category/exportXls` | 导出Excel | Query: SysCategory字段, `selections` |
| POST | `/sys/category/importExcel` | 导入Excel | Multipart 文件上传 |

**SysCategory 主要字段：** `id`, `pid`, `name`, `code`, `tenantId`

---

## 9. 数据源管理 `/sys/dataSource`

**Controller:** `system/controller/SysDataSourceController.java`

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/dataSource/list` | 分页列表 | Query: `pageNo`, `pageSize`, SysDataSource字段 |
| GET | `/sys/dataSource/options` | 下拉选项（Online报表用） | Query: SysDataSource字段 |
| POST | `/sys/dataSource/add` | 新增 | Body: SysDataSource（`name`, `code`, `dbDriver`, `dbUrl`, `dbUsername`, `dbPassword`, `dbType`） |
| PUT/POST | `/sys/dataSource/edit` | 编辑 | Body: SysDataSource（含 `id`） |
| DELETE | `/sys/dataSource/delete` | 删除 | Query: `id` |
| DELETE | `/sys/dataSource/deleteBatch` | 批量删除 | Query: `ids`（逗号分隔） |
| GET | `/sys/dataSource/queryById` | 按ID查询（密码解密返回） | Query: `id` |
| GET | `/sys/dataSource/exportXls` | 导出Excel | Query: SysDataSource字段 |
| POST | `/sys/dataSource/importExcel` | 导入Excel | Multipart 文件上传 |

**注意：** `add`/`edit` 内置 `JdbcSecurityUtil.validate(dbUrl)` 防 JDBC URL 注入。密码存储加密，`queryById` 解密后返回。

**SysDataSource 主要字段：** `id`, `name`, `code`, `dbDriver`, `dbUrl`, `dbUsername`, `dbPassword`, `dbType`, `remark`

---

## 10. 定时任务 `/sys/quartzJob`

**Controller:** `quartz/controller/QuartzJobController.java`

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/quartzJob/list` | 分页列表 | Query: `pageNo`, `pageSize`, QuartzJob字段 |
| POST | `/sys/quartzJob/add` | 新增（同时注册到Quartz调度） | Body: QuartzJob（`jobClassName`, `cronExpression`, `parameter`, `description`, `status`） |
| PUT/POST | `/sys/quartzJob/edit` | 编辑（同时更新调度） | Body: QuartzJob（含 `id`） |
| DELETE | `/sys/quartzJob/delete` | 删除并停止 | Query: `id` |
| DELETE | `/sys/quartzJob/deleteBatch` | 批量删除并停止 | Query: `ids`（逗号分隔） |
| GET | `/sys/quartzJob/queryById` | 按ID查询 | Query: `id` |
| GET | `/sys/quartzJob/pause` | 暂停任务 | Query: `id` |
| GET | `/sys/quartzJob/resume` | 启动/恢复任务 | Query: `id` |
| GET | `/sys/quartzJob/execute` | 立即执行一次 | Query: `id` |
| GET | `/sys/quartzJob/exportXls` | 导出Excel | Query: QuartzJob字段, `selections` |
| POST | `/sys/quartzJob/importExcel` | 导入Excel（导入后为停用状态） | Multipart 文件上传 |

**QuartzJob 主要字段：** `id`, `jobClassName`(执行类名), `cronExpression`(Cron表达式), `parameter`(执行参数), `description`, `status`(0停用/-1删除/1运行)

---

## 11. 审批角色 `/sys/approvalRole`

**前端API:** `approvalrole/ApprovalRole.api.ts`

### 分组管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| POST | `/sys/approvalRole/group/add` | 新增审批角色分组 | Body: 分组信息 |
| POST | `/sys/approvalRole/group/edit` | 编辑分组 | Body: 含 `id` |
| DELETE | `/sys/approvalRole/group/delete` | 删除分组 | Query: `id` |

### 角色管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| POST | `/sys/approvalRole/role/add` | 新增审批角色 | Body: 角色信息 |
| POST | `/sys/approvalRole/role/edit` | 编辑审批角色 | Body: 含 `id` |
| DELETE | `/sys/approvalRole/role/delete` | 删除审批角色 | Query: `id` |
| GET | `/sys/approvalRole/loadTreeRoot` | 加载根节点 | 无参数 |
| GET | `/sys/approvalRole/loadTreeChildren` | 加载子节点 | Query: `pid` |
| GET | `/sys/approvalRole/search` | 搜索审批角色 | Query: `keyword` |

### 角色用户

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/approvalRoleUser/list` | 审批角色用户列表 | Query: 分页参数 |
| POST | `/sys/approvalRoleUser/add` | 添加用户 | Body: 用户关联信息 |
| POST | `/sys/approvalRoleUser/edit` | 编辑 | Body: 含 `id` |
| DELETE | `/sys/approvalRoleUser/delete` | 删除 | Query: `id` |
| GET | `/sys/approvalRoleUser/queryBy/user` | 查用户的审批角色 | Query: 用户信息 |
| POST | `/sys/approvalRoleUser/replace` | 替换用户 | Body: 替换信息 |

---

## 12. 用户组 `/sys/ugroup`

**前端API:** `ugroup/ugroup.api.ts`

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/ugroup/list` | 分页列表 | Query: `pageNo`, `pageSize` |
| POST | `/sys/ugroup/add` | 新增 | Body: 用户组信息 |
| POST | `/sys/ugroup/edit` | 编辑 | Body: 含 `id` |
| DELETE | `/sys/ugroup/delete` | 删除 | Query: `id` |
| DELETE | `/sys/ugroup/deleteBatch` | 批量删除 | Query: `ids` |
| GET | `/sys/ugroup/exportXls` | 导出 | 同上 |
| POST | `/sys/ugroup/importExcel` | 导入 | Multipart |

---

## 13. 菜单权限 `/sys/permission`

**前端API:** `menu/menu.api.ts`

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/sys/permission/list` | 菜单列表 | 无参数 |
| POST | `/sys/permission/add` | 新增菜单 | Body: SysPermission |
| POST | `/sys/permission/edit` | 编辑菜单 | Body: SysPermission（含 `id`） |
| DELETE | `/sys/permission/delete` | 删除 | Query: `id` |
| DELETE | `/sys/permission/deleteBatch` | 批量删除 | Query: `ids` |
| GET | `/sys/permission/queryPermissionRule` | 菜单数据规则列表 | Query: `permissionId` |
| POST | `/sys/permission/addPermissionRule` | 新增数据规则 | Body: 规则信息 |
| POST | `/sys/permission/editPermissionRule` | 编辑数据规则 | Body: 含 `id` |
| DELETE | `/sys/permission/deletePermissionRule` | 删除数据规则 | Query: `id` |
| GET | `/sys/permission/checkPermDuplication` | 校验菜单URL重复 | Query: URL信息 |
| GET | `/sys/permission/getUserPermissionByToken` | 按Token获取用户菜单和权限 | 无参数 |
| GET | `/sys/permission/queryRolePermission` | 查角色权限 | Query: `roleId` |
| POST | `/sys/permission/saveRolePermission` | 保存角色权限 | Body: 权限信息 |
| GET | `/sys/permission/queryDepartPermission` | 查部门权限 | Query: `departId` |
| POST | `/sys/permission/saveDepartPermission` | 保存部门权限 | Body: 权限信息 |

### Online 表单挂载菜单（实测验证 2026-03-31）

通过 API 将 Online 表单/报表添加为系统菜单并授权。

**Online 表单菜单参数：**
```json
{
  "id": "{headId}",
  "parentId": "",
  "name": "菜单名称",
  "url": "/online/cgformList/{headId}",
  "component": "1",
  "componentName": "OnlineAutoList",
  "menuType": 0,
  "sortNo": 1,
  "route": false,
  "leaf": true,
  "keepAlive": false,
  "hidden": false,
  "hideTab": false,
  "alwaysShow": false,
  "internalOrExternal": false,
  "status": "1",
  "delFlag": 0,
  "permsType": "0"
}
```

> **关键参数：** `component` 必须是 `"1"`（不是 vue 组件路径），`route` 必须是 `false`。`menuType`: `0`=一级菜单，`1`=子菜单（需配合 `parentId` 指向父菜单 ID）。

**授权给角色：**
```bash
# 1. 查询角色已有权限
GET /sys/permission/queryRolePermission?roleId={roleId}

# 2. 将新菜单ID追加到已有权限后保存
POST /sys/permission/saveRolePermission
{"roleId":"{roleId}","permissionIds":"{已有IDs},{新菜单ID}","lastpermissionIds":"{已有IDs}"}
```

---

## 14. 其他模块

### 通知公告 `/sys/annountCement`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sys/annountCement/list` | 列表 |
| POST | `/sys/annountCement/add` | 新增 |
| POST | `/sys/annountCement/edit` | 编辑 |
| DELETE | `/sys/annountCement/delete` | 删除 |
| GET | `/sys/annountCement/doReleaseData` | 发布 |
| GET | `/sys/annountCement/doReovkeData` | 撤回 |

### 在线用户 `/sys/online`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sys/online/list` | 在线用户列表 |
| POST | `/sys/online/forceLogout` | 强制下线 |

### 校验规则 `/sys/checkRule`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sys/checkRule/list` | 列表 |
| POST | `/sys/checkRule/add` | 新增 |
| PUT | `/sys/checkRule/edit` | 编辑 |
| DELETE | `/sys/checkRule/delete` | 删除 |
| GET | `/sys/checkRule/checkByCode` | 按规则编码校验值 |

### 填值规则 `/sys/fillRule`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sys/fillRule/list` | 列表 |
| POST | `/sys/fillRule/add` | 新增 |
| PUT | `/sys/fillRule/edit` | 编辑 |
| DELETE | `/sys/fillRule/delete` | 删除 |
| GET | `/sys/fillRule/testFillRule` | 测试规则 |

### 消息管理 `/sys/message/sysMessage`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sys/message/sysMessage/list` | 列表 |
| POST | `/sys/message/sysMessage/add` | 新增 |
| PUT | `/sys/message/sysMessage/edit` | 编辑 |
| DELETE | `/sys/message/sysMessage/delete` | 删除 |

### 消息模板 `/sys/message/sysMessageTemplate`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sys/message/sysMessageTemplate/list` | 列表 |
| POST | `/sys/message/sysMessageTemplate/add` | 新增 |
| PUT | `/sys/message/sysMessageTemplate/edit` | 编辑 |
| DELETE | `/sys/message/sysMessageTemplate/delete` | 删除 |
| POST | `/sys/message/sysMessageTemplate/sendMsg` | 发送测试消息 |

### 表白名单 `/sys/tableWhiteList`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sys/tableWhiteList/list` | 列表 |
| POST | `/sys/tableWhiteList/add` | 新增 |
| POST | `/sys/tableWhiteList/edit` | 编辑 |
| DELETE | `/sys/tableWhiteList/delete` | 删除 |

### 部门角色 `/sys/sysDepartRole`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sys/sysDepartRole/list` | 部门角色列表 |
| POST | `/sys/sysDepartRole/add` | 新增 |
| PUT | `/sys/sysDepartRole/edit` | 编辑 |
| DELETE | `/sys/sysDepartRole/deleteBatch` | 批量删除 |
| GET | `/sys/sysDepartRole/getDeptRoleList` | 部门角色用户列表 |
| POST | `/sys/sysDepartRole/deptRoleUserAdd` | 分配用户 |

---

## 公共 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sys/duplicate/check` | 通用唯一性校验 |
| POST | `/sys/common/upload` | 通用文件上传 |
| POST | `/sys/login` | 密码登录 |
| POST | `/sys/phoneLogin` | 手机号登录 |
| GET | `/sys/logout` | 登出 |
| GET | `/sys/user/getUserInfo` | 获取当前用户信息 |
| GET | `/sys/permission/getPermCode` | 获取用户权限编码 |
| GET | `/sys/randomImage` | 获取图片验证码 |
| POST | `/sys/sms` | 获取短信验证码 |
