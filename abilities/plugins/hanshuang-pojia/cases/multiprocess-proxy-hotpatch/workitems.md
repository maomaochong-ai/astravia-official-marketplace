# Work Items — multiprocess-proxy-hotpatch (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | install-directory writes need the owner's sign-off |
| WI-002 | Inventory processes and their decision points | lead | suite | binary | todo | | UI, daemon, push service, updater |
| WI-003 | Verify the delivery module is imported everywhere | lead | suite | binary | todo | | if one target lacks it, the design changes |
| WI-004 | Generate the export/forwarder list from the original | lead | module | binary | todo | | hand-written lists break on an unimported API |
| WI-005 | Read each decision site and its branch | lead | suite | binary | todo | | branch, not function entry |
| WI-006 | Encode per-site expected bytes | lead | suite | binary | todo | | comparison is what makes a rebuild safe |
| WI-007 | Build and self-test the guard on a synthetic host | lead | guard | runtime | todo | | no installation touched during development |
| WI-008 | Deploy with a timestamped backup | lead | suite | process | todo | | record every path written |
| WI-009 | Restart resident processes and re-verify | lead | suite | runtime | todo | | stale image is the usual false negative |
| WI-010 | Execute rollback once | lead | suite | process | todo | | a rollback that was never run is a guess |
| WI-011 | Confirm binaries, registry and service config untouched | lead | suite | process | todo | | hash + service configuration diff |
| WI-012 | Write the finding with root cause and fix | lead | report | process | todo | | CWE-602 primary; update channel secondary |

## Coverage
- [ ] Recon/analysis complete for in-scope assets
- [ ] Critical/High candidates triaged (or N/A for pure RE)
- [ ] Validated findings have Evidence (E-*)
- [ ] Path documented (attack/call/solve)
- [ ] Timeline continuous across major phases
- [ ] Report written under report/
- [ ] field-journal entry anonymized

## Refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
- cases/multiprocess-proxy-hotpatch/docs/points-and-proxy.md
