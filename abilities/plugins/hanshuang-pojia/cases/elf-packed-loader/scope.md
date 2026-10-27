# Case Scope — elf-packed-loader (precedent)

This is a **template**, not a declaration. `auth.status` is deliberately `pending`: only the
operator opening a real case can record the authorisation for their own sample. Copy the
package into `work/<case>/`, or re-run `init_task` with a preset and `sample`, then fill
`## auth` and `## in_scope` there.

## meta
- case_id: elf-packed-loader
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: packed or protected ELF; recover the real image before analysing it
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
- activities: [dos, phishing_real_users, unrestricted_exfil]

## network_profile
- mode: offline
- offline_sample: (none)
- notes: |
    offline | lab_only | authorized_target_only | unrestricted_lab
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (unpacked image, dump command, string dumps)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Static analysis on copies; unpack only inside a sandbox
  - Name the file every offset belongs to (packed stub vs recovered image)

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

## ops_refs
- kb/field_journal_seed-001_elf-packed-loader.md
- kb/re_pattern_elf-analysis.md
- docs/contract/case-library.md
