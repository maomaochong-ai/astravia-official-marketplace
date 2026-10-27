# Case Scope — execryptor-vm-activation (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`: the target contacts a
remote authorisation service, so authorisation has to be recorded before any attempt is made.
Copy this directory into `work/<case>/`, or re-run `init_task`, and fill `## auth` and
`## in_scope` there.

## meta
- case_id: execryptor-vm-activation
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: virtualised verifier; the observable surface is the IPC channel and the single status comparison in the readable half
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
- activities: [dos, phishing_real_users, unrestricted_exfil, service_side_attacks]

## network_profile
- mode: offline
- offline_sample: (none)
- notes: |
    offline | lab_only | authorized_target_only | unrestricted_lab
    The verdict patch needs no network. The authorisation service still answers if the program is
    allowed to reach it, so keep `offline` and block it at the host level while observing; moving
    to `authorized_target_only` requires the endpoint in `in_scope.assets`.
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: true
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (import surface, call chain, channel map, patch table, side-effect matrix)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Never use a real purchased key; invalid input only
  - Patch a copy; keep the original hash before and after
  - Do not attempt to attack or reverse the remote service
  - Do not redistribute a patched binary

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
  - the remote authorisation endpoint must never be in scope

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- cases/execryptor-vm-activation/docs/ipc.md
