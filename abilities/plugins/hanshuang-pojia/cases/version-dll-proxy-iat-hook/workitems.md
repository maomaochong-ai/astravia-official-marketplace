# Work Items — version-dll-proxy-iat-hook (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | signed binary; the copy must be authorised too |
| WI-002 | Map the auth chain end to end | lead | app | binary | todo | | registry path, key derivation, cipher, predicate, dispatch |
| WI-003 | Verify the mask transform both directions | lead | app | binary | todo | | three known pairs, forward and inverse |
| WI-004 | Enumerate the store sites and their branches | lead | app | binary | todo | | three editions, each behind its own branch |
| WI-005 | Check the hard module dependency | lead | app | runtime | todo | | missing module means `ExitProcess` before patching |
| WI-006 | Prove the loader picks up a same-named module | lead | app | runtime | todo | | module path in the loaded list, not in the program directory |
| WI-007 | Apply the branch edits, then the immediate | lead | app | runtime | todo | | complete instructions only |
| WI-008 | Measure the dialog control at runtime | lead | app | runtime | todo | | id, class, style, line count |
| WI-009 | Hook the wide-string hand-off, not the template | lead | app | runtime | todo | | plain `wchar_t*`, no C++ ABI |
| WI-010 | Read the control back from another process | lead | app | runtime | todo | | text dump + line count |
| WI-011 | Confirm exe, signature and data module untouched | lead | process | process | todo | | hash and signature check |
| WI-012 | Write the finding with root cause and fix | lead | report | process | todo | | CWE-602 primary; loader and display path secondary |

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
- cases/version-dll-proxy-iat-hook/docs/edition-and-dialog.md
