# Case Scope — qt-proxy-dll-gateway (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`. Replacing an imported library
means the target application is on disk and will be launched under instrumentation; record authorisation
first, then copy this directory into `work/<case>/` or re-run `init_task` and fill `## auth` / `## in_scope`
there.

## meta
- case_id: qt-proxy-dll-gateway
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: host imports the whole auth surface by name — forwarder proxy, constant-folded predicates, endpoint rewrite, local gateway
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
    Two of the three capabilities can be shown fully offline (predicate folding, endpoint rewrite against a
    local gateway). Anything that needs the vendor's live service — account paths, sync, quota — requires
    `authorized_target_only` with that host listed in `in_scope.assets`, and the gateway's pass-through must
    then be restricted to those hosts.
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: true
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (import inventory, patch table, endpoint sites, gateway transcript, revert proof)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Official binaries stay byte-identical on disk for the whole engagement; verify by hash at start and end
  - Keep the proxy build and the local gateway inside the case directory, never next to the installed app
  - Do not configure a real paid backend key into the gateway; use a local model or an explicit test key
  - Remove every injected artefact at the end and prove the official hashes are restored

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
  - gateway pass-through targets undecided while mode = offline

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
