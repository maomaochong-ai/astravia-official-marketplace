# 成套动作（effectcraft）

`effectcraft_recipe` 直接执行下面这些名字；`{"list": true}` 会列出来。
每条都是一串「按名字执行」的动作，不猜坐标，所以不会因为窗口大小或缩放跑偏。

| id | 什么时候用 | 它做什么 |
| --- | --- | --- |
| `undo` | 刚做错了一步 | `Edit › undo` |
| `redo` | 撤错了，要恢复 | `Edit › redo` |

失败时返回 `invoked: false` 和每一步的 `attempts`：换一条路，或者退回 `act`。
