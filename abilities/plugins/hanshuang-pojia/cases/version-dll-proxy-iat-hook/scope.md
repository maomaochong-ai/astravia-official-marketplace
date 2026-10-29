# Case Scope — version-dll-proxy-iat-hook (precedent)

A worked precedent, not a declaration about your target. What follows is the shape of the job
and what a finish looks like; the assets, the sample path and the network profile belong to the
case you open. Copy this directory into `work/<case>/`, or run `init_task` with a preset and a
`sample`, then fill `## in_scope` in your own copy.

## meta
- case_id: version-dll-proxy-iat-hook
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: offline symmetric credential, edition stored as a masked int, loader picks up a same-named module from its own directory
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
- activities: [binary_redistribution, key_generation_for_third_parties, dos]

## network_profile
- mode: offline
- offline_sample: (none)
- notes: |
    offline | lab_only | authorized_target_only | unrestricted_lab
    One code path queries an authorisation host for a blacklist verdict. In `offline` that path is
    only observed from the decompiled logic, never reached: exercising it against the real service
    needs `authorized_target_only` plus an endpoint in in_scope.assets.
    Change mode when the engagement actually calls for it.

## deliverables
- report: true
- field_journal: true
- diagrams: true
- timeline: true
- planned:
  - reports/<case>_security_assessment_report.md
  - exports/ (crypto primitives, mask table, store sites, dialog read-back dump)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Never modify the signed executable or the product's own data module
  - Preferred edit is a complete instruction (the stores are ten bytes) — no partial overwrites
  - Keep a copy-to-copy diff so rollback is a file delete, and verify the signature afterwards

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
