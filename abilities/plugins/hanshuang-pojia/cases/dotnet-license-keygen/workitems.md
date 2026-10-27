# Work Items — dotnet-license-keygen (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | acceptance run against a copy only |
| WI-002 | Unpack the installer, identify assemblies and versions | lead | app | binary | todo | | which assembly holds the check |
| WI-003 | Classify the obfuscation | lead | app | binary | todo | | body encryption, string encryption, control flow |
| WI-004 | Locate the body executor and dump decrypted IL | lead | app | runtime | todo | | patch the token allocator first |
| WI-005 | Recover the string constants in bulk | lead | app | runtime | todo | | charset, salt, lengths, positions |
| WI-006 | Write out the three hash functions | lead | app | binary | todo | | each as a one-line recurrence |
| WI-007 | Model the 96-bit slice and the 19 groups | lead | app | binary | todo | | top bit of the last group is always 0 |
| WI-008 | Re-implement in a second language | lead | app | process | todo | | character-by-character diff |
| WI-009 | Reproduce the worked example | lead | app | process | todo | | identity → hashes → 19 characters |
| WI-010 | Accept against the shipped check | lead | app | runtime | todo | | reflective invoke returns true |
| WI-011 | Observe the activation path and persistence | lead | app | runtime | todo | | settings overwritten on exit |
| WI-012 | Check whether the next major version kept the algorithm | lead | app | binary | todo | | re-run, do not re-reverse |

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
- cases/dotnet-license-keygen/docs/algorithm.md
- cases/dotnet-license-keygen/docs/verification.md
