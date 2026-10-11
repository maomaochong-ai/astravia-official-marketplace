# 各图表类型 Canonical 结构速查

> 从实际保存的 chartList 提取。只记关键差异，避免 AI 生成错误结构。
> 完整 ECharts 模板见 `chart-echarts-templates.md`。

## 核心规则（必读）

| 规则 | 说明 |
|------|------|
| **分类轴判断** | 按 `axis.type=="category"` 确定哪根轴放分类数据，不能用 `"xAxis" in cfg` 判断 |
| **多系列 series 重建** | fill_chart 重建后每个 series 条目必须含 `itemStyle`，以 `series[0]` 为 fallback；同时补 `typeData:[]` |
| **静态复杂数据** | `data:[[x,y]]` 散点、`value:[...]` 雷达、多系列气泡 → 必须用 `_NONE()`（不绑数据集），否则数据集覆盖 config |
| **JSON 数据集限制** | JSON 数据集有几条记录，渲染时 config 里的 data 就只剩几条；只适合全量数据存在数据集里的场景 |
| **初始 series 不能为空** | 所有图表初始 config 的 `series` 必须至少有一条含 `itemStyle` 的占位，禁止 `"series":[]` |
| **virtualCellRange 只放第一行锚点** | `[[ROW, c] for c in range(COL, COL+COLSPAN)]`，禁止填全部 rowspan 行；rows 也只写锚点行，行高=图表像素高度；多填会让引擎把空行渲染为实际内容，把图表推到下方 |

---

## 单系列柱形图 `bar.simple`
```
extData: dataType=sql  apiStatus=1  series=""
xAxis: {type未设(默认category), data:[月份列表]}
yAxis: {show:true}
series[0]: {name:"", type:"bar", data:[值列表], barWidth:35, itemStyle:{barBorderRadius:0,color:"#c43632"}}
```
> 带背景变体：series[0] 加 `showBackground:true, backgroundStyle:{color:"rgba(220,220,220,0.8)"}`

## 横向柱形图 `bar.horizontal`
```
extData: dataType=sql  apiStatus=1  series=""
yAxis: {type:"category", data:[月份]}   ← 分类轴在 yAxis
xAxis: {type:"value"}
series[0]: {type:"bar", name:"", data:[值], barWidth:20, itemStyle:{color:"#91cc75",barBorderRadius:0},
            label:{show:true,position:"right",...}}
```

## 多系列对比柱形图 `bar.multi`
```
extData: dataType=sql  apiStatus=1  series="type"
xAxis: {type:"category", data:[月份]}
series（fill后）: [{type:"bar",name:"月度A",data:[...],barWidth:18,itemStyle:{color:"",barBorderRadius:0},typeData:[]},
                   {type:"bar",name:"月度B",data:[...],barWidth:18,itemStyle:{color:"",barBorderRadius:0},typeData:[]}]
```
> ⚠️ `typeData:[]` 是引擎回填后自动追加的字段，fill_chart 重建 series 时需保留

## 堆叠柱形图 `bar.stack`
```
extData: dataType=sql  apiStatus=1  series="type"
xAxis: {type:"category"}   yAxis: {show:true}
series: 同 bar.multi，但每条加 "stack":"tot"
```

## 堆叠条形图 `bar.stack.horizontal`
```
extData: dataType=sql  apiStatus=1  series="type"
yAxis: {type:"category", data:[月份]}   ← 分类轴在 yAxis
xAxis: {type:"value"}
series: 同 bar.stack，每条加 "stack":"tot" + "typeData":[]
```

## 多系列横向对比 `bar.multi.horizontal`
```
extData: dataType=sql  apiStatus=1  series="type"
yAxis: {type:"category", data:[月份]}   xAxis: {type:"value"}
series: 同 bar.multi，无 stack，有 "typeData":[]
```

## 正负条形图 `bar.negative`
```
extData: dataType=json  apiStatus=0  series="type"  ← 静态，不用数据集渲染
yAxis: {type:"category", data:[月份]}   xAxis: {type:"value", splitLine:{show:true}}
series: [{name:"正值",stack:"tot",data:[正值列表],itemStyle:{color:"#ee6666"},label:{position:"right"}},
         {name:"负值",stack:"tot",data:[负值列表],itemStyle:{color:"#5470c6"},label:{position:"left"}}]
```

## 折线图系列 `line.simple`
```
extData: dataType=sql  apiStatus=1  series=""
xAxis: {data:[月份]}  yAxis: {show:true}
series[0]: {type:"line", name:"", data:[值], smooth:false/true, step:false/true,
            isArea:false/true, areaStyle:{...}, showSymbol:true, symbolSize:5,
            lineStyle:{width:2}, itemStyle:{color:"#c43632"}}
```

## 多系列折线图 `line.multi`
```
extData: dataType=sql  apiStatus=1  series="type"
xAxis: {type:"category", boundaryGap:true, data:[月份]}   yAxis: {type:"value"}
series（fill后）: [{type:"line",name:"月度A",data:[...],smooth:false,showSymbol:true,
                    symbolSize:5,lineStyle:{width:2},itemStyle:{color:"",barBorderRadius:0},typeData:[]}, ...]
```

## 折柱混合图 `mixed.linebar`
```
extData: dataType=sql  apiStatus=1  series="type"
根级加: "chartType":"linebar"
xAxis: {type:"category", axisPointer:{type:"shadow"}, data:[月份]}
yAxis: [{name:"销售额",type:"value"},{name:"成本",type:"value"}]   ← 数组！
series（fill后）: [{type:"bar",name:"柱系列",data:[...],barWidth:18,itemStyle:{color:"",barBorderRadius:0}},
                   {type:"line",name:"线系列",data:[...],yAxisIndex:1,smooth:false,...itemStyle:{color:""}}]
```

## 饼图系列 `pie.simple / pie.doughnut / pie.rose`
```
extData: dataType=api  apiStatus=1  series=""
series[0]: {type:"pie", name:"", radius:"55%"(或["45%","55%"]), center:[310,185],
            isRose:false/true, roseType:""/radius, data:[{name,value,itemStyle:{color:null}},...],
            label:{show:true,position:"outside",...}}
legend.data: 填充后= [各类别名]
```

## 仪表盘 `gauge.simple / gauge.simple180`
```
extData: dataType=sql  apiStatus=1  series=""
series[0]: {type:"gauge", data:[{name:"目标完成率",value:75}], itemStyle:{color:"#63869E"},
            axisLine:{lineStyle:{width:22,color:[[0.2,"#91c7ae"],[0.8,"#63869E"],[1,"#C23531"]]}},
            axisTick:{distance:-22}, splitLine:{distance:-22}, axisLabel:{distance:27}}
180°变体: 加 startAngle:190, endAngle:-10，去掉 radius
```

## 普通散点图 `scatter.simple`
```
extData: dataType=json  apiStatus=0  dataId:""  dbCode:""   ← _NONE()，不绑数据集
xAxis: {show:true, name:"X"}   yAxis: {show:true, name:"Y"}
series[0]: {type:"scatter", symbolSize:18,
            data:[[10,20],[15,30],[20,25],[25,45],[30,35],[35,55],[40,48],[45,65],[50,58],[55,70]],
            itemStyle:{color:"#C23531",opacity:1}}
```
> ⚠️ data 是 `[[x,y],...]` 格式，不能绑数据集（会被1条记录覆盖），必须 `_NONE()`

## 气泡散点图 `scatter.bubble`
```
extData: dataType=json  apiStatus=0  dataId:""  dbCode:""   ← _NONE()
legend.data: ["系列A","系列B"]
series: [{type:"scatter",name:"系列A",symbolSize:20,data:[[x,y],...],
          itemStyle:{color:{type:"radial",r:0.8,colorStops:[...]},shadowBlur:10,...}},
         {type:"scatter",name:"系列B",...}]
```
> ⚠️ 渐变色 itemStyle + 多系列，必须 `_NONE()`

## 漏斗图 `funnel.simple / funnel.pyramid`
```
extData: dataType=json  apiStatus=0  series=""
series[0]: {type:"funnel", orient:"vertical", sort:"descending"/"ascending",
            left:"10%", width:"80%", top:60, bottom:40, gap:2,
            data:[{name,value,itemStyle:{color:null}},...],
            itemStyle:{borderColor:"#fff",borderWidth:1},
            label:{show:true,position:"inside",textStyle:{fontSize:"13px",color:"#ffffff"}}}
```
> ⚠️ JSON 数据集有几条记录渲染就只显示几条；要显示完整漏斗数据需全量写入数据集的 jsonData

## 雷达图 `radar.basic / radar.custom`
```
extData: dataType=json  apiStatus=0  dataId:""  dbCode:""   ← _NONE()
radar: [{shape:"polygon"/"circle", center:[310,200], indicator:[{name,max},...],
         name:{formatter:"【{value}】",...}, axisLine:{...}, splitLine:{...}}]
series[0]: {type:"radar", data:[{name:"综合评分", value:[7500,3800,68,85,42,35], lineStyle:{}}]}
legend.data: ["综合评分"]
```
> ⚠️ value 是数组格式，不能绑数据集，必须 `_NONE()`

## 象形图 `pictorial.spirits`
```
extData: dataType=json  apiStatus=0  series=""
yAxis: {data:[季度列表], axisTick:{show:false}}   xAxis: {show:true, max:1500}
series[0]: {type:"pictorialBar", data:[值列表], symbol:"roundRect", symbolSize:18,
            symbolRepeat:"fixed", symbolMargin:"5%!", symbolBoundingData:1500,
            symbolClip:true, secondOpacity:0.2,
            label:{show:true,position:"right",...}}
```
> ⚠️ JSON 数据集有几条就显示几条；完整数据需存入 jsonData

## 区域地图 `map.simple`
```
extData: {chartId:lyr, id:lyr, chartType:"map.simple"}   ← 极简，无数据集字段
根级加: "chartType":"map"
geo: {map:"100000", mapCode:[100000], layoutCenter:["50%","50%"], layoutSize:600, zoom:0.7, roam:true}
series[0]: {name:"地图", coordinateSystem:"geo"}   ← 无 type，无 data
```

## 点地图 `map.scatter`
```
extData: dataType=api  apiStatus=1  isCustomPropName:true  xText:"name"  yText:"value"
根级加: "chartType":"map"
series[0]: {type:"scatter", coordinateSystem:"geo", encode:{value:[2]}, symbolSize:18,
            data:[{name:"城市", value:[经度,纬度,数值]}, ...]}   ← value 是 [lon,lat,val] 三元素
```

## 关系图 `graph.simple`
```
extData: {chartId:lyr, id:lyr, chartType:"graph.simple"}   ← 极简，无数据集字段
series[0]: {type:"graph", layout:"circular", center:[560,190],
            lineStyle:{curveness:0.3,color:"source"},
            data:[{name,category,value},...],
            links:[{source,target},...],
            categories:[{name,itemStyle:{color:""}},...]}
```
