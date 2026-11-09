# 成套动作（cadcraft）

`cadcraft_recipe` 直接执行下面这些名字；`{"list": true}` 会列出来。
每条都是一串「按名字执行」的动作，不猜坐标，所以不会因为窗口大小或缩放跑偏。

| id | 什么时候用 | 它做什么 |
| --- | --- | --- |
| `new` | 用户说「新建一个」 | `Layer › New Layer` |
| `export` | 用户要一份能拿走的文件 | `Export › Export...` |
| `import` | 素材还在工作区里 | `Import › Import...` |
| `all` | 要对整张画面动手 | `Other commands › All Scales` |
| `delete` | 用户说「删掉它」 | `Layer › Delete Layer` |
| `switch` | 同时开了好几个 | `Document › Switch Drawing` |

失败时返回 `invoked: false` 和每一步的 `attempts`：换一条路，或者退回 `act`。
