# 大屏 API 数据集示例参考库

> 来源：系统 `/drag/onlDragDatasetHead/list?dataType=api`，共 **92 条** `https://api.jeecg.com/mock` 外部接口
> 全部为 **GET** 方法，无需鉴权（mock 公开接口），可直接用于创建 API 数据集

---

## 使用方式

创建大屏时，若用户需要 **示例数据** 或 **演示数据**，从本文档按行业选取合适的接口直接创建 API 数据集：

```bash
py dataset_ops.py create-api $API_BASE $TOKEN \
  --url "https://api.jeecg.com/mock/51/beverageSales?type=salesTrend" \
  --name "销售额走势" \
  --method get
```

或通过 `comp_ops.py add` 一键创建数据集并绑定图表（暂不支持 API 类型，需用 `dataset_ops.py` 先建数据集再 `--dataset-name` 绑定）。

---

## 一、饮料/食品零售行业（beverageSales）

**适合大屏类型**：零售门店销售大屏、饮料品牌运营大屏

**Base URL**: `https://api.jeecg.com/mock/51/beverageSales`

| type 参数 | 推荐数据集名称 | 推荐图表类型 |
|---|---|---|
| `?type=salesRanking` | 店铺销售额排名 | 排行榜（JScrollRankingBoard）、横向柱状图（JHorizontalBar） |
| `?type=salesTrend` | 销售额走势 | 折线图（JLine）、面积图（JArea） |
| `?type=salesTendency` | 销量走势 | 折线图（JLine） |
| `?type=orderSalesVolume` | 订单销售量 | 柱状图（JBar）、数字卡片（JStatsSummary） |
| `?type=salesVolume` | 销量额 | 数字卡片（JStatsSummary）、翻牌器（JCountTo） |
| `?type=coldAndHostProportion` | 冷热饮占比 | 饼图（JPie）、环形图（JRing） |
| `?type=expenditureTrends` | 原料支出趋势 | 折线图（JLine）、面积图（JArea） |
| `?type=highestSellingItem` | 单月最高销量单品 | 数字卡片（JColorBlock） |
| `?type=maximumSalesSpecs` | 单月最高销量规格 | 数字卡片（JColorBlock） |
| `?type=salesLine` | 单月最高销量品线 | 数字卡片（JColorBlock） |
| `?type=topSellingBranch` | 单月最高销售量分店 | 数字卡片（JColorBlock） |

**完整示例 URL**：
- `https://api.jeecg.com/mock/51/beverageSales?type=salesTrend`
- `https://api.jeecg.com/mock/51/beverageSales?type=salesRanking`
- `https://api.jeecg.com/mock/51/beverageSales?type=coldAndHostProportion`

---

## 二、快消品销售管理（productSales）

**适合大屏类型**：快消品销售管理大屏、代理商运营大屏

**Base URL**: `https://api.jeecg.com/mock/51/productSales`

| type 参数 | 推荐数据集名称 | 推荐图表类型 |
|---|---|---|
| `?type=salesThisMonth` | 本月渠道销售 | 数字卡片（JStatsSummary）、柱状图（JBar） |
| `?type=salesRanking` | 本月代理商销售排行 | 排行榜（JScrollRankingBoard） |
| `?type=salesTrend` | 近七天销售额趋势 | 折线图（JLine） |
| `?type=productSalesThisMonth` | 本月产品销售 | 柱状图（JBar）、饼图（JPie） |
| `?type=productSalesRevenue` | 本月重点城市产品销售额 | 柱形地图（JBarMap）、柱状图（JBar） |
| `?type=productSalesRevenueTable` | 本月重点城市产品销售额表格 | 表格（JCommonTable） |
| `?type=rankingCategorySales` | 本月产品小类销售排行 | 排行榜（JScrollRankingBoard）、胶囊图（JCapsuleChart） |

---

## 三、电商销售运营（commerceSalesOperations）

**适合大屏类型**：电商运营数据大屏、销售驾驶舱

**Base URL**: `https://api.jeecg.com/mock/51/commerceSalesOperations`

| type 参数 | 推荐数据集名称 | 推荐图表类型 |
|---|---|---|
| `?type=saleStatus` | 销售状态 | 数字卡片（JStatsSummary） |
| `?type=brandSales` | 品牌销售占比 | 饼图（JPie）、环形图（JRing） |
| `?type=areaRanking` | 销售地区排行 | 散点地图（JBubbleMap）、排行榜 |
| `?type=quarterlyFinish` | 季度目标完成率 | 进度条（JProgress）、仪表盘（JGauge） |
| `?type=generatingTrends` | 订单产生趋势 | 折线图（JLine） |
| `?type=logisticsOrder` | 物流订单接收 | 数字卡片（JStatsSummary）、折线图（JLine） |
| `?type=regionalOrders` | 各地区订单与仓库情况 | 散点地图（JBubbleMap）、表格（JCommonTable） |

---

## 四、库存仓储管理（inventory 系列）

**适合大屏类型**：仓储库存监控大屏、供应链管理大屏

### inventoryChart（库存图表）

**Base URL**: `https://api.jeecg.com/mock/51/inventoryChart`

| type 参数 | 推荐数据集名称 | 推荐图表类型 |
|---|---|---|
| `?type=monitor` | 产品库存状态监控 | 数字卡片（JStatsSummary） |
| `?type=stockAge` | 产品库龄分布情况 | 柱状图（JBar）、堆叠柱形图（JStackBar） |
| `?type=coverage` | 产品库存覆盖率情况 | 折线图（JLine）、仪表盘（JGauge） |
| `?type=warehousing` | 当月入库情况 | 柱状图（JBar） |
| `?type=outbound` | 当月出库情况 | 柱状图（JBar） |
| `?type=warehouseStatus` | 仓库状态情况 | 饼图（JPie）、状态卡片（JColorBlock） |
| `?type=storkProportion` | 产品库存占比情况 | 饼图（JPie）、环形图（JRing） |

### inventoryStatus（库存状态 - 按产品线）

**Base URL**: `https://api.jeecg.com/mock/51/inventoryStatus`

| type 参数 | 推荐数据集名称 | 推荐图表类型 |
|---|---|---|
| `?type=air` | air 产品线库存 | 数字卡片（JColorBlock） |
| `?type=lite` | lite 产品线库存 | 数字卡片（JColorBlock） |
| `?type=super` | super 产品线库存 | 数字卡片（JColorBlock） |
| `?type=ultra` | ultra 产品线库存 | 数字卡片（JColorBlock） |

### inventoryManagement（库存管理汇总）

**URL**: `https://api.jeecg.com/mock/51/inventoryManagement`（无参数）
- 推荐：数字卡片组合（JStatsSummary）

---

## 五、物业消防安全（propertyFireFighting）

**适合大屏类型**：物业安全监控大屏、消防设备管理大屏、智慧园区大屏

**Base URL**: `https://api.jeecg.com/mock/51/propertyFireFighting`

| type 参数 | 推荐数据集名称 | 推荐图表类型 |
|---|---|---|
| `?type=regionBasicInformation` | 区域基本情况 | 数字卡片（JStatsSummary） |
| `?type=normalDevice` | 正常设备数量 | 数字卡片（JColorBlock） |
| `?type=abnormalDevice` | 异常设备数量 | 数字卡片（JColorBlock，红色警告） |
| `?type=equipmentDetails` | 设备异常明细 | 表格（JCommonTable）、轮播表（JScrollBoard） |
| `?type=deviceCountProportion` | 设备类型数量占比 | 饼图（JPie）、环形图（JRing） |
| `?type=areaDeviceCount` | 区域设备数量 | 柱状图（JBar） |
| `?type=inspectionTasksCount` | 巡检任务数 | 数字卡片（JStatsSummary） |
| `?type=inspectionTasksTable` | 巡检任务明细表 | 表格（JCommonTable） |
| `?type=residentialDistributionMap` | 小区地图分布 | 地图组件（JBubbleMap、JAreaMap） |
| `?type=residentialDistributionTable` | 小区分布明细表 | 表格（JCommonTable） |

---

## 六、AI/科技产品（aiproducttest）

**适合大屏类型**：AI产品分析大屏、科技产品销售大屏

**URL**: `https://api.jeecg.com/mock/31/graphreport/aiproducttest`（无 type 参数）

- 推荐图表类型：排行榜（JScrollRankingBoard）、柱状图（JBar）、进度条（JListProgress）
- 典型用途：产品销量排行榜、AI产品测试列表、产品测试进度展示

---

## 七、企业OA门户（mock/26 系列）

**适合大屏类型**：企业门户大屏、工作台大屏、办公运营大屏

**Base URL**: `https://api.jeecg.com/mock/26`

| 接口路径 | 推荐数据集名称 | 推荐图表类型 |
|---|---|---|
| `/line/area` | 通用折线/面积图 | 折线图（JLine）、面积图（JArea） |
| `/activering` | 车辆归属地分布 | 散点地图（JBubbleMap）、排行榜 |
| `/getCmsSiteData?type=jimu` | 新闻动态/规章制度 | 滚动列表（JScrollList） |
| `/task?type=jimu` | 待办任务 | 滚动列表（JScrollList） |
| `/promess?type=jimu` | 流程提醒 | 滚动列表（JScrollList） |
| `/getAnnouncementSend?type=jimu` | 通知公告 | 滚动列表（JScrollList）、卡片滚动（JCardScroll） |
| `/myPlan?type=jimu` | 我的计划 | 日历（JPermanentCalendar）、列表 |
| `/email?type=jimu` | 近期邮件 | 滚动列表（JScrollList） |
| `/myApply?type=jimu` | 我的申请 | 滚动列表（JScrollList） |
| `/commuse?type=jimu` | 常用流程 | 卡片滚动（JCardScroll） |
| `/ccTask?type=jimu` | 我的抄送 | 滚动列表（JScrollList） |

---

## 行业汇总速查

| 行业 | API路径关键字 | 数据集数量 | 适合大屏 |
|---|---|---|---|
| 饮料/食品零售 | `beverageSales` | 11 | 零售销售大屏 |
| 快消品销售管理 | `productSales` | 7 | 销售管理大屏 |
| 电商销售运营 | `commerceSalesOperations` | 7 | 电商运营大屏 |
| 库存仓储管理 | `inventoryChart/Status/Mgmt` | 12 | 库存监控大屏 |
| 物业消防安全 | `propertyFireFighting` | 10 | 物业安全大屏 |
| AI/科技产品 | `graphreport/aiproducttest` | 1（多次复用） | 产品分析大屏 |
| 企业OA门户 | `mock/26/*` | 11 | 企业门户大屏 |

---

## 典型场景示例

### 场景1：饮料品牌零售大屏（完整数据集配置）

```
核心指标区：
  - 销量额：https://api.jeecg.com/mock/51/beverageSales?type=salesVolume → JStatsSummary
  - 冷热占比：https://api.jeecg.com/mock/51/beverageSales?type=coldAndHostProportion → JPie

趋势区：
  - 销售额走势：https://api.jeecg.com/mock/51/beverageSales?type=salesTrend → JLine
  - 销量走势：https://api.jeecg.com/mock/51/beverageSales?type=salesTendency → JArea

排行区：
  - 店铺销售排名：https://api.jeecg.com/mock/51/beverageSales?type=salesRanking → JScrollRankingBoard
```

### 场景2：电商运营大屏

```
核心指标：
  - 销售状态：https://api.jeecg.com/mock/51/commerceSalesOperations?type=saleStatus → JStatsSummary
  - 季度目标：https://api.jeecg.com/mock/51/commerceSalesOperations?type=quarterlyFinish → JGauge

分析图表：
  - 品牌占比：https://api.jeecg.com/mock/51/commerceSalesOperations?type=brandSales → JPie
  - 订单趋势：https://api.jeecg.com/mock/51/commerceSalesOperations?type=generatingTrends → JLine
  - 地区排行：https://api.jeecg.com/mock/51/commerceSalesOperations?type=areaRanking → JBubbleMap
```

### 场景3：物业消防安全大屏

```
状态概览：
  - 区域情况：https://api.jeecg.com/mock/51/propertyFireFighting?type=regionBasicInformation → JStatsSummary
  - 正常设备：https://api.jeecg.com/mock/51/propertyFireFighting?type=normalDevice → JColorBlock
  - 异常设备：https://api.jeecg.com/mock/51/propertyFireFighting?type=abnormalDevice → JColorBlock（红色）

地图：
  - 小区分布：https://api.jeecg.com/mock/51/propertyFireFighting?type=residentialDistributionMap → JBubbleMap

明细：
  - 设备异常：https://api.jeecg.com/mock/51/propertyFireFighting?type=equipmentDetails → JScrollBoard
  - 巡检任务：https://api.jeecg.com/mock/51/propertyFireFighting?type=inspectionTasksTable → JCommonTable
```

---

## 自建 mock（带参联动/钻取）

本文档列的 92 条是**静态** mock——不会按查询参数返回不同数据，仅适合"纯展示"场景。

若大屏需要**联动/钻取**（点击 A → B 按参数刷新），必须自建带 query 参数分支的 mock：

| 步骤 | 脚本 |
|------|------|
| ① 建 mock + 启用高级脚本 | `yapi_ops.py create-mock --advmock-script "if(params.brand){mockJson={data:[...]}}else{mockJson={data:[...]}}"` |
| ② 建 API 数据集并声明参数 | `dataset_ops.py create-api --params "brand:品牌" --url "https://api.jeecg.com/mock/57/claude/xxx?brand=${brand}"` |
| ③ 绑组件 + 配置联动 | `dataset_ops.py bind` + `linkage_ops.py add-linkage --mapping "name=brand"` |

**完整端到端流程 + 踩坑见 `references/linkage-drill-guide.md` §API 数据集联动实战**。
