---
name: codebase-migration-refactor
alias: Codebase Migration and Refactoring
version: 1.0.5
description: "Ship a change-everywhere-the-same-way edit as reviewable batches — write the transform as an exact rule, measure the blast radius, apply it with a codemod, verify one batch at a time, then sweep what the migration left behind. Use when the user asks for a framework or runtime upgrade (React 17 to 19, Node 18 to 22, Django 4 to 5), an API or symbol rename across a monorepo, a test-runner or bundler swap (jest to vitest, webpack to vite, eslint to biome), CommonJS to ESM, splitting a module into packages, or any bulk edit over dozens to hundreds of files — 批量改代码、全局改名、升级依赖、迁移测试框架、拆包重构. Do NOT use for a single-file edit, for reviewing whether an existing migration is correct, or for a rename whose only witness is grep while the symbol is generated or re-exported — that is a move-code refactor and needs characterization tests first."
---

# Codebase Migration and Refactoring

Turn "change 200 files the same way" into a rule you can re-run, a blast radius you measured, and a series of small batches someone can actually review. You do the transforms; the review trail comes from the strongest tool this machine has.

## The one rule

**No transform, no edit.** Until the change is one exact statement — which call becomes which, which file is renamed, which variants stay untouched — do not touch a file. A vague goal is a planning problem, not a codemod problem.

## Step 0 — Name the delivery tier

Check once, say it in one sentence, then work at that tier. A missing convenience tool changes how the work is reviewed, never whether it happens.

| Tier | Check | What the trail looks like |
| --- | --- | --- |
| 1 — Composio | `composio --version` | tracking issue, one pull request per batch, CI verdict posted back |
| 2 — GitHub CLI | `gh auth status` | one pull request per batch, `gh pr checks --watch` |
| 3 — git only | `git remote -v` | one branch and one commit per batch, the repo's own test command, verdict reported in the conversation |

Tier 3 is a real tier: slower to review, not less correct. Never drop verification silently, and never describe a pull request that was not opened.

## Workflow

1. **Write the rule down.** Bad: "modernize the tests". Good: "`jest.mock`→`vi.mock`, `jest.fn`→`vi.fn`, `jest.config.js`→`vitest.config.ts` from template X, leave `jest.requireActual` for pass two."

2. **Measure before editing**, and split by variant:

   ```bash
   rg -l 'jest\.(mock|fn|spyOn)' --stats        # how many files
   rg -l 'jest\.' --glob '!**/*.test.*'         # calls hiding outside tests
   ```

   Thousands rather than dozens means the rule is wrong — not that the batches should be bigger.

3. **Record the baseline.** Clean `git status`, current test result, and **every test already failing**, written to a file. Every later batch is judged against it; a red baseline cannot verify anything.

4. **Put the rule in a script inside the target repo** and let it own batch selection, so no shell quoting stands between you and a correct batch:

   ```bash
   node codemods/<change>.mjs --count                  # files still to change
   node codemods/<change>.mjs --write --limit 25       # rewrite the next 25
   ```

   Copy the working skeleton from `$SKILL_DIR/references/codemod-harness.md` — it walks the tree, skips `done.list`, and writes `batch.list` itself.

5. **Run one batch per branch**, stage only that batch, verify, then deliver at your tier:

   ```bash
   git checkout -b migrate/<change>-batch-03
   node codemods/<change>.mjs --write --limit 25
   <the repo's test command>
   git add --pathspec-from-file=batch.list          # never `git add -A`
   git commit -m "migrate(<area>): <change> (batch 3)"
   ```

   Read the diff (`git diff --stat` plus three files end to end) before opening anything, hand-patch what the codemod missed, and name every hand-edit in the review text.

6. **Verify, then sweep.** Per batch: the old pattern's count trends to zero and the test command passes. On the last batch: the full suite, build and start the app, toolchain parity with CI, then the residue sweep — dead config, disabled checks, leftover shims, stale docs, inlined secrets.

Exact commands for every tier, the move-code variant (characterization tests, re-export shims), and the residue checklist: `$SKILL_DIR/references/workflow.md`.

## Done

A batch is done when you can quote the output that proves it: the count, the test run, and at tier 1–2 the CI conclusion. The migration is done when the closing report states what changed, what deliberately did not, how to verify it, and the residue list with file paths.

## Do not do

- Do not start a batch before the baseline exists.
- Do not claim a batch passed without the command output.
- Do not `git add -A`, reformat untouched files, or mix two transforms in one batch.
- Do not force-push a batch that was reviewed or merged.
- Do not keep going when the blast radius outruns what the user described — stop and ask.
- Do not stop the whole task because a convenience CLI is absent; drop a tier and continue.

## References (read on demand)

| File | Read it when |
| --- | --- |
| `$SKILL_DIR/references/codemod-harness.md` | Writing or adapting the batch script; choosing between `ts-morph`, `ast-grep`, `jscodeshift` and plain regex |
| `$SKILL_DIR/references/workflow.md` | Running a batch for real — exact per-tier commands, move-code refactors, per-batch and final verification, residue sweep, troubleshooting |

Do not read both up front. `SKILL_DIR` is read-only; write every artifact to the working directory.
