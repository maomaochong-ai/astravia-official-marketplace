# Running the migration

Read this while a batch is actually in flight. `SKILL.md` holds the rule and the loop; this file holds the commands, the move-code variant, the residue sweep, and the failures worth recognising.

## Baseline, before any edit

```bash
git status --short                       # must be empty, or name what is already dirty
<the repo's test command>                # capture the full output, including failures
```

Write the result to one file you keep for the whole migration (`baseline.txt` next to the codemod):

```
commit: <sha>
test command: <exact command>
result: <n passed, m failed>
already failing: <test names, or "none">
build: <seconds, or "not measured">
node/python/rust: <version>
```

Every later "it passes" is measured against this. A migration judged against an already-red baseline cannot be verified, and the failure will be blamed on the migration.

## The batch, tier by tier

Tier 3 — branch and commit only:

```bash
git checkout -b migrate/<change>-batch-03
node codemods/<change>.mjs --write --limit 25
<the repo's test command>
git add --pathspec-from-file=batch.list
git commit -m "migrate(<area>): <change> (batch 3)"
git push -u origin migrate/<change>-batch-03
```

Tier 2 — GitHub CLI:

```bash
gh pr create --base main --head migrate/<change>-batch-03 \
  --title "migrate(<area>): <change> (batch 3)" \
  --body "Part of #482. 25 files. Codemod: codemods/<change>.mjs. Hand-edited: <files>."
gh pr checks --watch
```

Tier 1 — Composio. Replace every placeholder with a real value; tool slugs differ per workspace, so if one is rejected ask the workspace which tool it exposes instead of guessing another name.

```bash
composio execute LINEAR_CREATE_ISSUE -d '{"teamId":"TEAM_ID","title":"Migrate <thing>","description":"Batches of ~25 files. Checkpoint after each PR lands green."}'
composio execute GITHUB_CREATE_A_PULL_REQUEST -d '{"owner":"OWNER","repo":"REPO","head":"migrate/<change>-batch-03","base":"main","title":"migrate(<area>): <change> (batch 3)","body":"Part of ISSUE_ID. Codemod: codemods/<change>.mjs."}'
composio execute GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY -d '{"owner":"OWNER","repo":"REPO","branch":"migrate/<change>-batch-03"}'
composio execute LINEAR_CREATE_COMMENT -d '{"issueId":"ISSUE_ID","body":"Batch 3 pull request opened."}'
```

After a batch lands green, rebase the next branch onto the updated base. Never force-push a batch that was reviewed or merged.

## Before you open the review

```bash
git diff --stat                      # is this really one batch, one concern?
git diff --numstat | sort -rn | head  # the largest files deserve a full read
```

Read three of them end to end. Anything the codemod could not decide gets hand-patched and named in the review text — a reviewer cannot see a hand-edit that looks like codemod output.

## When the change moves code

Extracting a package, splitting a module, relocating a boundary is not "the same change, applied many times":

- Characterization tests first, capturing current behaviour, even where it is ugly.
- One concern per commit: move the file → update imports → rename the symbol → change call sites. Never all four at once.
- Keep public entry points and exported types stable; an interface change gets its own commit.
- Prefer a temporary re-export shim (`export * from "./new/location"`): consumers keep compiling while the move lands, and the shim dies in a later auditable batch.

## Verify each batch, then everything

Per batch:

```bash
rg -l '<old pattern>' --stats        # count must trend to zero
<the repo's test command>
```

On the last batch, without shortcuts:

- the **full** suite, not a scoped run;
- build and start the app — a migration that compiles and fails at runtime is still broken;
- toolchain parity with CI (`.nvmrc`, `engines`, `pyproject.toml`, `rust-toolchain.toml`), then run the CI command verbatim;
- the old symbol grepped again in docs, templates, fixtures and snapshots.

## Residue sweep

A zero count proves the files you changed are right; it proves nothing about the ones you did not touch.

```bash
rg -n '<old tool>' --glob '!node_modules' --glob '!done.list'
rg -n 'webpack|babel' --glob 'package.json' --glob 'tsconfig*.json'
rg -n 'TODO|FIXME|migrat' --glob '!node_modules'
```

Report as open items with file paths; delete nothing you cannot justify:

- **Dead configuration** — keys the new tool ignores, the old runner's block in `package.json`, obsolete path aliases, scripts invoking a removed binary.
- **Silently disabled checks** — lint rules, strict mode, hooks, CI jobs switched off "temporarily" and never restored.
- **Leftover shims** — compatibility re-exports, dual configs, `if (legacy)` branches.
- **Docs and templates** — setup guides, scaffolding templates, CI workflow paths still describing the old stack.
- **Secrets** — a config rewrite that inlined an env var as a literal, or moved a token into a committed file.

## Failures worth recognising

| Symptom | What it actually means |
| --- | --- |
| The pattern matches thousands of files | The rule is wrong. Narrow it; do not grow the batch. |
| A file does not change after `--write` | The rule does not cover that shape. The `stuck` list names it: second pass or hand-edit. |
| Tests pass locally, CI fails | Version or config parity. Run the CI command verbatim, compare runtimes. |
| Reviewers say the PR is too big | Halve `--limit`. An 800-line diff is not reviewed, it is approved. |
| Two open batches conflict | Rebase the open one onto the updated base before merging the current one. |
| The pull request or tracker step fails on auth | Re-authenticate once, then report it. Do not keep pushing batches with no review trail. |
