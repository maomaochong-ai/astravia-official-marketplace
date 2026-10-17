---
name: codebase-migration-refactor
alias: 代码库迁移与重构 · Codebase Migration
version: 1.0.0
description: Plan and execute large-scale migrations and multi-file refactors in reviewable batches — pin the exact transform, measure its blast radius, drive codemods with AST tooling, verify tests and CI after every batch, and audit the residue the migration leaves behind.
---

# Codebase Migration & Refactoring

A migration is one precise transform applied hundreds of times, shipped in slices a reviewer can approve. The agent does the edits; git, the codemod tool and the test suite are the ceremony around them.

## When to use

- Framework or runtime upgrade: React 17 → 19, Node 18 → 22, Django 4 → 5, Spring Boot 2 → 3.
- API rename across a monorepo: `getUserById` → `users.byId`.
- Tooling or format migration: webpack → vite, eslint → biome, jest → vitest, CommonJS → ESM.
- Structural refactor: splitting a module, extracting a package, moving a directory boundary.
- Any "change 200 files the same way" task that has to land in reviewable slices.

Not for a single-file edit, and not for a rename whose only witness is grep: if the symbol is generated, aliased or re-exported, treat it as a refactor with tests (below), not a search-and-replace.

## 1. Define the transform before touching a file

Write the transform as a rule you could hand to someone else. Vague scope is the failure mode that produces 800-line diffs.

- Bad: "migrate to vitest."
- Good: "replace `jest.mock` with `vi.mock`, `jest.fn()` with `vi.fn()`, `jest.spyOn` with `vi.spyOn`, rename `jest.config.js` → `vitest.config.ts` from template X, and add `globals: true` only where the config already imported from `@jest/globals`."

Then measure the blast radius and write the numbers down:

```bash
rg -l 'jest\.(mock|fn|spyOn)' | wc -l          # files to change
rg -l 'from "jest"'                            # variants to handle separately
rg -l 'jest\.' | grep -v '\.test\.'            # ones hiding outside tests
```

Check the workspace is clean (`git status`) and record the baseline: current test result, build time, and any already-failing test. A migration judged against a broken baseline cannot be verified later.

## 2. Pick the tool that matches the shape of the change

- **AST codemod** — `ast-grep`, `ts-morph`, `jscodeshift`, `comby`, `grit`, or the language's own (Nova/rewrite for Java, Rector for PHP, `cargo fix`, `ruff --fix`). Default choice: a rename that must not touch comments or strings needs syntax, not text.
- **Search and replace** — only when the token is unique, unambiguous, and the file set is small enough to read the diff.
- **Manual pass with a checklist** — for the handful of files a codemod structurally cannot reach; note each one in the batch description.

Prefer a codemod that fails loudly on an unexpected pattern over one that silently skips it. Dry-run on ten files first and read the produced diff before scaling up.

## 3. Execute in batches

Batch size is set by reviewability, not by speed. Twenty-five files or one logical subtree per batch, whichever comes first.

Loop, and finish each pass before starting the next:

1. Build the batch list from files not yet in `done.list`.
2. Run the codemod, then read the diff (`git diff --stat` and spot-check three files).
3. Run the focused tests for the touched area; fix or hand-patch what the codemod missed.
4. Commit one transform only, with the batch and the codemod path in the message: `migrate(test): jest → vitest (batch 3)`.
5. Verify in CI, then append the batch to `done.list`.
6. Merge, rebase the next batch onto it, repeat.

Per-batch checks: `rg` count trends toward zero, type-check passes, and the diff contains nothing unrelated. Mixed transforms in one batch make a rollback impossible to reason about; keep a rename and a format change in separate branches even when they touch the same files.

## 4. Verify, then verify again

Per batch:

```bash
rg 'jest\.(mock|fn|spyOn)' | wc -l    # the number that must reach 0
npm test -- --changed                 # or the project's focused runner
git diff --stat main...HEAD           # scope check
```

On the last batch, without shortcuts:

- Run the **full** suite, not `--changed`.
- Build and start the app; a migration that compiles and fails at runtime is still broken.
- Confirm pinned toolchain parity with CI (`.nvmrc`, `engines`, `pyproject.toml`, `rust-toolchain.toml`).
- Grep again for the old symbol, including docs, templates, fixtures and snapshots.

## 5. Refactors need a safety net first

When the change moves code rather than renames it, write the net before moving anything:

- Characterization tests that capture current behaviour, even where that behaviour is ugly.
- One pass per concern: move the file → update imports → rename the symbol → change call sites. Never all four in one commit.
- Keep public entry points and exported types stable; if an interface must change, change it in a commit that contains only that.
- Prefer a temporary re-export shim over a big-bang rename: `export * from "./new/location"` keeps every consumer compiling while the move lands.

## 6. Audit what the migration left behind

Finished code is not a finished migration. After the last batch, sweep for residue:

```bash
rg -n 'jest' --glob '!node_modules' --glob '!done.list'      # old tool name anywhere
rg -n 'webpack|babel' package.json tsconfig*.json            # dead config keys
rg -n 'TODO|FIXME|migrat' --glob '!node_modules' | head -40   # half-finished notes
```

Check specifically:

- **Dead configuration** — keys the new tool ignores, `jest` blocks in `package.json`, obsolete path aliases, scripts that still call the removed binary.
- **Silently disabled checks** — lint rules, strict mode, hooks or CI jobs that were turned off "temporarily" during the migration and never restored.
- **Leftover shims** — compatibility re-exports, dual configs, `if (legacy)` branches. Name them in the report so they do not become permanent.
- **Docs and templates** — setup instructions, scaffolding templates, example snippets and CI workflow paths still describing the old stack.
- **Secrets** — a config rewrite that inlined an env var as a literal, or moved a token into a file that is now committed.

Report the list as open items with file paths; do not silently delete things you are not sure about.

## Reporting

Close each batch with one short paragraph: files touched, codemod used, checks that ran, anything hand-patched. Close the migration with: what changed, what deliberately did not, how to verify it, and the residue above.

## Safety rails

- One transform per branch. Never mix a rename with a format change.
- Keep `done.list` in the repo (or the tracking issue) so the next batch skips finished files.
- Codemod first, hand-edit second; every hand-edit is named in the batch description.
- Roll back per batch. If a batch needs a global revert, it was too big.
- Never force-push a batch that has already been reviewed or merged.
- Do not reformat files you did not otherwise change; it buries the real diff.
- Stop and ask when the blast radius exceeds what the user described: 4,000 files means the transform is wrong, not that the batches need to be bigger.

## Troubleshooting

- **Codemod regex catches too much** — switch to AST matching (`ast-grep --pattern`, `ts-morph`), or narrow to files that import the old symbol.
- **Tests pass locally, CI fails** — toolchain version drift; pin the same Node/Python version and lockfile, and run the CI command verbatim.
- **Diff too large to review** — halve the batch; reviewers stop reading somewhere around 400 lines.
- **Two batches keep conflicting** — rebase the open batch before merging the current one, or reorder them so shared files land in a single batch.
- **One file resists every codemod** — transform it manually, commit it alone, and note why in the PR body.
