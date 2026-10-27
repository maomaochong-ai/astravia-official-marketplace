# Point table, naked proxy and deployment — multiprocess-proxy-hotpatch

Teaching values from the archived case: suite build **v6.8.1**, x64, four executables, image bases
as usual for MSVC x64. Every number below is a *derived address* for that build. On another build,
re-derive with the predicates in §5 instead of reusing them.

## 1. Process inventory and point budget

| Executable | Role | Points | Notes |
|---|---|---|---|
| `NxMain.exe` | UI shell (Qt) | 30 | ad removal, trial banner flow, response deserialisation, member checks |
| `NxService.exe` | background daemon | 18 | parse/serialise, validity checks, endpoint localisation |
| `RemoteService.exe` | remote / push service | 4 | session-type gate, streaming shutdown |
| `NxUpdater.exe` | updater | 0 | delivery only: it loads the same proxy module |

Total **52** points, byte-verified 52/52 with `mismatch = 0`; end-to-end `APPLIED 30/18/4`.

Delivery: `winhttp.dll` placed beside each executable. All four statically import it, so no rename
and no `_orig` copy is needed — including for the updater, which is what makes the update channel
part of the picture rather than an omission.

## 2. Point table shape

Columns, as recorded per site:

`host_exe, proxy_dll, id, section, file_off, rva, va, orig_len, patch_len, orig_bytes, patch_bytes, semantic, verify`

Excerpt (Main):

| id | RVA | original | patched | effect |
|---|---|---|---|---|
| `nxmain_ad_gate_member_remove_ad_ok_bypass` | `0x12B9A3` | `0f 84 b9 01 00 00` | `90 90 90 90 90 90` | conditional jump to the non-member branch → NOPs, signal still fires |
| `nxmain_skip_trial_banner_flow` | `0xCF01DF` | `0f 8e ed 00 00 00` | `e9 ee 00 00 00 90` | `jle` → `jmp`, trial prompt flow skipped |
| `nxmain_resp_expiry_2099_12_31` | `0xD19C7A` | `e8 28 42 31 ff` | `b8 7f e6 85 f4` | field extraction call → immediate `0xF485E67F` (2099-12-31 16:08 UTC) |
| `nxmain_resp_member_status_enabled` | `0xD19D0E` | `e8 8e 9f 2e ff` | `b8 01 00 00 00` | → `1` |
| `nxmain_resp_member_type_vip` | `0xD19D9A` | `e8 02 9f 2e ff` | `b8 01 00 00 00` | → `1` |
| `nxmain_resp_device_count_5` | `0xD19E25` | `e8 77 9e 2e ff` | `b8 05 00 00 00` | → `5` |
| `nxmain_resp_trial_status_used` | `0xD19FD4` | `e8 c8 9c 2e ff` | `b8 02 00 00 00` | → `2` |
| `nxmain_resp_privilege_enable` | `0xD1A2C6` | `e8 d6 99 2e ff` | `b8 01 00 00 00` | → `1` |
| `nxmain_parse_a_device_member_enabled` | `0x1086BBE` | `e8 de d0 f7 fe` | `b8 01 00 00 00` | parse path → `1` |
| `nxmain_parse_a_expiry_2099_12_31` | `0x1086D38` | same shape | `b8 7f e6 85 f4` | parse path expiry |
| `nxmain_ui_member_check_direct` | `0xB50D80` | 22-byte site | 3 bytes changed | UI check, partial overwrite |
| `nxmain_ui_member_check_direct_b` | `0xB52810` | 25-byte site | 3 bytes changed | second UI check |

Two shapes recur: **branch neutralisation** (`jcc` → `nop…` or `jmp`) and **call → immediate** (the
call that extracted a field becomes a `mov eax, imm32`). The second only works where the callee
returns a plain scalar; verify the calling convention before using it.

## 3. The delivery: naked stubs

The bridge is written as naked functions — no prologue, no register save, no stack adjustment:

```rust
#[unsafe(naked)]
unsafe extern "C" fn WinHttpOpen(/* … */) {
    naked_asm!("mov rax, [rip + WINHTTP_OPEN_SLOT]", "jmp rax")
}
```

92 exported APIs are bridged this way, each to a slot resolved once from the real system module.
Why it matters:

- **calling convention is preserved exactly** — relevant for APIs taking varargs or returning
  aggregates by hidden pointer, where a C trampoline would need per-signature work;
- **no per-call allocation or bookkeeping** — a jump, not a wrapper;
- **one file** — the host's static import does the rest.

The export list is generated from the original module's export table (`169` forwarders in one
generator run, `17` in another). Generated, not typed: a missing forwarder is a crash in the field,
not a test failure.

## 4. Four log states

| State | Meaning | Why it must be distinct |
|---|---|---|
| `APPLIED` | compared, matched, wrote | the only success |
| `ALREADY` | bytes already equal the patch | second load in the same process; not an error |
| `OUTOFRANGE` | RVA outside this image | a host that is not a target (a shell, a helper) |
| `MISMATCH` | bytes differ from expectation | version drift; **nothing written** |
| `SKIPPED` | host not covered by this proxy | e.g. `host 'powershell.exe' not covered -> no modification` |

A log that only says "done" cannot distinguish a rebuild from a no-op, which is exactly the failure
this shape is prone to.

## 5. Cross-version drift: what translated and what did not

| Module | Behaviour across builds | Conclusion |
|---|---|---|
| `NxMain.exe` | section shift constant per region: `+0xcf00`, `+0xadc0`, `+0x1320`, `+0x9530` | addresses **inside one compilation unit** translate by a fixed delta |
| `NxService.exe` | shift not constant | translation produces plausible wrong addresses — forbidden |
| `RemoteService.exe` | image grew ~3.66× | no translation at all; re-locate from scratch |

The earlier generation's list had 53 semantic points; in the new build those had **0/53 byte hits**.
Point counts also changed: 61 → 52, with 45 relabelled, 5 merged into 6, one method upgraded, two
equivalently replaced, two added, four deleted. A patch table ages badly; treat it as facts about
one image.

Where a constant shift does not exist, use **build-independent signatures**:

- **call-spacing fingerprints** (daemon): the distances between five consecutive calls —
  `+0x15a / +0x63 / +0xc2 / +0x77` and `+0x88 / +0x53 / +0x1a1 / +0xe7` — survived recompilation
  where absolute addresses did not;
- **struct field offsets**: `0x2c8 / 0x2d4 / 0x2d8 / 0x300 / 0x308` and
  `0x378 / 0x384 / 0x388 / 0x3b0 / 0x3b4` appear in access patterns around the entitlement fields;
- **string anchors**: `member_remove_ad_ok`, `device_member_status`, `member_trail_status`,
  `v1/member/trial`, and the UTF-16 names of the push helpers.

Anchor on what the source says, not on where the linker put it.

## 6. Deployment and write scope

Written:

- `nx_main\sentry.dll` → renamed `sentry_orig.dll` (legacy layout only)
- `nx_main\version.dll`, `nx_main\version_orig.dll` (legacy layout only)
- `nx_main\winhttp.dll` (current layout: the only new file)
- `nx_main\nx_guard_*.log`
- `backup_proxy_guard\<timestamp>\` (copies of everything replaced)

Not written: the three executables, the registry, the system directory, the service configuration.
Restore script: `deploy\Restore-ProxyDll.ps1`. Run it once in the lab and keep the output.

Deployment checklist after copying: `certutil -hashfile` on each executable (unchanged),
`Get-AuthenticodeSignature` = `Valid`, then start the UI and confirm the log reports the expected
point count for that host (`points=30` for the UI, `points=18` for the daemon).

## 7. Risk register (abridged)

| # | Risk | Mitigation |
|---|---|---|
| R1 | a new build invalidates points | compare-before-write; `MISMATCH` writes nothing |
| R2 | the product self-checks its code | none found in this build; check before assuming |
| R3 | the server remains authoritative | not attacked here — server-side truth was out of reach |
| R4 | low-confidence optional points | a flag disables the two optional sites |
| R5 | one remote-service site is medium confidence | keep it out of the default set until reproduced |
| R6 | a hard-coded expiry epoch may disagree with a millisecond-scale UI | verify the rendered date, not just the constant |
| R7 | the proxy is loaded by an unintended host | `SKIPPED` path logs and exits without writing |
| R8 | a resident daemon keeps the old image | restart services, then re-check the log |
| R9 | AV flags a module that shadows a system DLL | expected; document it, do not "fix" it by renaming |

## 8. Limits

- The 52 points are the set that was *found*; nothing here proves the suite has no further
  decision sites in lazily loaded code.
- The call-spacing fingerprints were validated on two builds only.
- The updater behaviour (blocking the handshake) is a design decision recorded in the case, not a
  general recommendation: silently breaking updates has its own risk profile.
