# 成套动作（filmcraft）

`filmcraft_recipe` 直接执行下面这些名字；`{"list": true}` 会列出来。
每条都是一串「按名字执行」的动作，不猜坐标，所以不会因为窗口大小或缩放跑偏。

| id | 什么时候用 | 它做什么 |
| --- | --- | --- |
| `save` | 用户说「保存一下」 | `View › Guide Templates › Save Guides as Template…` |
| `save-as` | 要一份叫别的名字的副本 | `Window › Workspaces › Save as New Workspace…` |
| `export` | 用户要一份能拿走的文件 | `Cmd+M` |
| `zoom-in` | 要看细节 | `=` |
| `zoom-out` | 要看整幅 | `-` |
| `fit` | 视野乱了，坐标不再可信 | `View › Magnification › Fit` |
| `group` | 几样东西要一起动 | `Clipping › Group` |
| `ungroup` | 要单独改其中一个 | `Clipping › Ungroup` |
| `cut` | 把内容从这里挪走 | `Edit › Cut` |
| `copy` | 要拿这段内容到别处 | `Edit › Copy` |

失败时返回 `invoked: false` 和每一步的 `attempts`：换一条路，或者退回 `act`。
