# 全组件门户标准模板

创建包含全部 14 个组件的门户时，使用此模板。核心原则：**禁止硬编码数据源 ID**，所有外部数据源必须通过 API 动态查询。

> 推荐直接执行 `scripts/build_portal.py` 脚本，可自动完成数据源查询、designJson 构建和保存。

## 动态数据源查询

创建前必须并行查询以下 API（节省时间）：

```
# 1. CMS栏目 → 新闻组件数据源
GET /eoa/cms/eoaCmsMenu/treeList
→ 遍历 result 树，取 isShow=1 的栏目 { id, menuCode, title }

# 2. Design表单流程 → 快捷入口-审批类
GET /joa/designform/designFormCommuse/roleDegisnList
→ result 数组，每项 { id, desformName, desformCode, desformIcon, procName }

# 3. Online表单流程 → 快捷入口-审批类
GET /joa/designform/designFormCommuse/roleOnlineList
→ result 数组，每项 { id, desformName, desformCode, procName }

# 4. 自定义路由 → 快捷入口-路由类
GET /eoa/portalapp/portalCustomRoute/list?pageNo=1&pageSize=20
→ result.records 每项 { id, name, pcRoute, mobileRoute }

# 5. 知识库文件夹 → 知识库组件数据源
GET /sys/tenant/getCurrentUserTenantForFile
→ 获取租户ID后: GET /eoa/files/getIzRootFolderList?tenantId={id}&userId={userId}
```

## 组件配置规则

| 组件 | 数据源 | 有数据时 | 无数据时 |
|------|--------|---------|---------|
| JAppEnter | design/online流程 + URL | 3个Tab: OA审批 + 更多审批 + 系统导航 | 仅保留系统导航Tab |
| JCmsNews | CMS栏目 | 多Tab，每个栏目一个Tab | tabType=0, noTabsData=[] |
| JKnowledge | 知识库文件夹 | 多Tab | tabType=0, noTabsData=[] |
| JSchedule | 内置 | multiRange=["week","biweek","month"] | 固定配置 |
| JAppCarousel | 手动 | picsum.photos 图片 | list=[] |
| JMyFlow | 内置 | category=[0,1,2,3] | 固定配置 |
| JCollaPending | 内置 | category=[0,1,2,3] | 固定配置 |
| JSystemNotice | 内置 | msgCategory=["1","2"] | 固定配置 |
| 其他4个 | 内置 | 仅通用卡片样式 | 仅通用卡片样式 |

## 标准布局

**Web端（12栏网格，3列为主）：**
```
行0:  JAppCarousel (w=12,h=5) — 全宽轮播图, textAlign=bottom, headerStyle=3
行5:  JText (w=12,h=2)        — 欢迎语, 无标题栏, 蓝色粗体居中
行7:  JAppEnter (w=12,h=4)    — 全宽快捷应用, 3个Tab, 圆形图标
行11: JCmsNews(w=4,h=5) | JSystemNotice(w=4,h=5) | JProcessNotice(w=4,h=5)
行16: JMyFlow(w=4,h=5)  | JMyApplyFlow(w=4,h=5)   | JCollaPending(w=4,h=5)
行21: JSchedule(w=4,h=5)| JEmail(w=4,h=5)          | JMeeting(w=4,h=5)
行26: JKnowledge(w=6,h=5)     | JIframe(w=6,h=5)
```

**App端（单列，y间隔 = h+1）：** 高频操作前置
轮播图→快捷入口→流程中心→协同待办→新闻动态→系统公告→流程提醒→我的申请→我的计划→近期邮件→会议→知识库→iframe→欢迎语

## 各组件主题色

| 组件 | titleBarColor | titleColor | headerStyle |
|------|--------------|------------|-------------|
| JAppCarousel | #1890FF | #FFFFFF | 3 |
| JText | #1890FF | #000000 | 无标题栏 |
| JAppEnter | #722ED1 | #333333 | 2 |
| JCmsNews | #13C2C2 | #13C2C2 | 2 |
| JSystemNotice | #FA541C | #FA541C | 2 |
| JProcessNotice | #EB2F96 | #EB2F96 | 2 |
| JMyFlow | #1890FF | #1890FF | 2 |
| JMyApplyFlow | #722ED1 | #722ED1 | 2 |
| JCollaPending | #52C41A | #52C41A | 2 |
| JSchedule | #FAAD14 | #FAAD14 | 2 |
| JEmail | #2F54EB | #2F54EB | 2 |
| JMeeting | #F5222D | #F5222D | 2 |
| JKnowledge | #597EF7 | #597EF7 | 2 |
| JIframe | #FF7A45 | #FF7A45 | 2 |

## 快捷入口 infoList 构建

```python
# Design表单流程 → app类型入口
for i, flow in enumerate(design_flows):
    entry = {
        "jumpType": "app", "formType": "design",
        "id": flow["id"], "desformCode": flow["desformCode"],
        "desformName": flow["desformName"], "desformIcon": flow.get("desformIcon", ""),
        "procName": flow["procName"], "name": flow["desformName"],
        "imageUrl": "", "imgType": "system",
        "iconBgColor": colors[i % len(colors)], "sortId": str(i)
    }

# Online表单流程 → 同上, formType="online"

# URL路由 → url类型入口
entry = {
    "jumpType": "url", "webUrl": "/system/user", "appUrl": "",
    "showPlatform": ["web", "app"], "name": "用户管理",
    "imageUrl": "", "imgType": "system", "iconBgColor": "#1890FF",
    "id": uuid生成, "sortId": "0"
}
```

## 关键要点

- 禁止硬编码数据源ID — 不同环境数据不同
- 有则设置，无则留空 — 查不到数据时 infoList/noTabsData 设为空数组
- 支持Tab的组件默认开启Tab — JCmsNews、JAppEnter、JSchedule、JKnowledge 的 tabType=1
- Web 端默认 3 列（w=4, h=5），全宽 w=12，双栏 w=6
- App 端 w=12，y 间隔 = h+1，必须含 `width: "100%"` 和 `height: "100%"`
- UUID 使用 32 位无横杠格式，Web/App 同组件共享 `i` 值
- 轮播图用 `https://picsum.photos/id/{N}/1200/400`
- iconBgColor 自动分配不同颜色，避免相邻入口同色
