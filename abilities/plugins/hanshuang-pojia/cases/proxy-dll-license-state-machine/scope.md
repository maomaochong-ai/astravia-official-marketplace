# Case Scope — proxy-dll-license-state-machine (precedent)

A worked precedent, not a declaration about your target. What follows is the shape of the job
and what a finish looks like; the assets, the sample path and the network profile belong to the
case you open. Copy this directory into `work/<case>/`, or run `init_task` with a preset and a
`sample`, then fill `## in_scope` in your own copy.

## meta
- case_id: proxy-dll-license-state-machine
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: no network stack, several globals that look authoritative, one 16-bit state word written at startup
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
- activities: [redistribution, patched_binary_shipment, dos]

## network_profile
- mode: offline
- offline_sample: (none)
- notes: |
    offline | lab_only | authorized_target_only | unrestricted_lab
    This target has no network capability at all (its import table has no socket or HTTP API),
    so `offline` is the correct profile and a supplied copy is enough. Switching to
    `authorized_target_only` buys nothing here and only widens the scope.
    Change mode when the engagement actually calls for it.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - reports/<case>_security_assessment_report.md
  - exports/ (global map, writer block, patch table, scenario matrix)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Never ship the patched image or the proxy DLL outside the lab
  - Prefer memory-only changes; keep the vendor signature valid
  - Edit UTF-16 configuration files line by line, never with a cross-line pattern

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
