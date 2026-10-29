# Case Scope — android-ssl-pin-bypass (precedent)

A worked precedent, not a declaration about your target. What follows is the shape of the job
and what a finish looks like; the assets, the sample path and the network profile belong to the
case you open. Copy this directory into `work/<case>/`, or run `init_task` with a preset and a
`sample`, then fill `## in_scope` in your own copy.

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
    Change mode when the engagement actually calls for it.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - reports/<case>_security_assessment_report.md
  - exports/ (hook scripts, baseline and instrumented logs, decrypted sample)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Interception only against the in-scope app and its own endpoints
  - Third-party traffic is out of scope even when it flows through the same device

## ops_refs
- kb/field_journal_seed-008_apk-okhttp-ssl-pin-bypass.md
- agent/skills/apkseep/references/dynamic-frida.md
- docs/contract/case-library.md
