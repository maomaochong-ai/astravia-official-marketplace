# Diagram recipes

Practical rules for the Mermaid you hand over. Nothing here needs the canvas to be visible.

## Pick the right diagram type

| The content is | Use | Why not the other one |
| --- | --- | --- |
| Steps with decisions and loops | `flowchart TD` | A mind map cannot express a branch condition |
| Work crossing roles or systems | `flowchart LR` with subgraphs per role | Swimlane in `flowchart` reads left-to-right; vertical collapses the lanes |
| One topic fanning outward | `mindmap` | A flowchart of a hierarchy looks like an org chart and loses the "expand one branch" feel |
| Systems and their dependencies | `flowchart LR`, edges labelled with the interaction | Sequence notation promises timing you do not have |
| Ordered messages between parties | `sequenceDiagram` | Only when the user actually listed the message order |

If the user's content has no edges — just items — do not invent a diagram. A Markdown list *is* the
right artefact for a sticky wall.

## Node text

- **≤ 15 characters per node.** Longer text goes into a second node or into the reply as a note.
- No trailing punctuation inside a node.
- CJK with parentheses, slashes or colons must be quoted: `A["审批（法务）"]`. Unquoted `(` starts a
  shape modifier and the parse fails.
- Nouns, not sentences. `生成报价单`, not `系统会在这里生成一份报价单`.

## Edges

- Label every branch: `-->|是|`, `-->|否|`, `-->|超时|`. An unlabelled fan-out is a diagram the reader
  has to reverse-engineer.
- No edge crosses a subgraph boundary without a reason. If it does, the partition is wrong.
- Happy path left-to-right or top-down; error paths to the side. Do not zigzag.
- One start node per diagram. Two starts means two diagrams.

## Sizing to the element budget

Each node, each edge and each subgraph frame counts against the 150-element free limit. Rough
counting, which is close enough to warn the user accurately:

| Diagram | Elements |
| --- | --- |
| 8 nodes + 9 edges | ~17 |
| 15 nodes + 18 edges + 3 subgraphs | ~36 |
| 25 nodes + 30 edges + 5 subgraphs | ~60 |

Over 60, split the diagram along its own subgraph boundary and say why: two readable diagrams beat
one unreadable one, and the split keeps them inside the free budget.

## Mind map shape

```text
mindmap
  root((Q3 路线))
    目标
      留存
      收入
    关键结果
      留存率 45%
      续费率 80%
```

- Three levels deep is the practical maximum for a canvas; a fourth level is a doc page, not a map.
- Branch names are nouns; keep sibling branches parallel in grammar.
- Do not put numbers in the map if the user will change them — they become stale inside a picture.

## Paste-friendly Markdown for stickies

```markdown
- 用户反馈：导出太慢
- 用户反馈：找不到历史版本
- 待验证：模板库使用率
```

One bullet per sticky, no nesting, no bold. Nested bullets paste as one sticky containing dashes,
which the user then has to split by hand.

## Before you hand it over

1. Count the nodes and edges; write the number in the reply.
2. Read the Mermaid once for unquoted CJK punctuation.
3. Check every branch has a label.
4. Check there is exactly one entry point.
5. Only then name the landing step (创作工具 → 流程图 / 思维导图).
