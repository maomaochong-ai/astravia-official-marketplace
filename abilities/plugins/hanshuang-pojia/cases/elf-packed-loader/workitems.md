# Work Items — elf-packed-loader (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | |
| WI-002 | Triage the packed sample and record its hash | lead | sample | binary | todo | | format, arch, entropy, imports |
| WI-003 | Locate the stub and the unpacking loop | lead | sample | binary | todo | | entry point, mmap/mprotect imports |
| WI-004 | Dump the recovered image and hash it | lead | sample | binary | todo | | dump command recorded |
| WI-005 | Analyse the recovered image, not the stub | lead | dump | binary | todo | | every offset named with its file |

## Coverage
- [ ] Recon/analysis complete for in-scope assets
- [ ] Critical/High candidates triaged (or N/A for pure RE)
- [ ] Validated findings have Evidence (E-*)
- [ ] Path documented (attack/call/solve)
- [ ] Timeline continuous across major phases
- [ ] Report written under report/
- [ ] field-journal entry anonymized

## Refs
- kb/field_journal_seed-001_elf-packed-loader.md
- kb/re_pattern_elf-analysis.md
- docs/contract/case-library.md
