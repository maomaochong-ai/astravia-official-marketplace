# Case Scope — ed25519-offline-keygen (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`: producing activation
codes requires authorisation over the client, and the case must record it before the first code is
generated. Copy this directory into `work/<case>/`, or re-run `init_task`, and fill `## auth` and
`## in_scope` there.

## meta
- case_id: ed25519-offline-keygen
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: offline code verified locally against an embedded key; the key is data, so replace it instead of forging
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
    The route captured here never leaves the machine: no server call, no relay. `offline` is the
    default and is sufficient. Reaching the vendor's activation endpoint requires the mode above
    plus an endpoint in `in_scope.assets`. Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (container layout, key stream derivation, patched offsets, end-to-end log)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Never publish a recovered vendor key, key stream or private key material
  - Generated codes are for the authorised test machine only
  - Keep the vendor's binary and your patched copy side by side, hashes recorded
  - Do not upload artefacts to third-party scanners without permission

## signoff
- ready_for_act: false
- checklist:
  - [ ] auth.status = granted
  - [ ] in_scope.assets non-empty OR offline sample path set
  - [ ] out_of_scope reviewed
  - [ ] key material handling agreed (where it may be stored)
  - [ ] rollback / restore of the patched binary documented
- blockers:
  - authorisation not recorded (auth_status=pending)
  - no in-scope assets declared
  - offline profile needs an explicit sample
  - key material storage not agreed

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
