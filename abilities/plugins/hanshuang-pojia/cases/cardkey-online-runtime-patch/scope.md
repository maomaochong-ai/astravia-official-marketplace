# Case Scope — cardkey-online-runtime-patch (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`: an online card-key
review talks to a live authorisation service, so authorisation has to be recorded before a single
byte is patched or a single login is attempted. Copy this directory into `work/<case>/`, or
re-run `init_task`, and fill `## auth` and `## in_scope` there.

## meta
- case_id: cardkey-online-runtime-patch
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: packed image, online card key, local verdict; prove the decision site and keep the file byte-identical
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
    This package captures traffic from a live authorisation service. Staying in `offline`
    means replaying against a supplied copy or a lab stand-in; reaching the real endpoint
    requires `authorized_target_only` and an endpoint in `in_scope.assets`.
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (loader facts, protocol capture, patch table, control matrix)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Never purchase a card key, never use a real payment instrument
  - Keep the original image byte-identical; patches live in process memory only
  - Replayed or crafted responses are produced only against a lab endpoint in scope

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
  - live authorisation endpoint must be declared before any login attempt

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
