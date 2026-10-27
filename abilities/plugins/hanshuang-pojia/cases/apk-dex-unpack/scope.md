# Case Scope — apk-dex-unpack (precedent)

This is a **template**, not a declaration. `auth.status` is `pending` on purpose: whether you
may analyse an installed application is the operator's answer, not the package's. Copy this
directory to `work/<case>/` or re-run `init_task` with `preset=offline-sample` and `sample`,
then fill `## auth` and `## in_scope` in your own copy.

## meta
- case_id: apk-dex-unpack
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: packed Android application; recover class sources before judging behaviour
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
  - exports/frida-dump/ (dumped DEX files with hashes)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Dynamic work only on a device you own or are authorised to instrument
  - The installed package is never modified

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
- kb/field_journal_2026-07-14_android-arm64-self-extract-source-recovery.md
- agent/skills/apkseep/references/advanced-unpacking.md
- docs/contract/case-library.md
