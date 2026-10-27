# Case Scope — version-dll-proxy-iat-hook (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`: the delivery writes into
the product's own program directory, and the product is Authenticode-signed — the authorisation has
to cover both the copy and the fact that a signed binary is being loaded alongside.

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
- MUST NOT proceed if status != granted

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
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: true
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
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
  - the blacklist path must not be exercised without a declared host

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
