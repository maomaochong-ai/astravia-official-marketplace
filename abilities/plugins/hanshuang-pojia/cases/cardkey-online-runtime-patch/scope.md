# Case Scope — cardkey-online-runtime-patch (precedent)

A worked precedent, not a declaration about your target. What follows is the shape of the job
and what a finish looks like; the assets, the sample path and the network profile belong to the
case you open. Copy this directory into `work/<case>/`, or run `init_task` with a preset and a
`sample`, then fill `## in_scope` in your own copy.

## meta
- case_id: cardkey-online-runtime-patch
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: packed image, online card key, local verdict; prove the decision site and keep the file byte-identical
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
    This package captures traffic from a live authorisation service. Staying in `offline`
    means replaying against a supplied copy or a lab stand-in; reaching the real endpoint
    requires `authorized_target_only` and an endpoint in `in_scope.assets`.
    Change mode when the engagement actually calls for it.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - reports/<case>_security_assessment_report.md
  - exports/ (loader facts, protocol capture, patch table, control matrix)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Never purchase a card key, never use a real payment instrument
  - Keep the original image byte-identical; patches live in process memory only
  - Replayed or crafted responses are produced only against a lab endpoint in scope

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
