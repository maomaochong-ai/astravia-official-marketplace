# Case Scope — payload-chain (precedent)

A worked precedent, not a declaration about your target. The chain shape is fixed; the offsets,
the sample path and the network profile belong to the case you open. Copy this directory into
`work/<case>/`, or run `init_task` with a preset and a `sample`, then fill `## in_scope`.

## meta
- case_id: payload-chain
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: build the three stages, then fill every placeholder from the sample rather than from memory
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
    An injection chain runs entirely on the machine that owns the sample; it does not need a network.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - reports/<case>_security_assessment_report.md
  - exports/ (generated chain, filled placeholders, baseline and post-patch hashes)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Every patch point recorded as offset / original bytes / patched bytes / rollback
  - "the chain was generated" and "the target accepts it" are separate claims

## ops_refs
- cases/payload-chain/docs/method.md
- docs/contract/case-library.md
