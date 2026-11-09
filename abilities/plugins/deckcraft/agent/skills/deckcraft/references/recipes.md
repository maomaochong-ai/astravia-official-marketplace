# 成套动作（deckcraft）

`deckcraft_recipe` 直接执行下面这些名字；`{"list": true}` 会列出来。
每条都是一串「按名字执行」的动作，不猜坐标，所以不会因为窗口大小或缩放跑偏。

| id | 什么时候用 | 它做什么 |
| --- | --- | --- |
| `new` | 用户说「新建一个」 | `File › New Presentation` |
| `save` | 用户说「保存一下」 | `File › Save` |
| `undo` | 刚做错了一步 | `Edit › Undo` |
| `redo` | 撤错了，要恢复 | `Edit › Redo` |
| `zoom-in` | 要看细节 | `View › Zoom In` |
| `zoom-out` | 要看整幅 | `View › Zoom Out` |
| `fit` | 视野乱了，坐标不再可信 | `View › Fit to Window` |
| `delete` | 用户说「删掉它」 | `Slides › Delete Slide` |
| `duplicate` | 要一个副本再改 | `Edit › Duplicate` |
| `group` | 几样东西要一起动 | `Arrange › Group` |
| `ungroup` | 要单独改其中一个 | `Arrange › Ungroup` |
| `cut` | 把内容从这里挪走 | `Edit › Cut` |
| `copy` | 要拿这段内容到别处 | `Edit › Copy` |
| `paste` | 接上刚才拷贝的内容 | `Edit › Paste` |

失败时返回 `invoked: false` 和每一步的 `attempts`：换一条路，或者退回 `act`。
