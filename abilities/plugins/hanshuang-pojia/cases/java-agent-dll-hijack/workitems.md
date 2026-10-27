# Work Items — java-agent-dll-hijack (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes a `E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | commercial target; jar and JRE never copied out |
| WI-002 | Decompile the entitlement decision and brand enum | lead | app | binary | todo | | controller field, state machine, every reader |
| WI-003 | Enumerate the launcher and JVM native imports | lead | app | binary | todo | | check each against KnownDLLs |
| WI-004 | Write the agent: three seams, real object returned | lead | app | process | todo | | parse entry, metadata unpacker, state machine |
| WI-005 | Prove `premain` ran and the licence object is real | lead | app | process | todo | | licensee / tier / expiry read back |
| WI-006 | Find the second-order entitlements | lead | app | binary | todo | | preferences key, DI provider, derived token |
| WI-007 | Build the forwarder proxy DLL from the real export table | lead | app | process | todo | | generate, never hand-write |
| WI-008 | Hook the IAT slot for `GetProcAddress` and wrap the JVM entry | lead | app | process | todo | | save the original pointer for pass-through |
| WI-009 | Inject the agent through `JavaVMInitArgs` | lead | app | process | todo | | option count before/after is the evidence |
| WI-010 | Verify both files' hashes are unchanged | lead | app | binary | todo | | jar and launcher |
| WI-011 | Restore the install directory and prove it | lead | app | file | todo | | file list + hashes before/after |
| WI-012 | Write the finding: two entry points, two fixes | lead | report | process | todo | | CWE-602/321 and CWE-427 kept separate |

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
- cases/java-agent-dll-hijack/docs/loader-chain.md
