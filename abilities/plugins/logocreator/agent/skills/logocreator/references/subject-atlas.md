# 题材图谱：`intent` 里能写什么

读这一页的时机：写 `intent` 之前，或 `subject` 返回了 `abstract:*` 而你不确定为什么。

引擎只会画它认识的东西。词表之外的描述不会报错，只会静默退到抽象构成——那是最常见的
"为什么它没画我说的东西"。

匹配规则（`src/domain/color-plan.ts#subjectFor` + `src/domain/catalog.ts#SUBJECT_KEYWORDS`）：
**句子里最早出现的题材词胜出**，不是规则表里排在前面的那个。词边界用 `\b` 锁过，
`teal` 不会命中 `tea`。

## 26 个象形题材

| 题材 | 触发词（节选） | 适合 | 会毁掉一个标志的时候 |
| --- | --- | --- | --- |
| `leaf` | leaf, eco, organic, garden, plant, forest, farm, herb, nursery | 有机、健康、农业、环保、茶 | 科技公司（读作"我们是卖菜的"） |
| `cup` | coffee, cafe, espresso, roast, brew, tea, matcha | 咖啡、茶饮、烘焙 | 用在水以外的饮品（啤酒、果汁）会误读 |
| `wave` | wave, sea, ocean, river, lake, tide, surf, water, coast | 海洋、旅行、流体、水处理 | 金融（"波动"不是好联想） |
| `mountain` | mountain, peak, alpine, summit, ridge, trail, hike | 户外、旅行、咨询的"目标感" | 已有一个更具体的物时（山最容易被偷懒使用） |
| `sun` | sun, solar, daylight, dawn, sunrise | 能源、清晨类、儿童 | 与 `spark` 二选一时：太阳=稳定，火花=灵感 |
| `moon` | moon, lunar, midnight, night, sleep, dream | 睡眠、夜间、酒馆 | 白天场景的儿童品牌 |
| `flame` | flame, fire, ember, blaze, grill, smoke, baker, bread, pastry | 烧烤、能源、健身的"热" | 烘焙类词（baker/bread/pastry）也会命中火焰而不是 `cup`——写 `cup` 更准 |
| `droplet` | drop, rain, purity, juice, drink, bottle | 饮用水、护肤、雨季主题 | 与 `wave` 重叠时：水滴=单品，波浪=场 |
| `aperture` | photo, camera, lens, aperture, optic, shutter, cinema | 摄影、影像、观测 | 眼镜/光学镜片（会读成相机） |
| `orbit` | orbit, space, cosmos, galaxy, satellite, loop, cycle | 航天、订阅循环、平台生态 | 小体量手作（太"系统"） |
| `spark` | star, spark, sparkle, magic, nova, wish, shine | 灵感、AI、教育、活动 | 奢侈品（火花=廉价高光） |
| `hex` | code, dev, software, stack, api, cloud, server, data, engine | 开发者工具、数据 | 消费品牌（六边形已经等于"技术"） |
| `shield` | secur, shield, guard, defen, trust, vault, privacy | 安全、保险、合规 | 需要"开放"的品牌 |
| `link` | link, connect, node, network, chain, bridge | 集成、平台、物流 | 已有品牌形象更具体时（通用性太强） |
| `knot` | knot, weave, craft, atelier, textile, knit | 手工艺、纺织、设计工作室 | 科技（读作"打结"） |
| `gear` | gear, cog, machine, industrial, workshop, forge, maker | 制造、工业、工具 | 服务业（太"车间"） |
| `book` | book, read, library, page, story, publish, study, manuscript | 出版、教育、书店 | 数字产品（除非真的做阅读） |
| `compass` | compass, navigat, way, route, map, direction | 旅行、咨询、导航 | 已经用 `mountain` 时（两个方向符号会打架） |
| `pillar` | law, legal, justice, attorney, counsel, court, pillar, notary | 律所、会计、公证 | 需要"亲近"的品牌 |
| `cross` | health, clinic, medical, wellness, therap, pharma, heal, dental | 医疗、健康 | 宗教敏感市场；也容易与红十字撞形 |
| `note` | music, sound, audio, beat, melody, song, lyric, podcast | 音乐、播客、音频 | 视觉类内容（音符=声音） |
| `wing` | travel, flight, air, plane, wing, aviation, tour, voyage | 航空、旅行、速度 | 落地服务（读作"我们会飞走"） |
| `paw` | pet, dog, cat, paw, animal, vet, hound, puppy | 宠物、兽医 | 野生动物保护（爪印=家养） |
| `creature` | fox, owl, bird, bear, wolf, crane, mascot, dragon, bee, panda | 儿童、游戏、人格化品牌 | 严肃行业（除非 `style: mascot` 本就是意图） |
| `house` | home, house, estate, propert, realty, dwelling, nest, roof | 地产、家居、社区 | 商业地产（住家的联想太软） |
| `heart` | heart, love, kind, charity, human, donat | 公益、健康、婚庆 | 金融/安全（情绪过载） |

## 8 种抽象构成

题材认不出时（或 `type: abstract`），引擎按 `seed` 与 brief 的哈希挑一种：

| 名称 | 长什么样 | 适合 |
| --- | --- | --- |
| `abstract:slices` | 圆被切掉几刀，露出扇形 | 平台、数据、通用科技 |
| `abstract:arcs` | 三条同心弧错位 | 循环、订阅、运动、通讯 |
| `abstract:burst` | 放射状短线 + 中心点 | 能源、发布、活动 |
| `abstract:mosaic` | 2×2 色块拼合 | 集成、模块化、硬件 |
| `abstract:bands` | 多层波浪带 | 流体、传输、音频 |
| `abstract:lens` | 两个交叠圆（可见月牙） | 协作、合并、影像 |
| `abstract:lattice` | 点阵 + 一条对角线 | 网络、研究、加密 |
| `abstract:ribbon` | 两条交错的飘带 | 供应链、金融、物流 |

抽象构成**不是**"没有题材"的失败品，它是"业务本身无具体对象"时的正确选择。
`subject` 返回 `abstract:xxx` 时，先判断这个业务**该不该**有具象物：

- 该有（茶馆、书店、宠物店、律所）→ 改 `intent` 用上表第一列的具体词，重跑。
- 不该有（数据平台、支付网络、咨询）→ 保留抽象，并在交付说明里讲清它为什么是几何而非具象。

## 写法对照

同一句意思，三种写法，结果完全不同：

| 写法 | 结果 |
| --- | --- |
| `"a warm, artisanal, handcrafted feel"` | 没有名词 → `abstract:*` |
| `"a cup for a coffee roastery, warm and handcrafted"` | `cup` ✔ 位置在最前 |
| `"a cozy neighbourhood spot with a cup and a leaf"` | `cup` ✔ 先出现的胜（`cozy` 不命中，`spot` 不命中） |

规则：**把想要的题材词放在句子最前面**，其余形容词跟在后面。引擎不看形容词，风格由 `style` 决定。

## 词表之外怎么办

用户要一个引擎没有的东西（鲸鱼、吉他、天桥、筷子）：

1. 找一个外形说的通的最近邻（鲸鱼 → `wave`；吉他 → `note`；天桥 → `link`）。
2. 在交付里说清楚这是一次接近，不是精确还原。
3. 如果这个题材对这个品牌是核心资产，告诉用户内置引擎画不了，需要 `logo-designer` 走 AI 路径
   或人工绘制——**不要假装引擎画了出来**。
