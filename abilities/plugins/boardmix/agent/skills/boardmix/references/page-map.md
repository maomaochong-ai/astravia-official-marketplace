# Page map reference

Where things are, and — more useful — how to tell whether you actually got there.

## Addresses the plugin can reach

Every one of these passes the same origin gate. They are the only destinations the plugin knows by
name; anything else must come from the user as a link.

| Destination | Address | Use it for |
| --- | --- | --- |
| Workspace | `/app/` | The default landing. `boardmix_open` goes here |
| Recent files | `/app/recent-file` | The only place a user can find a board you cannot list |
| Create | `/app/create` | Picking a board type and starting it |
| AI · PPT | `/app/ai/ppt` | Slide generation |
| AI · flowchart | `/app/ai/flowchart` | Diagram generation |
| AI · chat | `/app/ai/chat` | The in-page assistant: mind map, doc, image, writing, SWOT |
| Login | `/user/login/` | Where `phase` reads `login` |

## Reading `phase`

| `phase` | Meaning | Your move |
| --- | --- | --- |
| `workspace` | The address is under `/app` | You are where you meant to be. Hand over the path |
| `login` | Boardmix's own sign-in page | Stop. The user signs in; you do not assist, retry or fill anything |
| `unknown` | Any other boardmix address — the marketing site, a help-centre page | Not a workspace. Navigate to a destination if the task needs one |

`unknown` is not an error. It means "this address is real but it is not the app".

## A 200 proves nothing

Boardmix's app is a single-page shell: `/app/anything-you-invent` answers **200** and then renders
whatever the client router decides. So:

- never validate a route with an HTTP status;
- never claim "the page opened" from a status — read `url` and `phase` from the envelope instead;
- never construct a board address from a guessed id. If you have no link, ask for it. A guessed deep
  link lands on the workspace root and the user sees a page that has nothing to do with their board.

## Where the controls live (official help-centre groups)

Boardmix's own help centre organises the product into groups. Groups are stable enough to talk about;
individual button positions are not, and they move between versions. **Name the group, not a
coordinate.**

| Group | Covers |
| --- | --- |
| 创作工具 | Mind map, flowchart, basic shapes, stickies, doc & card, pen / eraser, connectors |
| 资源与素材 | Asset library, templates, embedded web pages, graphic resources |
| 画布设置 | Canvas basics, canvas mode |
| 协作与交流 | Share, invite, permissions, comments, voting, presentation mode, breakout groups |
| 互动工具 | Reaction emoji and stamps, timer |
| 导入导出 | Import and export entries |
| AI | The 博思 AI entries |

When the user asks "where is it", answer with the group name and what it contains. If they come back
saying it is not there, ask them what the current panel shows rather than guessing a second location.

## Login, precisely

- The login page is `/user/login` — **not** `/login`, which does not exist on this site.
- SSO redirects, verification codes and phone confirmation all happen inside the page. The plugin
  never sees them and never asks for them.
- Signing in inside the panel persists in the panel's own storage partition, so the next session
  starts signed in. Signing in via `boardmix_open_in_browser` does not.
- If `phase` stays `login` after the user says they signed in, they most likely signed in elsewhere
  or the page is on a stale screen: ask them to reload the panel once, then read `phase` again.
