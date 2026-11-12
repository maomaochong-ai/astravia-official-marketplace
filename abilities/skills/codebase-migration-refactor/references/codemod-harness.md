# The batch script

One transform, one script, in the target repository under `codemods/`. It owns three things so the agent never hand-assembles a file list: which files still match, which ones this batch rewrote, and what to stage.

Read this when you are about to write `codemods/<change>.mjs`, or when a codemod is catching too much or too little.

## Choosing the matcher

| Situation | Use |
| --- | --- |
| Calls, imports, JSX props, class members — anything structural | `ts-morph` (add it as a dev dependency) or `npx -y @ast-grep/cli -p '<pattern>' --rewrite '<replacement>'` |
| Team already has jscodeshift transforms | `npx -y jscodeshift -t <transform> <paths>` |
| A literal string, a config key, one unambiguous call shape, count under ~100 files | the regex skeleton below |
| The symbol is aliased, re-exported, or generated | not a codemod — see the move-code section in `workflow.md` |

A regex is not a shortcut for a structural change. If the first draft of the pattern needs a negative lookahead to avoid matching the wrong thing, switch to AST tooling.

## Working skeleton

Node only, no dependencies, works on Windows and POSIX. Copy it, then change `HIT`, `rewrite`, and `EXTENSIONS` — leave the batching alone.

```js
// codemods/example.mjs — one transform, applied in reviewable batches.
// Usage: node codemods/example.mjs [--count] [--write] [--limit 25]
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DONE = join(ROOT, "done.list");
const BATCH = join(ROOT, "batch.list");
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "coverage", ".next", "vendor"]);
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

// 1. What counts as a hit. No /g — this one is only tested.
const HIT = /jest\.(mock|fn|spyOn)\b/;

// 2. What a hit becomes.
const rewrite = (source) =>
  source
    .replace(/\bjest\.mock\b/g, "vi.mock")
    .replace(/\bjest\.fn\b/g, "vi.fn")
    .replace(/\bjest\.spyOn\b/g, "vi.spyOn");

const toPosix = (path) => path.split("\\").join("/");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (entry.isFile() && EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

const argv = process.argv.slice(2);
const limitIndex = argv.indexOf("--limit");
const limit = limitIndex === -1 ? 25 : Number(argv[limitIndex + 1]) || 25;
const write = argv.includes("--write");

const done = new Set(existsSync(DONE) ? readFileSync(DONE, "utf8").split(/\r?\n/).filter(Boolean) : []);

const pending = walk(ROOT)
  .map((file) => ({ abs: file, rel: toPosix(relative(ROOT, file)) }))
  .filter(({ abs, rel }) => !done.has(rel) && HIT.test(readFileSync(abs, "utf8")))
  .map(({ rel }) => rel)
  .sort();

if (!write) {
  console.log(`${pending.length} file(s) still match.`);
  process.exit(0);
}

const batch = pending.slice(0, limit);
const stuck = [];
for (const rel of batch) {
  const abs = join(ROOT, rel);
  const before = readFileSync(abs, "utf8");
  const after = rewrite(before);
  if (after !== before) writeFileSync(abs, after);
  if (HIT.test(after)) stuck.push(rel);
  appendFileSync(DONE, `${rel}\n`);
}

writeFileSync(BATCH, batch.map((rel) => `${rel}\n`).join(""));

console.log(`rewrote ${batch.length} file(s); ${pending.length - batch.length} left.`);
if (stuck.length) {
  console.log(`still matching after rewrite — the rule does not cover these: ${stuck.join(", ")}`);
}
```

Then stage exactly this batch:

```bash
git add --pathspec-from-file=batch.list
```

## Why the script, not a shell pipeline

- `git add -A` sweeps unrelated edits into the batch and destroys per-batch rollback. The script writes `batch.list`; `--pathspec-from-file` stages precisely that.
- `rg -l … | xargs …` breaks on spaces in paths, and `| wc -l`, `| jq`, `xargs < file` and `curl … | bash` do not exist in PowerShell. A Node script behaves the same everywhere.
- `done.list` and `batch.list` are batch state, not source — add both to `.gitignore`.
- The report the script prints is the measurement for the batch. Keep it; it goes in the review text.

## Rules for the rewrite function

- **Idempotent.** Running it twice on the same file must change nothing the second time. The skeleton's `after === before` check is a smoke test, not a guarantee.
- **One concern.** If the transform also renames a config file or reorders imports, that is a second script and a second batch.
- **Preserve formatting.** Rewrite text, never re-print a whole file through a formatter; a reformatted file buries the real diff and cannot be reviewed.
- **Leave what you cannot decide.** `jest.requireActual`, dynamic requires, computed member access — leave them matching and let the `stuck` list name them. That list is the next pass, or the hand-edit list for the review.

## Adapting to a new transform

1. Change `HIT` and `rewrite`; keep everything else.
2. Run `--count` and compare with the number you predicted in planning. Off by a factor of ten means the pattern is wrong.
3. Run `--write --limit 1` on a single file and read the diff before running a batch of 25.
4. When the count stops falling, run the residue sweep in `workflow.md` — a zero here only proves the files you touched are right.
