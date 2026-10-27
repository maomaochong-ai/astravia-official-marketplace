# Case Scope — java-agent-dll-hijack (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`. Both routes in this package modify a
running commercial application, and the loader route requires write access to its installation directory —
record authorisation first, then copy this directory into `work/<case>/` or re-run `init_task` and fill
`## auth` / `## in_scope` there.

## meta
- case_id: java-agent-dll-hijack
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: JVM client; entitlement is a local null check; reachable via -javaagent or via a hijacked native import
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
    Both routes are demonstrable fully offline: the paid code ships inside the jar and the JVM is bundled, so
    no vendor service is needed to reach the gate or to load the agent. Anything that exercises the vendor's
    own cloud features (AI endpoints, collaborator domains, commercial extension downloads) moves the case to
    `authorized_target_only` with that host listed.
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: true
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (decompiled gate class, agent source, import table, runtime log, hashes)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Do not redistribute the product's jar, JRE or launcher; keep them out of the case exports
  - The agent, the proxy DLL and any built jar stay inside the case directory, never in the install directory
  - If the loader route is used, restore the install directory to its pre-test file list and prove it by hash
  - Do not enable a real paid backend or transmit real credentials through the injected path

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
  - install-directory write access not yet established as permitted

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
