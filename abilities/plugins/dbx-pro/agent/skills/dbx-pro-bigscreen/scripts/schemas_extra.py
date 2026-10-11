# -*- coding: utf-8 -*-
"""补充 SCHEMAS 条目（纯 metadata，无 handler）

spec_builder.py 的主 SCHEMAS 字典只收录了有 builtin handler 的 20 个组件；
本文件收录剩余 passthrough 组件的 metadata，让 `--schema --list` / `--schema <C>`
也能看到它们、让 AI 在选型时有参考。

结构和 spec_builder.SCHEMAS 完全一致：
  category / spec_fields / variants / pitfalls / selection
  passthrough: True（标记此组件没有 builtin handler，spec 里要写原生 option）

加/改组件时只动本文件，不碰主 spec_builder.py。
"""

EXTRA_SCHEMAS = {
    # ============================================================
    # 滚动列表 / 卡片滚动 / 轮播
    # ============================================================
    'JScrollList': {
        'category': '滚动列表',
        'spec_fields': 'variant("1"|"2"|"3"), data<array of object>, option.fieldMapping[*].key / header / rowNum / autoScrollEnabled / showHeader / showIndex',
        'variants': {
            '1': '单行文本滚动（最简单，适合通知/公告）',
            '2': '多行 + 行序号（违章/任务列表）',
            '3': '多行 + 序号 + 带表头（明细数据展示）',
        },
        'pitfalls': [
            '⚠️ 数据绑定走 option.fieldMapping[*].key（B.5）。改 key 到 API 实际字段',
            'data 是对象数组 [{...}]（不是 JScrollBoard 的二维数组）',
            '默认高 220（变体 _3 高 310），内容多时自动滚动',
        ],
        'selection': '新闻动态/通知公告/待办/流程提醒/违章列表——单栏或多栏滚动展示；需要表格线/严格列对齐用 JScrollTable；轮播 + DataV 风格用 JScrollBoard；排行榜用 JScrollRankingBoard',
        'passthrough': True,
    },
    'JScrollTable': {
        'category': '滚动表格（自定义样式）',
        'spec_fields': 'data<array of object>, option.fieldMapping[*]{name,key,width<int>}, headerBgColor / headerFontColor / bodyFontColor / borderColor / evenColor / oddColor',
        'pitfalls': [
            '⚠️ 数据绑定走 option.fieldMapping[*].key（B.5）',
            '和 JScrollBoard 区别：本组件样式自由度高（边框/字号/条纹颜色全可改），JScrollBoard 是 DataV 固定风格',
            '🚨 **fieldMapping[*].width 必须是数字像素（如 120），不接受百分比字符串 "40%"**。'
            '百分比写法会被识别为无效后 fallback 默认 0，多列一起塌缩看着像列错位。'
            '推荐用法：固定列写整数像素，让 1 列用 width=0 自动撑满剩余空间。spec_builder 已自动把字符串 width 转为 0 + 警告（2026-05-12）',
            '🚨 **fieldMapping[*] 不支持按列字色字段**——平台没有 fontColor / color / textStyle 这些字段。'
            'AI 易按 JScrollList 的习惯每列写 fontColor → 静默失效。全表字色统一写 option.bodyFontColor。'
            'spec_builder 已自动删除每列 fontColor + 警告（2026-05-12）',
            '🚨 **oddColor / evenColor / borderColor 写 #RRGGBBAA 带 alpha** → 斑马纹/边框近乎不可见，表格"看着没条纹"。'
            '建议不透明 #RRGGBB（参考值：oddColor=#0a2540 / evenColor=#0e3052 / borderColor=#1890ff / headerBgColor=#194f97）',
            '🚨 **scrollTime 硬编码 50ms** 前端 Vue 组件不读 option 覆盖，写其它值无效（实测 2026-04-27）',
            '🚨 **滚动触发条件**：数据行数 > 可视行数（≈ h / lineHeight）才滚，mock 数据条数建议 ≥ 可视行数 × 1.5',
        ],
        'selection': '需要高度自定义样式的数据表格（边框/字号/条纹）；DataV 固定风格用 JScrollBoard；静态表格用 JCommonTable',
        'passthrough': False,
    },
    'JCardScroll': {
        'category': '卡片滚动',
        'spec_fields': 'variant("1"|"2"|"3"), data<array of object>, option.contentFieldMapping[*].key, direction("horizontal"|"vertical"), autoScrollEnabled, cardStyle',
        'variants': {
            '1': '横向滚动卡片（应用入口/常用流程）',
            '2': '竖向滚动 + 带序号（TOP 排行卡片，默认尺寸较高）',
            '3': '高亮当前卡片 + 详情字段（工程/订单详情轮播）',
        },
        'pitfalls': [
            '⚠️ 数据绑定走 option.contentFieldMapping[*].key（B.4）。每个卡片槽位对应一项 {name,key}，改 key',
            'direction 控制横滚/竖滚',
        ],
        'selection': '应用快捷入口/常用流程/客户 TOP 卡片/工程详情轮播；需要轮播（1 次显示一张）用 JCardCarousel；简单列表用 JList',
        'passthrough': True,
    },
    'JCardCarousel': {
        'category': '卡片轮播（单张切换）',
        'spec_fields': 'data<array of object>, option.contentFieldMapping[*].key, autoScrollDirection, autoScrollSpeed, cardStyle',
        'pitfalls': [
            '⚠️ 数据绑定走 option.contentFieldMapping[*].key（B.4）',
            '一次只显示 1 张卡片，自动切换；要连续滚动用 JCardScroll',
        ],
        'selection': '首页 Banner/主打信息轮播/大卡片切换（1 屏 1 张）；连续滚动多张用 JCardScroll；纯图片轮播用 JCarousel',
        'passthrough': True,
    },
    'JCarousel': {
        'category': '图片轮播',
        'spec_fields': 'data:[{src}], option.autoplay, dotPosition, dots',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[路径]，映射到 src 字段',
            'data 只需 src 图片 URL',
        ],
        'selection': '纯图片/海报轮播；带文字内容卡片用 JCardCarousel；视频用 JVideoPlay',
        'passthrough': True,
    },
    'JList': {
        'category': '静态列表',
        'spec_fields': 'data:[{title,description,date,cover}], option.layout, titleFontSize, showTimePrefix, showTitlePrefix, isEnableAnimation',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[标题, 描述, 时间, 封面]',
            '只展示，不滚动；需要滚动用 JScrollList；带卡片样式用 JCardScroll',
        ],
        'selection': '通知/资讯/活动的静态列表展示（不滚动）；自动滚动用 JScrollList',
        'passthrough': True,
    },
    'JFlashList': {
        'category': '闪动排行列表',
        'spec_fields': 'data:[{name,value}], option.title<string>, titleShow<bool>, titleColor, titleSize, numberColor, numberSize, itemColor, animateType',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[维度, 数值]',
            '带闪动动画效果，视觉聚焦',
            '⚠️ option.title 是【字符串】（默认 "排名统计"），不是 ECharts title 对象。'
            '误传 {show:true,text:"...",textStyle:{...}} 前端 Vue 模板直接 {{ option.title }} 输出，'
            '把对象 JSON.stringify 后整段 {"show":true,"text":"...","textStyle":...} 当文本贴出，'
            '溢出容器形成"漏 JSON"错觉。显隐用 option.titleShow（boolean），颜色字号用 option.titleColor / option.titleSize。',
            '⚠️ 只渲染前 4 条数据（组件内 result.slice(0,4)，按 value 降序）。超出会被静默丢弃。',
            '⚠️ 容器最小宽度建议 ≥240px。180-200px 时长名称（≥10 汉字如 "火灾突发-海淀清河"）'
            '会被强制单字竖排堆叠——左侧序号块 + 右侧 numberSize 数值带走 ~80px，可用名称区 <130px 撑不下。'
            '解决：加宽到 240+ 或把 name 简化到 6-8 字（"火灾·海淀"格式）。',
        ],
        'selection': '需要视觉聚焦的排行列表（带闪动）；常规排行用 JScrollRankingBoard；进度条样式用 JCapsuleChart',
        'passthrough': True,
    },
    'JFlashCloud': {
        'category': '闪动云',
        'spec_fields': 'data:[{name,value}], option.title, textColor, textSize, zoom',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[维度, 数值]',
            '文字飘动云效果，区别于 JWordCloud（密集词云）',
        ],
        'selection': '动态飘动文字云（品牌展示/关键词流）；密集排布词云用 JWordCloud；带图片用 JImgWordCloud',
        'passthrough': True,
    },

    # ============================================================
    # 进度 / 数字指标
    # ============================================================
    'JProgress': {
        'category': '横向进度条（ECharts）',
        'spec_fields': 'data:[{name,value}], option.series, yAxis, title, valueXOffset, valueYOffset',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[维度, 数值]',
            'value 范围 0~100',
        ],
        'selection': '简单横向进度条（单条或列表）；圆形进度用 JRingProgress；自定义样式用 JCustomProgress；多行进度列表用 JListProgress',
        'passthrough': True,
    },
    'JRoundProgress': {
        'category': '圆形进度',
        'spec_fields': 'data:[{name,value}], option.innerCircle, outerCircle, backgroundStyle, titleStyle, subTitleStyle',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[维度, 数值]',
            '双圆环（内外层）带标题',
            '⚠️ 字段名按 defaults 真相源，禁止按 Vue/CSS 习惯写：'
            'outerCircle/innerCircle 用 borderColor 不是 color；'
            'titleStyle/subTitleStyle 用 fontColor 不是 color。错字段不报错，会被默认值覆盖（看似有效实则无效）',
            '⚠️ titleStyle.top 与 subTitleStyle.top 必填（像素值，分别 ≈ 容器中线±13px）。'
            '不写则两行文字都贴在 y=0 → 完全重叠（残影看似乱码）',
            '⚠️ option 是 replace 不是 merge：写 titleStyle / subTitleStyle 必须带完整字段（top/letterSpacing/fontGradient 等），'
            '推荐"复制 defaults 整块再改 fontColor/borderColor"',
        ],
        'selection': '单指标圆形进度（带双环视觉）；极简环形用 JRingProgress；液态效果用 JLiquid；多色段仪表用 JColorGauge',
        'passthrough': True,
    },
    'JCustomProgress': {
        'category': '自定义进度条',
        'spec_fields': 'data:[{name,value}], option.barWidth, progressColor, backgroundColor, titleColor/FontSize/Position, valueColor/FontSize/Position, padding',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[维度, 数值]',
            '所有颜色/字号/位置全可定制',
        ],
        'selection': '需要高度自定义样式的进度条；基础样式用 JProgress；多行排行用 JListProgress',
        'passthrough': True,
    },
    'JColorBlock': {
        'category': '彩色数字块',
        'spec_fields': 'data:[{prefix,suffix,backgroundColor,value}], option.card, option.lineNum, color, fontSize, fontWeight, decimals, borderSplitx, borderSplity',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[前缀, 后缀, 背景色, 数值]',
            '🚨 24 栅格强约束（源码 colorBlock.vue:122-124 `span=ceil(24/lineNum)`）：数据项数必须 = lineNum 且能整除 24，否则折行错位。KPI 行实用项数 ∈ {2, 3, 4, 6, 8}（4-6 最饱满）；5/7/9-11/13-23 项 → 折成 4+1 / 6+1 / 8+1 等不规则布局 → 项数不在白名单时改用 JStatsSummary',
        ],
        'selection': '色块化 KPI 卡：每项 prefix+value+suffix 配独立 backgroundColor，option.lineNum 控制每行块数。**与 JStatsSummary 同为大屏顶部 KPI 行（≥3 项并排）的两大候选**——本组件长板：色块强视觉冲击、可语义化配色（红/橙=警示、绿=正向、蓝/青=中性），监控/驾驶舱场景首选；JStatsSummary 长板：自带环比/同比对比+涨跌箭头，需要对比数据时首选。**🚨 项数限制：源码用 Antd 24 栅格渲染（span=ceil(24/lineNum)），数据项数必须 = lineNum 且能整除 24 才视觉饱满 → 实用项数仅 {2,3,4,6,8}（4-6 最佳）；5/7/9-11/13-23 项会折行错位（5 项→4+1、7 项→6+1）→ 改用 JStatsSummary（任意项数都正常排版）**。单个色块强调数字（如"销售总额 12345 元"，lineNum=1）也行；翻牌动效用 JCountTo；纯静态数字用 JNumber',
        'passthrough': True,
    },

    # ============================================================
    # 交互 / 容器
    # ============================================================
    'JTabToggle': {
        'category': 'Tab 切换器',
        'spec_fields': 'data:[{label,value}], option.items, active, normal, personalizedMode',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[文本, 数值]',
            '⚠️ 作为"源组件"给其他组件发联动参数：点击 tab → 其他组件接收 value',
            '见 references/select-radio-guide.md',
        ],
        'selection': '大屏分区切换（如切换不同时间段/不同维度）；配合其他组件做联动源；视觉相似的单选用 JSelectRadio；点击跳转用 JRadioButton',
        'passthrough': True,
    },
    'JSelectRadio': {
        'category': '单选切换器',
        'spec_fields': 'data:[{label,value}], option.activeColor/BackgroundColor/BorderColor, color/backgroundColor/borderColor',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[文本, 数值]',
            '和 JTabToggle 类似，但样式更接近传统单选按钮',
            '见 references/select-radio-guide.md',
        ],
        'selection': '大屏筛选器（年/月/日切换、地区切换等）；Tab 样式用 JTabToggle；带跳转用 JRadioButton',
        'passthrough': True,
    },
    'JRadioButton': {
        'category': '按钮组（可跳转）',
        'spec_fields': 'data:[{title,value,href,data}], option.body, card, customColor, title',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[标题, 跳转]',
            '每个按钮可配 href 外链或 data 透传',
        ],
        'selection': '带外链跳转的按钮组（快捷入口/导航）；纯切换用 JSelectRadio/JTabToggle',
        'passthrough': True,
    },
    'JPermanentCalendar': {
        'category': '日历（数据热力）',
        'spec_fields': 'data:[{date,value}], option.field.dateField / valueField, month, week, cell, circle, title',
        'pitfalls': [
            '⚠️ 数据绑定走 option.field.{dateField, valueField}（B.3）',
            'date 字段默认 dateField="date"、值字段默认 valueField="value"，绑自定义 API 必须改',
            '默认尺寸 1000x480，大屏中占较大面积',
        ],
        'selection': '日历热力图（签到/销售/访问量日分布）；简单时间轴趋势用 JLine/JArea',
        'passthrough': True,
    },

    # ============================================================
    # 辅助装饰（多数无数据源）
    # ============================================================
    'JCurrentTime': {
        'category': '当前时间',
        'spec_fields': 'option.format(格式化字符串), hourlySystem(12/24), showWeek, body, card',
        'pitfalls': [
            '无数据源——本组件自动读浏览器时间',
            '无 dataMapping 也无 chartData',
            'format 用 moment 格式（YYYY-MM-DD HH:mm:ss）',
        ],
        'selection': '大屏标题栏时间显示；需要带日期计算的用 JText（手动填）',
        'passthrough': True,
    },
    'JImg': {
        'category': '图片容器',
        'spec_fields': 'src(图片地址), option.backgroundColor, borderRadius, opacity, izRotate(是否旋转), rotateTime, padding',
        'pitfalls': [
            '无数据源——直接配 src URL',
            'izRotate=true 可实现 logo/徽章旋转',
        ],
        'selection': '静态图片/logo/水印；带切换用 JCarousel',
        'passthrough': True,
    },
    'JIframe': {
        'category': '嵌入页面',
        'spec_fields': 'url, option.body, card',
        'pitfalls': [
            '无数据源——直接配 url',
            '嵌入外部系统必须 url 支持 X-Frame-Options 跨域嵌入',
        ],
        'selection': '嵌入外部仪表盘/第三方系统页面；嵌入视频用 JVideoJs',
        'passthrough': True,
    },
    'JRectangle': {
        'category': '矩形框（带数据标签）',
        'spec_fields': 'data:[{name,value}], option.title, tipColor, tipFontSize, titleColor, titleFontSize, theme, card',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[维度, 数值]',
            '主要用作视觉分区容器 + 标签展示',
        ],
        'selection': '视觉分区容器 + 标签数字；纯装饰用 JDragBorder/JDragDecoration',
        'passthrough': True,
    },
    'JCustomIcon': {
        'category': '自定义图标',
        'spec_fields': 'iconName, option.color, opacity, filterfilter',
        'pitfalls': [
            '无数据源——配置 iconName 从图标库挑',
            '小尺寸默认 60x60',
        ],
        'selection': '装饰性图标/状态指示；大图用 JImg',
        'passthrough': True,
    },
    'JVideoPlay': {
        'category': '视频播放',
        'spec_fields': 'data:[{src}], option.autoPlay, loop',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[路径]，映射 src 字段',
            '支持数据源切换视频源（data 数组）',
        ],
        'selection': '视频轮播（多段视频切换）；单视频直链用 JVideoJs；图片轮播用 JCarousel',
        'passthrough': True,
    },
    'JVideoJs': {
        'category': '视频播放（直链）',
        'spec_fields': 'option.url(视频直链)',
        'pitfalls': [
            '无数据源——直接配 url',
            '和 JVideoPlay 区别：本组件不绑数据集，url 写死',
        ],
        'selection': '单路视频直链（监控/宣传片）；多视频切换用 JVideoPlay',
        'passthrough': True,
    },

    # ============================================================
    # 扩展图表
    # ============================================================
    'JWordCloud': {
        'category': '词云',
        'spec_fields': 'data:[{name,value}], option.fontFamily, minSize, maxSize, color, customColor, padding, title',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[维度, 数值]',
            'value 决定字号大小，minSize/maxSize 控制范围',
        ],
        'selection': '热门关键词/标签聚合（密集排布）；动态飘动用 JFlashCloud；带图片用 JImgWordCloud',
        'passthrough': True,
    },
    'JHeatMap': {
        'category': '热力地图',
        'spec_fields': 'data:[{name,value}], option.area, visualMap, geo, drillDown, title, legend',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[区域, 数值]',
            '省名必须精确匹配（同 JAreaMap 规则，见 map-static-data.md）',
            '和 JAreaMap 区别：热力连续着色 vs 区域分档',
        ],
        'selection': '省份/城市数值分布（连续着色）；分档颜色用 JAreaMap；带散点用 JBubbleMap',
        'passthrough': True,
    },
    'JGender': {
        'category': '男女比例',
        'spec_fields': 'data:[{man,woman}], option.series, title, legend',
        'pitfalls': [
            '数据绑定走顶层 dataMapping（A 类型）filed=[男, 女]',
            '专用组件，不要用 JPie 替代（视觉效果更专业）',
        ],
        'selection': '男女比例/二元占比（用户性别、是/否）；多分类占比用 JPie/JRing',
        'passthrough': True,
    },
    'JGaoDeMap': {
        'category': '高德地图（底图）',
        'spec_fields': 'data:[{name,value:[lng,lat,size]}], option.center, zoom, mapStyle, showMarker, markerSize, enableZoom',
        'pitfalls': [
            '⚠️ 无映射组件（见 data-binding-mapping.md §4）：data 必须直接返回 {name, value:[lng,lat,size]} 格式，无法通过 dataMapping 重映射字段名',
            '接 API 必须 API 侧就匹配这个结构；如需改名，要走 SQL 视图 / 接口层重写',
            'value 是三元数组：[经度, 纬度, 大小]',
        ],
        'selection': '真实地图底图 + 标记点（门店/设备位置）；行政区着色用 JAreaMap/JHeatMap；飞线用 JFlyLineMap',
        'passthrough': True,
    },
    'JOrbitRing': {
        'category': '轨道环形文字',
        'spec_fields': 'data:[{name,value}], option.items:[{name,bgColor,bgImg,value}], orbitRadius, tilt, planetWidth, planetHeight, sharedSpeed, imgTextMode, showOrbit, showType, sun',
        'pitfalls': [
            '⚠️ **双数据结构组件**：chartData（数据驱动）+ option.items（样式配置）是两份独立数据，前端按 `chartData[i].name === items[*].name` 匹配取 bgColor/bgImg。',
            '🚨 **绑数据集后行星会无色**：dataMapping 只更新 chartData，不更新 option.items。当 API 返回的 name 与默认 items 6 项 name（经营发展/全口径化债/土地成本决算/创新赋能/重点项目/培育增量）不匹配时，前端找不到 bgColor → **6 个行星全部无色**。',
            '✅ **绑 API 数据集时必须同步 option.items**：在 spec 里显式写 items 数组，name 字段与 API 返回的 name 完全一致；bgColor 自配（默认 6 色 #31aefd/#409EFF/#E6A23C/#F56C6C/#67C23A/#909399 可继承）。',
            '✅ **静态数据时也要同步**：spec.data 改了 name → 同时改 option.items[i].name；否则只有 default 6 项的颜色，自定义 name 无色。',
            '数据绑定走顶层 dataMapping（A 类型）filed=[标题, id(唯一标识), 图片地址]——但仅替换 chartData，items 不参与映射',
            'imgTextMode=true 时是图文模式（行星显示文字）；图片模式则显示 items[i].bgImg',
        ],
        'selection': '6-8 项战略主题/业务板块的环形展示；不带轨道感用 JPie/JRing；纯文本环形排列用 JWordCloud',
        'passthrough': True,
    },
}


# ============================================================
# 变体别名：JScrollList_1/2/3、JCardScroll_1/2/3 等
# 通过后缀剥离落到主名，避免重复维护
# ============================================================
_VARIANT_PARENTS = ['JScrollList', 'JCardScroll']
for _parent in _VARIANT_PARENTS:
    for _v in ('1', '2', '3'):
        EXTRA_SCHEMAS[f'{_parent}_{_v}'] = EXTRA_SCHEMAS[_parent]
