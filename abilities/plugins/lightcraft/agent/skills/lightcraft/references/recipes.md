# 成套动作（lightcraft）

`lightcraft_recipe` 直接执行下面这些名字；`{"list": true}` 会列出来。
每条都是一串「按名字执行」的动作，不猜坐标，所以不会因为窗口大小或缩放跑偏。

| id | 什么时候用 | 它做什么 |
| --- | --- | --- |
| `zoom-in` | 要看细节 | `View › Zoom In` |
| `zoom-out` | 要看整幅 | `View › Zoom Out` |
| `zoom-fit` | 视野乱了，坐标不再可信 | `View › Fit` |
| `zoom100` | 要判断真实像素 | `View › 100%` |

失败时返回 `invoked: false` 和每一步的 `attempts`：换一条路，或者退回 `act`。
