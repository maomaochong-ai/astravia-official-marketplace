# Case Scope — execryptor-vm-activation (precedent)

A worked precedent, not a declaration about your target. What follows is the shape of the job
and what a finish looks like; the assets, the sample path and the network profile belong to the
case you open. Copy this directory into `work/<case>/`, or run `init_task` with a preset and a
`sample`, then fill `## in_scope` in your own copy.

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
    Change mode when the engagement actually calls for it.

## deliverables
- report: true
- field_journal: true
- diagrams: true
- timeline: true
- planned:
  - reports/<case>_security_assessment_report.md
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

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- cases/execryptor-vm-activation/docs/ipc.md
