# Work Items — android-ssl-pin-bypass (precedent)

Status is one of `todo` / `in_progress` / `done` / `dropped`. The evidence column takes an
`E-###` id.

| ID | title | role | targets | surface | status | evidence | notes |
|----|-------|------|---------|---------|--------|----------|-------|
| WI-001 | Establish scope and auth | lead | case | process | in_progress | | interception is in scope only for the app |
| WI-002 | Enumerate pinning layers statically | lead | apk | android | todo | | config, CertificatePinner, TrustManager |
| WI-003 | Record the baseline refusal | lead | apk | network | todo | | one request, unmodified app |
| WI-004 | Hook the layer that actually throws | lead | apk | runtime | todo | | backtrace per layer |
| WI-005 | Prove the session decrypts | lead | endpoint | network | todo | | content, not just a 200 |
| WI-006 | State what pinning does and does not protect | lead | report | process | todo | | residual risk, not "bypassed" |

## Coverage
- [ ] Recon/analysis complete for in-scope assets
- [ ] Critical/High candidates triaged (or N/A for pure RE)
- [ ] Validated findings have Evidence (E-*)
- [ ] Path documented (attack/call/solve)
- [ ] Timeline continuous across major phases
- [ ] Report written under report/
- [ ] field-journal entry anonymized

## Refs
- kb/field_journal_seed-008_apk-okhttp-ssl-pin-bypass.md
- agent/skills/apkseep/references/dynamic-frida.md
- docs/contract/case-library.md
