# Running a session

For when the user says "明天开个研讨会" — a sequence, not a single action.

## Before the day

| Step | Who | What good looks like |
| --- | --- | --- |
| Structure the content | You, via `boardmix-canvas` | One canvas that already carries the agenda; the meeting is not spent building frames |
| Decide the permission tier | You ask, user decides | Read-only for observers, comment for reviewers, edit only for co-authors |
| Seed the wall | User | Empty stickies with the question written on them — an empty canvas stalls a room |
| Confirm external access | User | If anyone outside the org attends, check the org's external-sharing setting now, not at 09:55 |

## The sequence, with timings that hold

1. **Framing (5 min)** — presentation mode on the agenda canvas. One problem statement, one outcome.
2. **Diverge (10 min)** — stickies, silent writing first. Silence is what makes introverts contribute;
   talking first collapses the room onto the loudest idea.
3. **Cluster (5 min)** — affinity grouping. Do not name clusters yet; naming early kills the outlier.
4. **Breakout (15 min)** — breakout groups, one question per group, timer visible. A breakout without a
   timer produces one group working and three chatting.
5. **Converge (10 min)** — voting, dot-voting style. Cap votes per person so the result is a ranking,
   not a popularity spike.
6. **Close (5 min)** — read the comment list as the decision log; assign owners out loud. Export after
   the meeting, not during it.

Adjust the numbers to the meeting, but keep the order — framing, diverge, cluster, breakout, converge,
close. Skipping cluster is the most common mistake and the one that wastes the diverge phase.

## What the agent does during the session

- Hands out the sequence and the panel group for each phase.
- Writes the prompts: the frame question, the divergence prompt, the breakout questions, the voting
  wording. That is the part that actually changes the outcome.
- Changes the visible screen with `boardmix_goto` when a phase needs a different board.

Not: placing stickies, running the timer, reading the room, summarising what people wrote. The last
one is worth saying out loud — users ask, and the honest answer is that the canvas is invisible to the
agent.

## Failure modes to pre-empt

| Symptom | Likely cause | What to tell the user |
| --- | --- | --- |
| "The link does not open for the client" | Org forbids external sharing | Check the org setting, then re-issue. Not a broken link |
| "They can see it but cannot type" | Comment or read-only tier | That may be exactly what was chosen. Confirm which tier was intended |
| "Everyone is editing the same sticky" | No ownership assigned | Assign a scribe per cluster, or move to comment-only for convergence |
| "We ran out of boards" | Free tier: 3 editable files | Archive or upgrade; do not keep creating |
| Export has a watermark | Free tier export | Say it before the meeting, not after the client sees it |

## After the meeting

The comment list is the deliverable. Ask the user to export it or read it out; you cannot. Then hand
`boardmix-io` the export task if a file is needed for people who were not there.
