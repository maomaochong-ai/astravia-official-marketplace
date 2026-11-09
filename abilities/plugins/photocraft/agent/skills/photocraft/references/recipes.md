# 成套动作（photocraft）

`photocraft_recipe` 直接执行下面这些名字；`{"list": true}` 会列出来。
每条都是一串「按名字执行」的动作，不猜坐标，所以不会因为窗口大小或缩放跑偏。

| id | 什么时候用 | 它做什么 |
| --- | --- | --- |
| `new` | 用户说「新建一个」 | `Cmd+N` |
| `open` | 文件已经在项目里，要进编辑器 | `Cmd+O` |
| `save` | 用户说「保存一下」 | `Cmd+S` |
| `save-as` | 要一份叫别的名字的副本 | `Cmd+Shift+S` |
| `save-acopy` | 原稿不动，另存一份 | `Cmd+Alt+S` |
| `cut` | 把内容从这里挪走 | `Edit › Cut` |
| `copy` | 要拿这段内容到别处 | `Edit › Copy` |
| `paste` | 接上刚才拷贝的内容 | `Edit › Paste` |

失败时返回 `invoked: false` 和每一步的 `attempts`：换一条路，或者退回 `act`。
