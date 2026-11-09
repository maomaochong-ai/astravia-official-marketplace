# 成套动作（wordcraft）

`wordcraft_recipe` 直接执行下面这些名字；`{"list": true}` 会列出来。
每条都是一串「按名字执行」的动作，不猜坐标，所以不会因为窗口大小或缩放跑偏。

| id | 什么时候用 | 它做什么 |
| --- | --- | --- |
| `new` | 用户说「新建一个」 | `Mod+N` |
| `open` | 文件已经在项目里，要进编辑器 | `Mod+O / Mod+F12 / Mod+Alt+F2` |
| `save` | 用户说「保存一下」 | `Mod+S / Shift+F12 / Alt+Shift+F2` |
| `save-as` | 要一份叫别的名字的副本 | `File › Save As` |
| `undo` | 刚做错了一步 | `Mod+Z` |
| `redo` | 撤错了，要恢复 | `Mod+Y / Mod+Shift+Z` |
| `all` | 要对整张画面动手 | `Mod+A` |
| `zoom-in` | 要看细节 | `View › Zoom In` |
| `zoom-out` | 要看整幅 | `View › Zoom Out` |
| `zoom100` | 要判断真实像素 | `View › 100%` |
| `cut` | 把内容从这里挪走 | `Mod+X` |
| `copy` | 要拿这段内容到别处 | `Mod+C / Mod+Insert` |
| `paste` | 接上刚才拷贝的内容 | `Mod+V / Shift+Insert` |

失败时返回 `invoked: false` 和每一步的 `attempts`：换一条路，或者退回 `act`。
