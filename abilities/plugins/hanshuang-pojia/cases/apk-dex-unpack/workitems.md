# Work Items — apk-dex-unpack (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | |
| WI-002 | Triage the APK and record its hash | lead | apk | android | todo | | permissions, exported components, native libs |
| WI-003 | Identify the shell and the loader entry point | lead | apk | android | todo | | search_dex_symbols hits |
| WI-004 | Record the shell as decompiled | lead | apk | android | todo | | jadx output kept under exports/ |
| WI-005 | Dump the runtime DEX and validate every header | lead | device | android | todo | | dump command, wait/delay, per-file hash |
| WI-006 | Analyse the dump, not the shell | lead | dump | android | todo | | class count recovered vs implied |

## Coverage
- [ ] Recon/analysis complete for in-scope assets
- [ ] Critical/High candidates triaged (or N/A for pure RE)
- [ ] Validated findings have Evidence (E-*)
- [ ] Path documented (attack/call/solve)
- [ ] Timeline continuous across major phases
- [ ] Report written under report/
- [ ] field-journal entry anonymized

## Refs
- kb/field_journal_2026-07-14_android-arm64-self-extract-source-recovery.md
- agent/skills/apkseep/references/advanced-unpacking.md
- docs/contract/case-library.md
