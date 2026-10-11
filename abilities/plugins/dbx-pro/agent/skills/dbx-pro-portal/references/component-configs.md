# 门户组件配置参考

本文件包含全部 14 个门户组件的详细配置项。SKILL.md 中处理组件配置修改（场景 F）时引用本文件。

## 目录

1. [通用卡片配置](#通用卡片配置)
2. [轮播图 JAppCarousel](#轮播图-jappcarousel)
3. [新闻动态 JCmsNews](#新闻动态-jcmsnews)
4. [系统公告 JSystemNotice](#系统公告-jsystemnotice)
5. [我的计划 JSchedule](#我的计划-jschedule)
6. [流程中心 JMyFlow](#流程中心-jmyflow)
7. [协同待办 JCollaPending](#协同待办-jcollapending)
8. [知识库 JKnowledge](#知识库-jknowledge)
9. [应用快捷入口 JAppEnter](#应用快捷入口-jappenter)
10. [iframe JIframe](#iframe-jiframe)
11. [文本 JText](#文本-jtext)
12. [无配置面板组件](#无配置面板组件)

---

## 通用卡片配置

所有组件共享以下配置：

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| 卡片名称 | `name` | string | 组件显示名称 |
| 卡片圆角 | `radius` | boolean | 是否启用圆角（默认 true），仅 Web 端 |
| 卡片投影 | `shadow` | boolean | 是否启用投影（默认 true），仅 Web 端 |
| 卡片描边 | `border` | boolean | 是否启用描边（默认 false），仅 Web 端 |
| 显示标题栏 | `defaultProps.showTitleBar` | boolean | 是否显示标题栏（默认 true） |
| 标题栏颜色 | `defaultProps.titleBarColor` | string | 标题栏版式颜色（默认 #1890ff） |
| 标题栏板式 | `defaultProps.headerStyle` | number | 1=图标+标题 / 2=竖线+标题 / 3=色块标签+底线（默认 1）。**样式3时 titleColor 禁止与 titleBarColor 同色**，否则文字不可见，建议使用 `#FFFFFF` |
| 标题文字大小 | `defaultProps.titleBarFontSize` | string | default/medium/large |
| 标题文字颜色 | `defaultProps.titleColor` | string | 默认 #000 |
| 组件宽度 | `w` | number | 网格宽度（1-12） |
| 组件高度 | `h` | number | 网格高度 |
| 组件位置 X | `x` | number | 网格列位置 |
| 组件位置 Y | `y` | number | 网格行位置 |

---

## 轮播图 JAppCarousel

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| 显示文案 | `defaultProps.showName` | boolean | 默认 true |
| 自动轮播 | `defaultProps.autoplay` | boolean | 默认 true |
| 内容边距 | `defaultProps.contentPadding` | boolean | 默认 false |
| 文字大小 | `defaultProps.textFontSize` | string | `default`/`medium`/`large` |
| 文字对齐 | `defaultProps.textAlign` | string | `center`（居中，默认）/ `bottom`（居底） |
| 图片适配 | `defaultProps.imgSize` | string | `cover`（裁剪，默认）/ `fill`（铺满）/ `contain`（适应） |
| 图片列表 | `defaultProps.list` | array | 每项：`{ img, name, webUrl, appUrl, index }`（不是 src/title/link） |

链接支持外部URL（`https://xxx`）和内部路由（`/system/notice`）。

---

## 新闻动态 JCmsNews

**内容设置：**

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| Tab类型 | `defaultProps.tabType` | number | `0`=不使用Tab, `1`=使用Tab |
| 无Tab数据 | `defaultProps.noTabsData` | array | 每项 `{ id, menuCode, title }`，支持多选栏目 |
| Tab数据 | `defaultProps.tabsData` | array | 每项 `{ tabName, tabSort, infoList: [{ id, menuCode, title }], key }` |

数据源：CMS 文章栏目，通过 `GET /eoa/cms/eoaCmsMenu/treeList` 查询，仅 `isShow=1` 的栏目可用。

**内容板式：**

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| 展示形式 | `defaultProps.showType` | number | `1`=左文右图（默认），`2`=纯大图轮播 |
| 自动轮播 | `defaultProps.autoplay` | boolean | 仅 showType=2 时生效 |
| 文字大小 | `defaultProps.textFontSize` | string | 仅 showType=2 时生效 |
| 图片适配 | `defaultProps.imgSize` | string | 仅 showType=2 时生效 |

---

## 系统公告 JSystemNotice

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| 消息类别 | `defaultProps.msgCategory` | array | `"1"`=通知公告, `"2"`=系统消息，可多选 |
| 消息分类 | `defaultProps.noticeType` | array | 仅 msgCategory 含 `"2"` 且不含 `"1"` 时生效。可选：`plan`/`flow`/`meeting`/`file`/`collab`/`supe` |

---

## 我的计划 JSchedule

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| 移动端展示条数 | `defaultProps.mobileMaxCount` | number | 默认 3，范围 1-6 |
| Tab类型 | `defaultProps.tabType` | number | `0`=无Tab, `1`=多Tab |
| 时间范围（单选） | `defaultProps.singleRange` | string | tabType=0 时生效。`week`/`biweek`/`month` |
| 时间范围（多选） | `defaultProps.multiRange` | array | tabType=1 时生效，至少选2项 |

---

## 流程中心 JMyFlow

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| 显示分类 | `defaultProps.category` | array | 0=待办, 1=我的抄送, 2=历史流程, 3=我的申请。默认全选 |
| 排序顺序 | `defaultProps.order` | array | 分类的显示顺序，默认 `[0,1,2,3]` |

---

## 协同待办 JCollaPending

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| 显示分类 | `defaultProps.category` | array | 0=未读, 1=已读, 2=未完成, 3=已完成。默认全选 |
| 排序顺序 | `defaultProps.order` | array | 分类的显示顺序，默认 `[0,1,2,3]` |

---

## 知识库 JKnowledge

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| Tab类型 | `defaultProps.tabType` | number | `0`=不使用Tab, `1`=使用Tab |
| 无Tab数据 | `defaultProps.noTabsData` | array | 每项 `{ fileId, fileName }`（注意字段名不同于新闻） |
| Tab数据 | `defaultProps.tabsData` | array | 每项 `{ tabName, tabSort, infoList: [{ fileId, fileName }], key }` |

数据源：知识库文件夹，通过 `GET /sys/tenant/getCurrentUserTenantForFile` 查租户，再通过 `GET /eoa/files/getIzRootFolderList?tenantId={id}&userId={userId}` 加载文件夹。

---

## 应用快捷入口 JAppEnter

**内容设置：**

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| Tab类型 | `defaultProps.tabType` | number | `0`=无tab, `1`=有tab |
| 无Tab数据 | `defaultProps.noTabsData` | object | `{ contentSource: 1, infoList: [...] }` |
| Tab数据 | `defaultProps.tabsData` | array | 每项 `{ contentSource: 1, infoList: [...], tabName: "名称" }` |

**infoList 入口类型：**

**① 应用类型**（jumpType="app"）— 关联流程审批单：
```json
{
  "jumpType": "app",
  "formType": "design|online|customRoute",
  "id": "数据源记录ID",
  "desformCode": "表单编码",
  "desformName": "表单名称",
  "desformIcon": "图标(car/team/unlock/woman等)",
  "procName": "流程名称",
  "titleExp": "标题表达式(如：请假人【${name}】)",
  "appIcon": "",
  "name": "入口显示名称",
  "imageUrl": "",
  "imgType": "system",
  "iconBgColor": "#4682B4",
  "sortId": "排序ID"
}
```

数据源 API：
- design表单: `GET /joa/designform/designFormCommuse/roleDegisnList`
- online表单: `GET /joa/designform/designFormCommuse/roleOnlineList`
- 自定义路由: `GET /eoa/portalapp/portalCustomRoute/list`

**② URL类型**（jumpType="url"）— 跳转链接：
```json
{
  "jumpType": "url",
  "webUrl": "跳转地址(http/https开头=外链，否则=系统内页面)",
  "appUrl": "移动端跳转地址",
  "showPlatform": ["web", "app"],
  "name": "入口显示名称",
  "imageUrl": "",
  "imgType": "system",
  "iconBgColor": "#4682B4",
  "id": "唯一ID",
  "sortId": "排序ID"
}
```

**内容板式：**

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| 内容板式 | `defaultProps.styleType` | number | `0`=图标样式, `1`=图标+底色样式 |
| 底色圆角 | `defaultProps.contentBackgroundRadius` | string | 仅 styleType=1。`none`/`small`/`whole` |
| 图标形状 | `defaultProps.contentIconRadius` | string | `none`(方形)/`small`(圆角)/`whole`(圆形) |
| 图标大小 | `defaultProps.contentIconSize` | string | `small`/`default`/`large` |
| 文字大小 | `defaultProps.contentFontSize` | string | `default`/`medium`/`large` |
| 文字行数 | `defaultProps.contentFontLines` | number | `1`=单行, `2`=多行 |
| 对齐方式 | `defaultProps.contentIconAlign` | string | `vertical-center`/`vertical-left`/`horizontal-center` |
| 组内间距 | `defaultProps.contentSpace` | string | `tight`/`default`/`loose` |
| 组与组间距 | `defaultProps.contentItemSpace` | string | 仅 styleType=1。`tight`/`default`/`loose` |
| 列数自定义 | `defaultProps.colCustomized` | boolean | `false`=自动, `true`=自定义 |
| 自定义列数 | `defaultProps.colSize` | number | colCustomized=true 时生效 |
| 行数自定义 | `defaultProps.rowCustomized` | boolean | `false`=自动, `true`=自定义 |
| 自定义行数 | `defaultProps.rowSize` | number | rowCustomized=true 时生效 |

---

## iframe JIframe

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| 网址 | `defaultProps.frameSrc` | string | 内嵌页面 URL |
| 占位图 | `defaultProps.placeholderImg` | string | 仅移动端生效 |
| 图片适配 | `defaultProps.imgSize` | string | 仅移动端。`cover`/`fill`/`contain` |

---

## 文本 JText

| 配置项 | 字段路径 | 类型 | 说明 |
|--------|---------|------|------|
| 显示标题栏 | `defaultProps.showTitleBar` | boolean | 默认 false |
| 文本内容 | `defaultProps.text` | string | 默认 "文本" |
| 字体 | `defaultProps.fontFamily` | string | 可选：微软雅黑(默认)/宋体/仿宋/楷体/黑体，格式为 `"'首选字体','备选1',...,sans-serif"` |
| 字体大小(Web) | `defaultProps.fontSize` | number | 默认 16，范围 10-100 |
| 字体大小(App) | `defaultProps.mobileFontSize` | number | 默认 16，范围 10-100 |
| 字间距 | `defaultProps.letterSpacing` | number | 默认 0，范围 0-200 |
| 文字颜色 | `defaultProps.color` | string | 默认 "#000" |
| 字体粗细 | `defaultProps.fontWeight` | string | `normal`/`bold`/`lighter` |
| 文本对齐 | `defaultProps.textAlign` | string | `center`(居中)/`center-left`(居左)/`center-right`(居右) |

---

## 无配置面板组件

以下 4 个组件没有特有配置项，仅支持通用卡片配置：
- **JEmail** — 近期邮件
- **JProcessNotice** — 流程提醒
- **JMyApplyFlow** — 我的申请
- **JMeeting** — 会议

---

## Web/App 同步规则

修改 webComponentData 中的组件时，需同步 appComponentData 中同 `i` 的组件的以下属性：

| 组件 | 需同步的属性 |
|------|-------------|
| JAppEnter | tabType, noTabsData, tabsData |
| JCmsNews | tabType, noTabsData, tabsData |
| JKnowledge | tabType, noTabsData, tabsData |
| JAppCarousel | list |
| JMyFlow | category, order |
| JCollaPending | category, order |
| JSystemNotice | msgCategory, noticeType |
