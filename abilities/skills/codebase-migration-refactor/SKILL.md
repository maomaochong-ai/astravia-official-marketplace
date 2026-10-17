---
name: codebase-migration-refactor
alias: 代码库迁移与重构 · Codebase Migration
version: 1.0.1
description: Run large codebase migrations and multi-file refactors. Uses the Composio CLI to coordinate issue tracking, batched PRs, and CI verification while the agent executes the transforms locally across hundreds of files.
---

# Codebase Migration & Refactoring

Coordinate framework upgrades, API renames, config rewrites, and structural refactors across hundreds of files. Local edits are driven by the agent; the [Composio CLI](https://docs.composio.dev/docs/cli) handles the surrounding ceremony: tracking issues, per-batch PRs, and CI verification.

## When to Use

- Framework upgrade (React 17 → 19, Node 18 → 22, Django 4 → 5).
- API rename across a monorepo (e.g., `getUserById` → `users.byId`).
- Config/format migration (webpack → vite, eslint → biome, jest → vitest).
- Any "change 200 files the same way" task that needs to ship in reviewable slices.

Not for a single-file edit. And if the only witness to a rename is grep — the symbol is generated, aliased or re-exported — treat it as a refactor with a test net (see *Refactors that move code*), not a search-and-replace.

## Prereqs

```bash
curl -fsSL https://composio.dev/install | bash
composio login
composio link github        # for PRs + CI status
composio link linear        # or jira — for migration tracking
```

Local tools the agent will use directly: `git`, `rg`, `jscodeshift`/`ts-morph`/`comby`/`ast-grep` (language-appropriate), and your test runner.

If `composio` is missing or not linked, stop and tell the user what is missing. Do not silently fall back to bare `git`: the tracking issue, the per-batch PR and the CI verdict are the three things that make a 200-file change reviewable.

## Planning Phase

1. **Define the transform precisely.** Bad: "migrate to vitest." Good: "replace `jest.mock` with `vi.mock`, swap `jest.fn()` for `vi.fn()`, rename `jest.config.js` → `vitest.config.ts` using template X."

2. **Scope the blast radius:**

   ```bash
   rg -l 'jest\.(mock|fn|spyOn)' | wc -l      # files to change
   rg -l 'from "jest"' | sort                 # variants to handle separately
   rg -l 'jest\.' | grep -v '\.test\.'        # ones hiding outside tests
   ```

   Also record the baseline before touching anything: clean `git status`, the current test result, build time, and **any test already failing**. A migration judged against a broken baseline cannot be verified later.

3. **File a tracking issue:**

   ```bash
   composio execute LINEAR_CREATE_ISSUE -d '{
     "teamId":"TEAM_ID",
     "title":"Migrate test runner: jest → vitest",
     "description":"Batches of ~25 files. Checkpoint after each PR lands green."
   }'
   ```

   Keep the returned issue id (e.g. `LIN-482`): every batch PR body and every status comment references it.

## Execute in Reviewable Batches

Loop: pick N files → transform → test → PR → wait for green → merge → next batch.

```bash
# Batch helper: first 25 untouched files matching the pattern
BATCH=$(rg -l 'jest\.mock' | grep -v done.list | head -25)
echo "$BATCH" > batch.list
```

The agent runs the codemod on `batch.list`, then:

```bash
git checkout -b migrate/vitest-batch-03
xargs < batch.list codemod-runner   # e.g. jscodeshift / ts-morph / comby / ast-grep
npm test -- --changed
git add -A && git commit -m "migrate(test): jest → vitest (batch 3)"
git push -u origin migrate/vitest-batch-03

composio execute GITHUB_CREATE_A_PULL_REQUEST -d '{
  "owner":"acme","repo":"app",
  "head":"migrate/vitest-batch-03","base":"main",
  "title":"migrate(test): jest → vitest (batch 3)",
  "body":"Part of LIN-482. 25 files. Codemod: `transforms/jest-to-vitest.ts`."
}'
```

Then poll CI and merge when green:

```bash
composio execute GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY \
  -d '{"owner":"acme","repo":"app","branch":"migrate/vitest-batch-03"}'
```

Before opening the PR, read the diff (`git diff --stat`, plus three files end to end) and hand-patch whatever the codemod missed — name each hand-edit in the PR body. After the PR merges green, append the batch to `done.list` and rebase the next branch onto the updated `main` before starting it.

## Workflow Script

Write `scripts/migrate-batch.ts` into the target repo and run it per batch with `composio run --file scripts/migrate-batch.ts -- --batch 3`:

```ts
const batch = process.argv[process.argv.indexOf("--batch") + 1];

const pr = await execute("GITHUB_CREATE_A_PULL_REQUEST", {
  owner: "acme", repo: "app",
  head: `migrate/vitest-batch-${batch}`, base: "main",
  title: `migrate(test): jest → vitest (batch ${batch})`,
  body: `Part of LIN-482. See transforms/jest-to-vitest.ts.`
});

await execute("LINEAR_CREATE_COMMENT", {
  issueId: "LIN-482",
  body: `Opened PR #${pr.number}: ${pr.html_url}`
});
```

## Refactors That Move Code

The loop above assumes "the same change, applied many times". When the change instead moves code — extracting a package, splitting a module, relocating a directory boundary — the transform alone is not enough:

- Write characterization tests that capture current behaviour first, even where that behaviour is ugly.
- One concern per commit: move the file → update imports → rename the symbol → change call sites. Never all four at once.
- Keep public entry points and exported types stable; an interface change gets a commit of its own.
- Prefer a temporary re-export shim (`export * from "./new/location"`) over a big-bang rename: every consumer keeps compiling while the move lands, and the shim dies in a later batch that is itself auditable.

## Safety Rails

- **One transform per PR.** Never mix a rename with a format change.
- **Keep a `done.list`** of files already migrated so the next batch skips them.
- **Run the full test suite on the last batch**, even if per-batch PRs ran `--changed`.
- **Codemod first, hand-edit second.** If the codemod misses 3 files, patch them manually and note it in the PR body.
- **Roll back per-batch**, not globally. Each PR should revert cleanly.
- **Do not reformat files you did not otherwise change** — it buries the real diff and makes the rollback unreviewable.
- **Never force-push a batch that has been reviewed or merged.**
- **Stop and ask when the blast radius exceeds what the user described.** 4,000 files means the transform is wrong, not that the batches should be bigger.

## Verification Loop

After each merge:

```bash
rg 'jest\.(mock|fn|spyOn)' | wc -l     # should trend to 0
npm test                                # full suite
composio execute GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY \
  -d '{"owner":"acme","repo":"app","branch":"main","event":"push"}' \
  | jq '.workflow_runs[0].conclusion'
```

On the last batch, without shortcuts: run the **full** suite, build and start the app (a migration that compiles and fails at runtime is still broken), confirm toolchain parity with CI (`.nvmrc`, `engines`, `pyproject.toml`, `rust-toolchain.toml`), and grep again for the old symbol in docs, templates, fixtures and snapshots.

## Audit What the Migration Left Behind

A zero grep count proves the files you changed are right; it proves nothing about what you did not touch. Sweep before closing:

```bash
rg -n 'jest' --glob '!node_modules' --glob '!done.list'      # old tool name anywhere
rg -n 'webpack|babel' package.json tsconfig*.json            # dead config keys
rg -n 'TODO|FIXME|migrat' --glob '!node_modules' | head -40   # half-finished notes
```

- **Dead configuration** — keys the new tool ignores, the old runner's block in `package.json`, obsolete path aliases, scripts still invoking the removed binary.
- **Silently disabled checks** — lint rules, strict mode, hooks or CI jobs turned off "temporarily" during the migration and never restored.
- **Leftover shims** — compatibility re-exports, dual configs, `if (legacy)` branches. Name them in the issue comment so they do not become permanent.
- **Docs and templates** — setup guides, scaffolding templates and CI workflow paths still describing the old stack.
- **Secrets** — a config rewrite that inlined an env var as a literal, or moved a token into a file that is now committed.

Post the list to the tracking issue as open items with file paths; do not silently delete what you are not sure about.

## Troubleshooting

- **Codemod regex catches too much** → switch to AST-based tooling (`ast-grep`, `ts-morph`) for structural matches.
- **Tests pass locally, CI fails** → pin Node/Python version parity; check `.nvmrc` / `pyproject.toml`, and run the CI command verbatim.
- **PR too big to review** → cut batch size in half; maintainers won't review 800-line diffs.
- **Conflicts between batches** → rebase the open batch before merging the current one; never force-push merged batches.
- **One file resists every codemod** → transform it manually, commit it alone, and say why in the PR body.
- **`composio execute` fails on auth or a missing link** → re-run `composio login` / `composio link github`, and report the failure instead of continuing batches without a PR trail.

## Reporting

Close each batch with one short paragraph on the tracking issue: files touched, codemod used, CI verdict, anything hand-patched. Close the migration with: what changed, what deliberately did not, how to verify it, and the residue list above.

Full CLI reference: [docs.composio.dev/docs/cli](https://docs.composio.dev/docs/cli)
