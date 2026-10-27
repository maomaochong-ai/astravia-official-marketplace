# Case Scope — multiprocess-proxy-hotpatch (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`: this shape writes into a
real installation directory, so the authorisation must exist on paper *before* the first copy, and
the write scope must be agreed with whoever owns the machine.

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
- MUST NOT proceed if status != granted

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
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: true
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
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
  - write scope (install directory) not yet agreed with the owner

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
