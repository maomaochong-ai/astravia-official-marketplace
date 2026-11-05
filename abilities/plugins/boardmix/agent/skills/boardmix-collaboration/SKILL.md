---
name: boardmix-collaboration
description: "Get a Boardmix board in front of other people and keep a session on track: share link and permission tier, invite, comments, voting, presentation mode, breakout groups, timers, third-party audio/video. Use when the user wants to share a board with colleagues or a client, collect feedback, run a workshop or review meeting, or asks why a shared link will not open. Do NOT use for editing canvas content (that is boardmix-canvas), for sending the invitation yourself (the plugin cannot — no messaging, no account access), or for promising that a link is publicly reachable."
---

# Collaboration

The share click happens in the page. What happens **before** that click is your job, and it is where
sharing actually goes wrong.

Three answers decide everything downstream: **whose board and for whom** (internal review / client /
public), **can they edit** (read-only / comment / edit), **does the organisation allow it** (team
plans can forbid external sharing — a link that "does not work" is usually this, not a broken link).

Ask those three before the user clicks. Ask them after, and you are doing incident response.

## The one rule

**Never recommend "just share it" without the audience.** A permission tier chosen before knowing who
receives the link is a guess, and the cost of guessing wrong is somebody else's confidential board.

## Permission chooser

| Situation | Recommend |
| --- | --- |
| Client reads one version, does not change it | Read-only, plus password or expiry if the option is available |
| Colleagues add content | Edit — but check the file quota first (free: 3 editable files) |
| Collecting opinions, marking up | Comment permission. Safer than edit, and it is enough for review |
| Public community, classroom | Read-only, and say out loud that it will be forwarded |

## Running a session

A workshop is not one action, it is a sequence, and the sequence is the deliverable:

1. **Content first** — `boardmix-canvas` produces the structure; the user places it.
2. **Rhythm second** — breakout groups + timer + voting. Those three cover most workshops.
3. **Present third** — presentation mode, not screen sharing.
4. **Collect fourth** — the comment list is the list of unresolved decisions; hand export to
   `boardmix-io`.

At each step tell the user which group they are now in: 协作与交流 or 互动工具. The clicking stays
theirs.

## Where the controls are

| Need | Help-centre group |
| --- | --- |
| Share, invite, permissions | 协作与交流 |
| Comments and comment list | 协作与交流 |
| Voting | 协作与交流 |
| Presentation mode | 协作与交流 |
| Breakout groups | 协作与交流 |
| Third-party audio/video | 协作与交流 |
| Reaction emoji and stamps, timer | 互动工具 |

Group names survive redesigns. Do not hand out coordinates.

## Three team-plan traps

- **Seats.** Inviting past the seat count is refused. Check the plan before promising an invite.
- **External sharing.** An organisation can forbid links outside the org. The link then fails for
  outsiders. Confirm the org setting before suspecting the link.
- **Version history.** Team plans expose more of it; the free tier is limited. Say so before the user
  plans to "go back to yesterday's version".

## Done

- the audience and permission tier are stated in the reply;
- the org-level risk (external sharing, seats) is mentioned when it applies;
- the sequence is spelled out with the panel group for each step;
- nothing claims the link was created, the invite was sent, or the meeting is scheduled.

## Do not do

- Do not send messages, invites, or touch any account credential.
- Do not promise `链接一定可以公开访问` — whether it can is an organisation setting, not a fact you
  know.
- Do not describe someone else's board or its comments; you cannot read them.

## References (read on demand)

Resolve against `$SKILL_DIR`.

| File | Read it when |
| --- | --- |
| `references/run-a-session.md` | The user is running an actual workshop and needs the timed sequence, roles and failure modes |
