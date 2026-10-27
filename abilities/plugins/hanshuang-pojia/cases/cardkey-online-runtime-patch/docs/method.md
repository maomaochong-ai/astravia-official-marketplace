# Method — auditing an online card-key gate inside a packed image

No addresses, keys or sample hashes below: those belong to the target. What follows is the order
that keeps the conclusion true when the image is packed and the licence is decided by a remote
service.

## 1. Decide whether you have to unpack at all

Packing is anti-reading, not anti-runtime. Four observations settle the route before any time is
spent on a dump:

- `DllCharacteristics` — is `DYNAMIC_BASE` set? Without ASLR the image loads at its preferred
  base and addresses are stable across runs.
- section rights — does the code section end up `RWX`, or does something still allow
  `VirtualProtect(PAGE_EXECUTE_READWRITE)`?
- integrity — does anything read its own bytes, checksum a section, or verify a signature over
  the code?
- entropy per block — confirms the section is ciphertext on disk and only exists after load.

No ASLR, writable code, no self-check → the file stays byte-identical and the audit becomes a
runtime-patching review. Anything else → treat it as an unpacking target instead
(`elf-packed-loader` covers the ELF side of that route).

Record these as facts, with the command and output that produced them. "It looked packed" is not
a finding, and neither is "we assumed ASLR was off".

## 2. Watch the wire before reading the graph

An authorisation service is easier to observe than a flattened control-flow graph. Hook
`connect`, `send` and `recv` and run one real login with a deliberately invalid key:

- which host and port, encrypted or plaintext;
- request framing — command number, payload length, whether the payload is high entropy;
- response framing — magic bytes, declared total length, and whether the payload is ciphertext.

Two conclusions come out of this: the protocol shape, and whether the client is capable of
deciding anything at all. If the failure text is nowhere in the local image in any encoding, the
client renders server text verbatim — worth stating explicitly, because it means the client
trusts the response and the decision in front of it is a bare boolean.

## 3. Pivot from the receive hook into the business logic

Reading a 3 MB decrypted section linearly is the slowest possible path. Inside a `recv` hook,
`this.returnAddress` is the instruction that called it: that address sits in the receive wrapper,
and two frames up is the handler that built the request. From there, one more frame up is
usually the UI event handler.

Write the chain down as addresses, then read only those functions. Each hop should be justified
by a call, not by proximity.

## 4. Read the decision, not the call

The call to the authorisation wrapper returns a value; the branch immediately after it decides
what happens. That branch is the finding — one compare and one conditional jump.

Read the success branch too, because it reveals what else the login must satisfy: a global
"authorised" flag, a post-login recheck, then window creation. Every one of those is a place the
gate can close again after you pass it.

## 5. Assume a second decision exists

Card-key clients recheck. Heartbeat or revalidation functions compare a fresh status against a
threshold and, on failure, either revoke the UI or exit the process. Find them before patching:
search for the same request helper being called again, and read the branches around it.

A patch that fixes only the login passes the window and then loses to the heartbeat — usually
within seconds, sometimes minutes, and the delayed failure is easy to misattribute to the patch.

## 6. Prove the minimal set with a control matrix

Never record the first patch that appears to work. The variants that fail are the ones that teach
the rule; [patches.md](patches.md) has the matrix and the three failure modes. The expected
outcome is the smallest set of conditional-jump changes, each proven by a pair of runs with the
same input.

## 7. Verify, then state the limits

The proof has four parts: read-back of each patched site, a run with an invalid key that reaches
the gated feature, a timed run long enough to outlast the recheck, and a hash of the on-disk
image showing it never changed.

Then say what was **not** established — for example that the response decryption was observed but
not reversed, or that forging a server response was judged possible but not attempted. Unverified
claims are the part of the report that gets read hardest.

## 8. Report shape

Service-side authority first: what the server should have signed, and what the client should
never have decided. Then the transport (plaintext or unpinned), then storage (keys or credentials
on disk in clear), then the shell that turned "packed" into "protected-looking" while leaving the
process open to rewriting.

Each recommendation should name the layer it lives in, so the vendor can schedule it: protocol
and signing, transport, client hardening, at-rest data, build hygiene.
