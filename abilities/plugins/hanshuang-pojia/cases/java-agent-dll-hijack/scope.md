# Case Scope — java-agent-dll-hijack (precedent)

A worked precedent, not a declaration about your target. What follows is the shape of the job
and what a finish looks like; the assets, the sample path and the network profile belong to the
case you open. Copy this directory into `work/<case>/`, or run `init_task` with a preset and a
`sample`, then fill `## in_scope` in your own copy.

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
    Change mode when the engagement actually calls for it.

## deliverables
- report: true
- field_journal: true
- diagrams: true
- timeline: true
- planned:
  - reports/<case>_security_assessment_report.md
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

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
