# Case Scope — rsa-blob-machine-code-keygen (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`: the case exercises a real
activate/verify path, so authorisation has to be recorded before any activation data is produced or
written. Copy this directory into `work/<case>/`, or re-run `init_task`, and fill `## auth` and
`## in_scope` there.

## meta
- case_id: rsa-blob-machine-code-keygen
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: signature blob plus machine-derived request string; size the modulus before attempting a keygen
- preset: offline-sample

## auth
- status: pending
- basis: (not provided)
- evidence_of_auth: (not provided)
- MUST NOT proceed if status != granted

## in_scope
- assets:
  []
- surfaces: []
- activities: []

## out_of_scope
- assets:
  []
- activities: [dos, phishing_real_users, unrestricted_exfil]

## network_profile
- mode: offline
- offline_sample: (none)
- notes: |
    offline | lab_only | authorized_target_only | unrestricted_lab
    Everything captured here happens on the local filesystem: registry state, a component DLL and
    its ordinal export. The product also has an online activation path which is **not** in scope
    for this package. Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (blob layout, request string reproduction, factor log, patched export call)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Do not attempt the vendor's online activation service
  - Keep the original component DLL and the patched copy side by side, hashes recorded
  - Registry export/import is the only sanctioned way to observe and restore state
  - Never ship a producer that writes activation data into a machine you do not own

## signoff
- ready_for_act: false
- checklist:
  - [ ] auth.status = granted
  - [ ] in_scope.assets non-empty OR offline sample path set
  - [ ] registry snapshot taken before any write
  - [ ] rollback procedure (restore DLL + registry) written down
  - [ ] factor-search budget agreed (time, not just "try it")
- blockers:
  - authorisation not recorded (auth_status=pending)
  - no in-scope assets declared
  - offline profile needs an explicit sample
  - no registry snapshot yet

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
