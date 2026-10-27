# Edition mask, hot-patch sites and dialog hook — version-dll-proxy-iat-hook

Teaching values from the archived case: build **7.46 / 71822**, x64, image base `0x140000000`,
image size `0x361000`, file size `0x353570`, Authenticode-signed. Everything below is a derived
address for that build; relocate with the predicates in §7.

## 1. Object map

| Global | Accessor | Size | Meaning | Key field |
|---|---|---|---|---|
| `&unk_14031D790` | `sub_140131030` | `0x138` | runtime version/config object | `+0x00` app id, `+0x24` locale flags, `+0x48` title, `+0xC0` version string, **`+0x120` version number (masked)** |
| `&n2` | `sub_1400CF570` | — | registration credential struct (initialised `n2=2`) | `+0` app id, `+8` `l`, `+24` `k`, `+32` `h`, `+40` `P`, `+48..63` 16-byte session key, `+64` `m`, `+72` `t` |
| `&qword_14031D930` | `sub_140167890` | `0x6A8` | app config object | `+0xC0` version string (the one written to disk) |
| `&qword_14031D8D0` / `&qword_14031D8E0` | `sub_1401341A0` | — | `data` module handle / authorisation interface pointer | — |

The edition lives at `+0x120` of the first object. That single field is the entitlement.

## 2. Crypto primitives shipped in the binary

| RVA | Function | Role |
|---|---|---|
| `0x2B6D0` | `sub_14002B6D0` | key schedule (18 `P` + 4×256 `S` entries, constant table `unk_1402706C0`) |
| `0x2BB40` | `sub_14002BB40` | encrypt in place (final whitening with `P[16]`, `P[17]`) |
| `0x2BCD0` | `sub_14002BCD0` | decrypt in place (final whitening with `P[0]`, `P[1]`) |
| `0x2E9D0` | `sub_14002E9D0` | hardware id: `\\.\X:` + `IOCTL 0x2D1400` (`SMART_RCV_DRIVE_DATA`) → hash at `sub_140022960`; falls back to `GetVolumeInformationW` |
| `0x2D2B0` | `sub_14002D2B0` | `swscanf(L"%02x")` hex parsing |
| `0xD4B00` / `0xD4BB0` | — | hex string ↔ bytes (length must be 32 / 33) |
| `0xD52E0` | — | codec entry: decrypt 16-byte header → check `hdr[1] == 1 && hdr[2] <= len-16` → decrypt payload → `MultiByteToWideChar(CP_UTF8)` |
| `0xD0D80` | — | second-hive `c/r/u` decode |
| `0xD13A0` | — | reverse encode (encrypt + write back) |

Payload layout (plaintext): `0x00` u32 reserved; `0x04` u32 = `1` (format version, hard-checked);
`0x08` u32 payload length; `0x0C` u32 reserved; `0x10` payload, UTF-8.

## 3. The authorisation chain

`sub_1400D0690` reads `HKLM\SOFTWARE\<app>\l`:

1. `g` (16-byte hex) → decrypt with a key derived from the hardware id → **session key**;
2. `l / k / h / P / m / t` → decrypt with the session key → UTF-8 strings;
3. predicate: all six non-empty, **and `k == L"20"`**.

`sub_1400D0370` performs the same consistency check on the `HKCU` side (`c / r / u`, where `u` is the
4-byte hardware id). Success writes back through `sub_1400CF980` (`l/k/h/P/m/t/g`).
`HKLM\SOFTWARE\<app>\Edition` is written by `sub_1400CF470` and used for record-keeping only.

Dispatch of the decoded edition:

| Consumer | Check | Effect |
|---|---|---|
| `sub_1401320C0` | decoded `== 0x2710` | enterprise features |
| `sub_14015FB90` | decoded `== 100` | standard-edition registration reminder visibility |
| `sub_1400CF470` | — | writes the `Edition` string |

## 4. The mask

```c
plain = ((2 * (v & 0xD5555555)) | ((v >> 1) & 0x55555555)) & 0xFFFFFFFF;
```

| Stored | Decoded | Edition |
|---|---|---|
| `0x98` (152) | `100` | standard |
| `0x3D4` (980) | `1000` | professional |
| `0x1B20` (6944) | `10000` | enterprise |

Verification: `T(152) = 0x64`, `T(980) = 0x3E8`, `T(6944) = 0x2710` — all three agree, which is what
licenses treating the three stores as interchangeable.

## 5. Store sites (`sub_1401316C0`)

All three are complete ten-byte instructions of the same form:

| RVA | bytes | writes |
|---|---|---|
| `0x13176D` | `C7 86 20 01 00 00 D4 03 00 00` | `980` → professional |
| `0x1317CC` | `C7 86 20 01 00 00 20 1B 00 00` | `6944` → enterprise |
| `0x1317F5` | `C7 86 20 01 00 00 98 00 00 00` | `152` → standard |

Patch plans:

| Plan | Sites | bytes | result |
|---|---|---|---|
| **A** (professional) | `0x13175D` `75 36` → `90 90`; `0x13176B` `75 28` → `90 90` | 4 | falls through to `0x13176D` → `1000` |
| **B** (enterprise) | A, plus `0x131773` `D4 03 00 00` → `20 1B 00 00` | 12 | `10000`; the `Edition` string still says professional |
| **C** (server check) | `0x1347E0` `4C 8B DC 49 89 5B 08 …` → `31 C0 C3` | 3 | the blacklist query always reports "not blocked" |

A and B are independent of C.

Why C is written that way: `sub_1401347E0` issues a request to
`<AUTH-SRV>/checkaccesssecureserver` and returns `request_ok && server_says_deny`. The caller does
`test al,al; jnz blocked` — so **`true` means "blocked"**. Returning `false` unconditionally is the
"never blocked" state. Reading the return value as a success flag inverts the whole thing, which is a
classic way to write a patch that blocks more than it should.

## 6. Dialog rewrite

Interception point: the import `user32!SetDlgItemTextW(hDlg, id, lpString)`, called with
`id = 0x527` (`1319` decimal). At that boundary the text is a plain `wchar_t*` — no C++ string ABI,
no template substitution.

Runtime facts measured on the control (they are not derivable from the disassembly):

| Property | Value |
|---|---|
| class | `Edit` (the decompiler's name suggested a static control) |
| style | `GWL_STYLE = 0x50010804` (`ES_MULTILINE` set) |
| size | `585 × 47` |
| text length after rewrite | `52` characters |
| line breaks | two `000D 000A` groups in the UTF-16 dump |
| `EM_GETLINECOUNT` (`0x00BA`) | `3` |

The defect worth remembering: the toolchain dropped `\r` from the wide literal — the compiled bytes
were `62 00 0A 00`, i.e. one line ending, not two. A multi-line `Edit` honours only CRLF, so the text
rendered on a single line. Fix: write the literal as `\u000D\u000A` and normalise at runtime before
handing the string over. Verify with `EM_GETLINECOUNT`, not with a screenshot.

Cross-process verification harness: enumerate top-level windows by process id
(`EnumWindows` + `GetWindowThreadProcessId`), then `EnumChildWindows`; for each child read
`GetDlgCtrlID`, `GetClassNameW`, `GetWindowLongPtr(GWL_STYLE)`, `GetWindowRect`, dump
`WM_GETTEXT` as UTF-16 code units, and ask `EM_GETLINECOUNT`. Menu commands are reachable the same
way: `GetMenu` → `GetMenuItemID` (the about entry was `147`) → `PostMessageW(WM_COMMAND, 147, 0)`.

## 7. Relocating on another build

- **edition field** — the three `mov dword [reg+120h], imm32` instructions with immediates
  `98 / 3D4 / 1B20`; search for the immediate plus the `120h` displacement.
- **mask** — the shift/mask pair `0xD5555555` / `0x55555555` appears in exactly one small function;
  that function is the codec.
- **session key derivation** — the `IOCTL 0x2D1400` constant locates the hardware-id function; its
  caller chain reaches the cipher.
- **blacklist query** — the wide string `/checkaccesssecureserver` and its URL builder.
- **dialog** — the `SetDlgItemTextW` import, plus the numeric control id observed at runtime (do not
  trust the name).

## 8. Hard dependency

`data\lm.<arch>.dll` is mandatory: `sub_1401341A0` → `sub_140134360` builds the path → `LoadLibraryW`
→ `GetProcAddress(h, "lm")` → `pIface = lm(0x20250C18)`. On failure: `MessageBoxW("Error: Failed to
load lm.dll. Code: %u")` then `ExitProcess`. Callers: `sub_140133470`, `sub_1401798A0`,
`sub_140188A50`, `sub_14018E130`.

Any experiment that renames or shadows that file, or changes the working directory, ends at the
message box.

## 9. Guard rails observed in the delivery

- patches applied in `DllMain` on `DLL_PROCESS_ATTACH`, after capturing the main module base;
- a watchdog re-checks the code section shortly after (+500 ms) to catch a second writer;
- each site logs its own result: `[SUCCESS] … @ 0x1317F5 (10 bytes written)`, and a summary line
  `=== Patch summary: 3/3 sites succeeded ===`;
- the ini (`ctrl_id`, replacement text, escapes) is optional; absence is logged and the built-in
  default is used.

## 10. Limits

- The `Edition` registry string is not updated by plan B; a consumer that trusts it instead of the
  masked field would disagree with the UI.
- The blacklist endpoint was never exercised in this work; plan C is derived from the decompiled
  predicate, and its reachability against a live service is `[unverified]`.
- Whether the product integrity-checks its own code section after start-up was not established; the
  watchdog only confirms *our* writes survive.
