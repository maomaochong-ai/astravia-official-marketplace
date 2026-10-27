# Work Items — js-sign-chain (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | network profile is part of this |
| WI-002 | Capture one working request as the oracle | lead | endpoint | web | todo | | secrets redacted |
| WI-003 | Locate the signer in the bundle | lead | bundle | web | todo | | header name -> function |
| WI-004 | Log the signer's real inputs and output | lead | page | runtime | todo | | hook or breakpoint |
| WI-005 | Reproduce the signature locally, byte-exact | lead | script | web | todo | | same inputs, same output |
| WI-006 | Vary one input and read the server's answer | lead | endpoint | web | todo | | rate-limited, one variation |

## Coverage
- [ ] Recon/analysis complete for in-scope assets
- [ ] Critical/High candidates triaged (or N/A for pure RE)
- [ ] Validated findings have Evidence (E-*)
- [ ] Path documented (attack/call/solve)
- [ ] Timeline continuous across major phases
- [ ] Report written under report/
- [ ] field-journal entry anonymized

## Refs
- kb/field_journal_seed-004_js-sign-webpack.md
- kb/js_reverse_SKILL.md
- docs/contract/case-library.md
