# Case Scope — android-ssl-pin-bypass (precedent)

This is a **template**, not a declaration. Pinning work is the one place where an unrecorded
authorisation can become an interception of someone else's traffic, so `auth.status` stays
`pending` here and the network profile stays `offline` until you fill them in your own copy.

## meta
- case_id: android-ssl-pin-bypass
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: determine what the app pins and what that leaves unprotected
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
  - exports/ (hook scripts, baseline and instrumented logs, decrypted sample)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Interception only against the in-scope app and its own endpoints
  - Third-party traffic is out of scope even when it flows through the same device

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
- kb/field_journal_seed-008_apk-okhttp-ssl-pin-bypass.md
- agent/skills/apkseep/references/dynamic-frida.md
- docs/contract/case-library.md
