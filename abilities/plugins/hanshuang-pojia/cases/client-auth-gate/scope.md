# Case Scope — client-auth-gate (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`: an entitlement review
needs the operator's own authorisation recorded before any branch is exercised. Copy this
directory into `work/<case>/`, or re-run `init_task`, and fill `## auth` and `## in_scope` there.

## meta
- case_id: client-auth-gate
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: paid capability decided client-side; prove the branch and check the server
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
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (branch disassembly, hook script, before/after runs)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - No purchase, no real payment instrument, no production account
  - Any live endpoint is probed read-only and only inside the recorded scope

## signoff
- ready_for_act: false
- checklist:
  - [ ] auth.status = granted
  - [ ] in_scope.assets non-empty OR offline sample path set
  - [ ] network_profile.mode chosen
  - [ ] out_of_scope reviewed
  - [ ] roles assigned
- blockers:
  - authorisation not recorded (auth_status=pending)
  - no in-scope assets declared
  - offline profile needs an explicit sample

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
