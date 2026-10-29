# Case Scope — multiprocess-proxy-hotpatch (precedent)

A worked precedent, not a declaration about your target. What follows is the shape of the job
and what a finish looks like; the assets, the sample path and the network profile belong to the
case you open. Copy this directory into `work/<case>/`, or run `init_task` with a preset and a
`sample`, then fill `## in_scope` in your own copy.

## meta
- case_id: multiprocess-proxy-hotpatch
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: four executables, one shared entitlement decision each, delivery through a module they already import
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
- activities: [binary_redistribution, dos, service_config_tampering]

## network_profile
- mode: offline
- offline_sample: (none)
- notes: |
    offline | lab_only | authorized_target_only | unrestricted_lab
    The patch writer needs no network: it reads and writes memory of local processes. The product's
    own outbound calls (push service, updater) stay out of scope — blocking them is a different
    decision, recorded separately.
    Change mode when the engagement actually calls for it.

## deliverables
- report: true
- field_journal: true
- diagrams: true
- timeline: true
- planned:
  - reports/<case>_security_assessment_report.md
  - exports/ (process inventory, point table, verification log, write-scope diff)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Never modify the target executables; the delivery is a sibling module only
  - Take a timestamped backup of every file the guard will touch, and test rollback once
  - Restart resident services so they load the new image; record it in the timeline

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
