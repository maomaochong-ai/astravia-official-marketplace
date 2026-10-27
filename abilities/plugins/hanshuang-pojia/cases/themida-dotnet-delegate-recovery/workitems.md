# Work Items — themida-dotnet-delegate-recovery (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes a
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | commercial target; process-level injection only |
| WI-002 | Record loader facts that prove a managed image is inside | lead | app | binary | todo | | COM descriptor, `.themida`-style section, import count |
| WI-003 | Rebuild the managed PE in memory and locate COR20 | lead | app | runtime | todo | | metadata tables walk, not disk patching |
| WI-004 | Confirm the packer's own JIT vtable hook | lead | app | runtime | todo | | `compileMethod` pointer outside `clrjit.dll` |
| WI-005 | Intercept real IL and count the stubs | lead | app | runtime | todo | | MethodDef count vs four-byte bodies vs captured bodies |
| WI-006 | Rebuild fat headers and repoint MethodDef.RVA | lead | app | runtime | todo | | reuse `maxStack` / `localVarSigTok` / EH from the stub |
| WI-007 | Collapse string encryption and call proxies by reflection | lead | app | runtime | todo | | enumerate static delegate fields; count them |
| WI-008 | Dump the assembly loaded from bytes | lead | app | runtime | todo | | `Assembly.Load(byte[])`; absent from disk |
| WI-009 | Read the authorisation state machine and its decision field | lead | app | binary | todo | | one field, one compare, one branch |
| WI-010 | Measure how long a forged state survives revalidation | lead | endpoint | web | todo | | minutes, not seconds; log the rewrite |
| WI-011 | Prove the environment is clean afterwards | lead | process | process | todo | | no persisted CLR bootstrap variables remain |
| WI-012 | Write the finding with root cause and fix | lead | report | process | todo | | CWE-602 primary; key derivation and integrity secondary |

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
- cases/themida-dotnet-delegate-recovery/docs/protection-layers.md
