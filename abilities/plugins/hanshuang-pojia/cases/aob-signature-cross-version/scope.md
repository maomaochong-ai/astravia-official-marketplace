# Case Scope — aob-signature-cross-version (precedent)

A worked precedent, not a declaration about your target. What follows is the shape of the job
and what a finish looks like; the assets, the sample path and the network profile belong to the
case you open. Copy this directory into `work/<case>/`, or run `init_task` with a preset and a
`sample`, then fill `## in_scope` in your own copy.

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
    Change mode when the engagement actually calls for it.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - reports/<case>_security_assessment_report.md
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

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- cases/aob-signature-cross-version/docs/signatures.md
