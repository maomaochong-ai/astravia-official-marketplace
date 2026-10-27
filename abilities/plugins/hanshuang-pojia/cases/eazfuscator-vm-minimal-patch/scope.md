# Case Scope — eazfuscator-vm-minimal-patch (precedent)

This is a **template**, not a declaration. `auth.status` stays `pending`. The work includes modifying and
executing a commercial application, so record authorisation first, then copy this directory into
`work/<case>/` or re-run `init_task` and fill `## auth` / `## in_scope` there.

## meta
- case_id: eazfuscator-vm-minimal-patch
- created: (not provided)
- operator: local
- project_root: (cwd)
- primary_skill: (set when the case starts acting)
- primary_id: (not provided)
- lead_role: lead
- specialist_roles: []
- hint: full obfuscation stack; entitlement is a managed predicate plus a few flag writes; patch via decrypt-edit-reencrypt
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
    Everything in this package runs offline: the layers are static, the string dump is a local reflection call,
    and the profiles are file writes. Two findings touch the wire — a plaintext auth endpoint and a bundled
    symmetric key — and confirming them requires `authorized_target_only` with that host in `in_scope.assets`.
    Never point those checks at a live account.
    Change mode only after auth.status = granted.

## deliverables
- report: true
- field_journal: true
- diagrams: true
- timeline: true
- planned:
  - report/<case>_security_assessment_report.md
  - exports/ (layer table, decrypted IL of the gate, patch table, three profiles, hashes)
  - evidence/E-###-<slug>.md

## constraints
- timebox: (not provided)
- stealth: low
- data_handling: anonymize
- rules:
  - Never distribute the protected assembly, the deobfuscated dump or the tool binary outside the case
  - Always patch from the pristine sample; never patch an already-patched build
  - Validate every site's original bytes before writing, and keep the inverse script with the patch script
  - Do not decrypt or retain user data produced by the application; the cipher work is verified on test vectors

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
  - live-endpoint confirmation not authorised

## ops_refs
- kb/field_journal_precedent-auth.md
- kb/field_journal_precedent-reverse.md
- docs/contract/case-library.md
