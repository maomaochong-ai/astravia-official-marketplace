# 积木报表官方示例 Mock API 数据集

当需要 API 数据集但字段尚未确定时，可直接使用这些官方示例接口。
Base: `http://api.jeecg.com/mock/26/` 或 `https://api.jeecg.com/mock/26/`

> **这些接口是官方永久示例，不会被删除，可放心使用。**

---

## 一、通用图表数据（name/value/type 结构）

这类接口返回 `{data:[{name,value,type?}]}` 结构，适合柱状图、折线图、饼图。

| 路径 | 说明 | 字段 | 条数 |
|------|------|------|------|
| `/bingtu1` | 饼图（4图例） | `name, value` | 4 |
| `/bingtu2` | 饼图（4图例） | `name, value` | 4 |
| `/fangyuan` | 房源类型饼图 | `name(高层/公寓/别墅等), value` | 8 |
| `/kaigong` | 制冷设备统计 | `name(设备名), value` | 6 |
| `/xiaoshoue` | 省份销售额 | `name(省份), value, type("销售额")` | 13 |
| `/sandian` | 散点图数据 | `name(数值), value` | 12 |
| `/wanchenglv` | 完成率序列 | `name("1"-"30"), value(10-100)` | 30 |
| `/zhexian1` | 折线图年月对比 | `name(月份), value, type(年份"2017"/"2018")` | 24 |
| `/zhexian2` | 折线图系列 | `name(月份), value, type(年份)` | 24 |
| `/zhuxingtu1` | 柱状图年月对比 | `name(月份), value, type(年份"2017"/"2018")` | 24 |
| `/rishengchan1` | 日生产计划对比 | `name(1-30日), value, type("计划生产"/"实际完成量")` | 60 |
| `/chengjiao` | 房产成交 | `name(小区名), value, type("房子")` | 12 |

---

## 二、多系列动态图表（带 type 参数）

| 路径 | 参数 | 说明 | 字段 | 条数 |
|------|------|------|------|------|
| `/yuesale?type=${type}` | type=1~10 | 月销售10系列 | `name(月份), value, type(1-10)` | 120 |
| `/returnmoney?type='${type}'` | type参数 | 返款数据 | `name, value, type` | — |
| `/zhanbi?type='${type}'` | type参数 | 占比数据 | `name, value, type` | — |

---

## 三、销售类数据

| 路径 | 说明 | 关键字段 | 条数 | 备注 |
|------|------|---------|------|------|
| `/groupsub` | 多维销售分组（含地区/品类/年月） | `diqu, class, year, mouth, sales` | 1176 | 7地区×7品类×2年×12月 |
| `/xiaoshou1` | 销售数据（3地区版） | `diqu, class, year, mouth, sales` | 750 | 同groupsub，地区只有3个 |
| `/subtotal` | 地区销售汇总 | `amount, month, areaname, year, price, dept, settleamount` | 40 | 华北/华东两大区 |
| `/salemessage` | 销售人员业绩排行 | `id, name, value` | 10 | 按value降序 |
| `/quyuxiaoshou1` | 区域销售月报 | `region, province, moth, sales_1, gift_1, proportion_1` | 180 | 5区域×6月 |
| `/xsjd` | 销售进度 | — | — | — |
| `/chengshi` | 城市销售 | — | — | — |

---

## 四、分页数据集（支持 `pageNo` / `pageSize`）

分页接口响应格式（固定规范）：

```json
{
  "data":     [...],   // 当前页记录
  "total":    7,       // 总页数 = Math.ceil(count / pageSize)
  "count":    32,      // 总记录数
  "pageSize": 5,       // 每页条数（来自 URL 参数，默认 10）
  "pageNo":   2        // 当前页码（来自 URL 参数，默认 1）
}
```

创建分页 mock 用 `create_paginated_mock(path, title, data)`，无需手动写高级脚本。

| 路径 | 说明 | 关键字段 | 总数 |
|------|------|---------|------|
| `/baobiao/ygtj?pageNo='${pageNo}'&pageSize='${pageSize}'` | 员工基本信息 | `name, department, education, sex, age, salary, tm(url)` | 32 |
| `/baobiao/caigou?pageNo='${pageNo}'&pageSize='${pageSize}'` | 采购库存 | `id, cname, cnum, cprice, ctotal, tp, dtotal, ztotal, d_id` | 100 |
| `/baobiao/xiaoshou?pageNo='${pageNo}'&pageSize='${pageSize}'` | 销售商品 | `id, bianma, cname, ctime, cnum, cprice, yprice, ctotal` | 30 |

> **使用方式**（数据集 SQL 参数）：
> ```
> URL: http://api.jeecg.com/mock/26/baobiao/ygtj
> 参数字段: pageNo=${pageNo}, pageSize=${pageSize}
> ```

---

## 五、人力资源 / 员工档案

| 路径 | 说明 | 关键字段 |
|------|------|---------|
| `/yuangongjiben` | 员工详细档案（32字段） | `name, department, post, sex, birth, political, nation, education, major, entrytime, mailbox, telphone, marital, iDCard, hukoustreet, socialsecurity...` |
| `/xueli` | 学历/教育经历 | `kdate(入学), jdate(毕业), jstudent(学校), zhuanye(专业), zhiwu(职务)` |
| `/zhengshu` | 证书记录 | `fdate(获证日), zcname(证书名), jibie(等级), danwei(发证机构), beizhu` |
| `/gongzuojingli` | 工作经历 | — |
| `/jtcy` | 家庭成员 | — |
| `/jiangli` | 奖励记录 | — |

---

## 六、报表模板数据（套打/单条）

| 路径 | 说明 | 关键字段 | 场景 |
|------|------|---------|------|
| `/baobiao/budongchan` | 不动产权属证书 | `name, time, didian, bianhao, yname, suoyou, zhuzhi, danyuan, type, xtype, riqi, mianji, chanquan, beizhu, fujian` | 套打（单条） |
| `/baobiao/jieshaoxin` | 介绍信 | `name(单位), value(人员), percent, shiqing(事项), tdata(开始日), gdata(截止日)` | 套打 |
| `/baobiao/daibu` | 待捕案件 | `pname(机构), shiqing(案件), fname(姓名), fsex, cdata(生日), zhuzhi, gdata(日期)` | 套打 |
| `/baobiao/chufangjian` | 出房间（药品/处方） | `name(药品名), value(用量), key1-key7(备用), percent` | 套打 |
| `/tiaoma1` | 证件/出入申请 | `name, sex, tp(图片), tm, nation, birth, zhuzhi, card, ydate, qfjg, slyy, sdate, shao, cbr, sld, sr, jphone, lzr, ldate, sk, dizhi` | 套打（含照片） |

---

## 七、医疗/就诊

| 路径 | 说明 | 关键字段 |
|------|------|---------|
| `/baobiao/yonghu` | 患者就诊记录 | `yname, ysex, yage, danwei, yphone, yjieguo(诊断), yprice, yzhenliao, ytotal, yizhu(医嘱), yishe(医生), kdata(日期), tp(图片)` |
| `/hecha` | 户籍核查 | `name(村落), hname(户主), num, knum, zhuzhi, phone, scard, yhnum, yren, yjine, hysr, type, rk, cbz, sf1-sf4, bz` |

---

## 八、实习/评价

| 路径 | 说明 | 关键字段 |
|------|------|---------|
| `/baobiao/shixi` | 实习鉴定 | `id, name(学生), pingjia(评价), lingdao(导师), shijian(日期)` |

---

## 九、房产/不动产

| 路径 | 说明 | 关键字段 |
|------|------|---------|
| `/huxingxiaoshou` | 户型销售 | — |
| `/qingkuang` | 房产情况 | — |
| `/mianji` | 面积数据 | — |
| `/danjia` | 单价数据 | — |
| `/junjia` | 均价数据 | — |
| `/churang` | 出让数据 | — |
| `/xinzhuzhai` | 新住宅 | — |
| `/churang1` | 出让2 | — |
| `/zhuzhaichengjiao` | 住宅成交 | — |
| `/btchanquan` | 不动产产权 | — |
| `/zhuangxiu` | 装修 | — |

---

## 十、图表专用（ECharts）

| 路径 | 说明 | 字段 |
|------|------|------|
| `/bingtu3~6` | 饼图系列 | `name, value` |
| `/loudou` | 漏斗图 | `name, value` |
| `/biaoge` | 表格型图表 | — |
| `/ditu` | 地图数据 | — |
| `/ditu1` | 地图数据2 | — |
| `/wunian` | 五年数据 | — |
| `/table2` | 表格2 | — |
| `/chejian` | 车间数据 | — |
| `/cjpaihang` | 成交排行 | — |
| `/cjjine` | 成交金额 | — |
| `/chengjiao1` | 成交2 | — |
| `/bing1` / `/bing2` | 饼图变体 | — |

---

## 十一、带鉴权的接口

| 路径 | 参数 | 说明 |
|------|------|------|
| `https://bootapi.jeecg.com/jmreport/test/getUserMsg?cname='${cname}'&riqi='${riqi}'` | cname(姓名), riqi(日期) | 用户信息查询 |
| `https://bootapi.jeecg.com/jmreport/test/getUserMsg?did='${did}'` | did | 按ID查用户 |
| `https://bootapi.jeecg.com/jmreport/test/getOrder?id='${did}'` | did | 按ID查订单 |

---

## 十二、HNC 系列（固定数据）

路径均为 `https://api.jeecg.com/mock/26/hnc/` + 随机码，返回固定展示数据：

| 路径后缀 | 用途 |
|---------|------|
| `dnqdclplze` | HNC数据1 |
| `amcrdsmbii` | HNC数据2 |
| `pwigulazhp` | HNC数据3 |
| `qntbzrdlxe` | HNC数据4 |
| `dhaiomsxkm` | HNC数据5 |
| `gitwhrpybd` | HNC数据6 |
| `ljhnyuojzq` | HNC数据7 |

---

## 快速选型指南

| 场景 | 推荐接口 |
|------|---------|
| 简单饼图 | `/bingtu1`（name, value，4条） |
| 多系列折线/柱状 | `/zhexian1` 或 `/zhuxingtu1`（name, value, type年份，24条） |
| 分组销售分析 | `/groupsub`（diqu, class, year, mouth, sales，1176条） |
| 员工列表（分页） | `/baobiao/ygtj`（name, department, salary等，32条） |
| 商品采购（分页） | `/baobiao/caigou`（cname, cprice, ctotal等，100条） |
| 人员档案（套打） | `/yuangongjiben`（32字段全档案） |
| 证书记录 | `/zhengshu`（fdate, zcname, jibie等） |
| 区域销售月报 | `/quyuxiaoshou1`（region, province, moth, sales_1等，180条） |
| 完成率/进度 | `/wanchenglv`（name序号, value，30条） |
| 带参数动态筛选 | `/yuesale?type=${type}`（月份+type序列） |
