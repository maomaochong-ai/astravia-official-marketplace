# Case Scope — native-islicensed-patch (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`: a native patch review
touches a shipped binary, and that has to be authorised before anything is edited. Copy this
directory into `work/<case>/`, or re-run `init_task`, and fill `## auth` and `## in_scope` there.

## meta
- case_id: native-islicensed-patch
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: one bool-returning symbol, no self-check; prove the gate is single before writing the stub
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
    This shape needs no network at all: the decision is a local return value, so `offline` is the
    honest default. The target may still carry a network activation path; observing it requires the
    mode above. Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (symbol table, patch table, branch logs, read-back)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Keep the original binary and its hash; patch a copy, never the only copy
  - Record the rollback steps before applying the patch
  - Do not distribute the patched artefact outside the case
  - Any persistence mechanism added for testing must be removed and documented

## signoff
- ready_for_act: false
- checklist:
  - [ ] auth.status = granted
  - [ ] in_scope.assets non-empty OR offline sample path set
  - [ ] out_of_scope reviewed
  - [ ] original hash recorded before the first write
  - [ ] rollback procedure written down
- blockers:
  - authorisation not recorded (auth_status=pending)
  - no in-scope assets declared
  - offline profile needs an explicit sample
  - rollback not documented

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
