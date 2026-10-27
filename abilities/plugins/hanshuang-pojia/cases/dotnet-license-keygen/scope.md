# Case Scope — dotnet-license-keygen (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`: the work ends with a key
that unlocks a paid capability, so authorisation has to be recorded before any of it happens.
Copy this directory into `work/<case>/`, or re-run `init_task`, and fill `## auth` and
`## in_scope` there.

## meta
- case_id: dotnet-license-keygen
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: offline key check; recover the transform, cross-implement it twice, then accept against the real method
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
- activities: [dos, phishing_real_users, unrestricted_exfil, key_distribution]

## network_profile
- mode: offline
- offline_sample: (none)
- notes: |
    offline | lab_only | authorized_target_only | unrestricted_lab
    The whole point of this shape is that no network is involved: the check is local and the
    activation path can complete offline. Keep `offline`.
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (recovered IL, constants, worked example, cross-implementation diff)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Never distribute generated keys; the artefact stays in the case directory
  - Never use a real customer identity string
  - Test only against a copy of the application, and only for the acceptance run
  - Redact the salt and any identity string before publishing notes

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
  - the acceptance run must target a copy, declared in in_scope

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- cases/dotnet-license-keygen/docs/algorithm.md
