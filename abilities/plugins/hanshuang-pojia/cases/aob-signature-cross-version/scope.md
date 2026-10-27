# Case Scope — aob-signature-cross-version (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`: reproducing this shape
means modifying a copy of a signed commercial binary, so authorisation has to be recorded first.
Copy this directory into `work/<case>/`, or re-run `init_task`, and fill `## auth` and
`## in_scope` there.

## meta
- case_id: aob-signature-cross-version
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: several builds of one binary; re-derive every site from meaning + multi-build signatures; never from remembered offsets
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
- activities: [dos, phishing_real_users, unrestricted_exfil, redistribution_of_patched_binaries]

## network_profile
- mode: offline
- offline_sample: (none)
- notes: |
    offline | lab_only | authorized_target_only | unrestricted_lab
    The work is purely local file transformation. Staying `offline` is correct unless the target
    performs a remote check that must be observed; then use `authorized_target_only` with the
    endpoint declared in `in_scope.assets`.
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (version matrix, signature table, byte-whitelist diff, produced hashes)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Work only on copies; keep the original bytes and hash them before and after
  - Never redistribute a patched binary
  - Never copy a checksum or truncation length from memory — recompute from the file

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
  - the set of builds to support must be declared before signatures are generated

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- cases/aob-signature-cross-version/docs/signatures.md
