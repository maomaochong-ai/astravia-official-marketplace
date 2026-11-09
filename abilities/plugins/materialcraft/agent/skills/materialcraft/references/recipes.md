# 成套动作（materialcraft）

`materialcraft_recipe` 直接执行下面这些名字；`{"list": true}` 会列出来。
每条都是一串「按名字执行」的动作，不猜坐标，所以不会因为窗口大小或缩放跑偏。

| id | 什么时候用 | 它做什么 |
| --- | --- | --- |
| `open` | 文件已经在项目里，要进编辑器 | `Ctrl+O` |
| `save` | 用户说「保存一下」 | `Ctrl+S` |
| `save-as` | 要一份叫别的名字的副本 | `Ctrl+Shift+S` |
| `export` | 用户要一份能拿走的文件 | `Ctrl+Shift+E` |
| `undo` | 刚做错了一步 | `Ctrl+Z` |
| `redo` | 撤错了，要恢复 | `Ctrl+Y` |
| `delete` | 用户说「删掉它」 | `Delete` |
| `duplicate` | 要一个副本再改 | `Ctrl+D` |
| `cut` | 把内容从这里挪走 | `Ctrl+X` |
| `copy` | 要拿这段内容到别处 | `Ctrl+C` |
| `paste` | 接上刚才拷贝的内容 | `Ctrl+V` |

失败时返回 `invoked: false` 和每一步的 `attempts`：换一条路，或者退回 `act`。
