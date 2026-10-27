# Case Scope — themida-dotnet-delegate-recovery (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`: the target is a commercial
desktop application, so authorisation has to be recorded before the first process is spawned or a single
byte of the protected image is copied. Copy this directory into `work/<case>/`, or re-run `init_task`,
and fill `## auth` and `## in_scope` there.

## meta
- case_id: themida-dotnet-delegate-recovery
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: managed image inside a native packer; hook the JIT the packer already hooked, resolve delegates by reflection, dump what was loaded from bytes
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
    The interesting question in this package — does the client revalidate, and how long does a forged
    state survive — needs traffic. Staying in `offline` means working from a supplied memory image or a
    lab stand-in; reaching the vendor endpoint requires `authorized_target_only` plus that endpoint in
    `in_scope.assets`.
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: false
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (loader facts, hook site, method and delegate counts, rebuilt image path, decision site)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Never persist CLR bootstrap variables (APPDOMAIN_MANAGER_*, COR_PROFILER*); injection is process-level only
  - Keep the on-disk image byte-identical; all work happens on an in-memory copy
  - Remove any injection leftover after the run and verify the user environment block is clean
  - Substitute nothing for the redacted salt; record its length and role, never its value

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
  - revalidation measurement needs a declared endpoint or a documented offline substitute

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
