# The channel between the program and its virtualised verifier

The names below are the archived case's structures, kept because they are observable artefacts of
the design rather than vendor identity. On your target, re-derive the same three parts; the shapes
recur.

## Three parts

| part | archived name | purpose |
|---|---|---|
| shared memory | `Global\项目EHelper_Memory` | request written by the main program, response written by the runtime |
| event A | `EventSent` | main program signals "request is complete" |
| event B | `EventComplete` | runtime signals "response is ready" |
| mutex | `Local\UTOOL` | serialises access to the buffer |

Size: `0x200B` (8203 bytes) — a fixed 8 KB text buffer plus a small header. A fixed size with text
inside is the signature of a "structured message in shared memory" design, as opposed to a
serialised binary protocol.

`Global\` versus `Local\`: the session-wide namespace lets a helper started in a different session
(installer, elevation) still find the buffer. `Local\` on the mutex keeps it per-session. That
combination alone tells you the design expects the two processes to be started separately.

## Payload shape

Two calls use the channel, and both send structured text:

- the verify request — a document carrying at least a display name and the serial string;
- the status query — same channel, no payload of interest.

The response is also structured text, and its fields are what the main program parses:

| field | meaning |
|---|---|
| `result` | status integer: `0` failure, `2` expired, `3` success |
| `ExpiryMonth` / `ExpiryYear` | expiry, populated on success and on expiry |
| `LicType` | licence type; the main program normalises it to its own canonical value |
| `UserParam` | free-form parameter returned to the caller |

**The payload is plaintext in memory while the signature check inside the runtime is virtualised.**
That asymmetry is the entire reason this route works: the wire between the halves is readable, so
the contract can be established without ever reading the check.

## Observing it

Three ways, in increasing cost:

1. **Names and sizes** — a handle/object enumeration while the program runs shows the section, the
   two events and the mutex, with their sizes. This alone proves the two-process design.
2. **Buffer reads** — open the section read-only from another process and dump it before and after
   an activation attempt. Timestamps and the two events tell you which write is the request and
   which is the response.
3. **Call-site tracing** — break at the two wrappers in the main program (the verify wrapper and the
   status-query wrapper) and watch arguments and return values. This is how the status comparison is
   confirmed to consume `result` and nothing else.

Order matters: (1) then (2) answers "what is it", (3) answers "who decides". Doing (3) first means
guessing which function is the boundary.

## What the channel does *not* give you

- A way to bypass the runtime. The main program still waits for the response; a missing response
  is a timeout path, not a success path.
- The signature algorithm. The plaintext payload says nothing about how a serial is validated —
  and that check is inside the VM.
- Permission to disable the helper. It performs start-up work; the main program exits if it is
  absent.

## Why this is a finding, not just a curiosity

A design where the security decision is produced inside protected code, then handed to unprotected
code as a bare integer, has moved the cost of circumvention from "break the cryptography" to
"change one comparison in readable code". The protection spend is real; the enforcement boundary is
in the wrong process.

The remediation is structural: the runtime should return a **signed** entitlement (or the main
program should verify a signature over the response), so that an integer cannot be manufactured by
the caller. Until then, the observable channel is also the attack surface.
