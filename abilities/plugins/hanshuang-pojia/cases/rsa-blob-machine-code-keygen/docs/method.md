# Method — deciding whether a signature-blob activation can be keygenned

The addresses and byte values are in [algorithm.md](algorithm.md). This file is the order of work
and, more importantly, the criteria for **stopping** the keygen route and reporting it as closed.

## 1. Find the binary that owns the check

Installers lie about where the logic lives. An SFX or 7-Zip self-extractor imports no network and no
crypto API; if you are reading a binary whose import table has neither, you are reading the wrong
one. Unpack, list the components, and pick the one that imports BCrypt/CryptoAPI and reads the
licence registry key. Confirm with the file's own strings and with the module that actually maps
into the process at runtime.

## 2. Locate the public key by structure, not by vocabulary

Strings like "activation" appear in the UI, in error messages and in update code. The public key
does not advertise itself verbally — but its container is self-describing: a header magic, a bit
length, an exponent length, a modulus length. Searching for that byte pattern finds the key in
seconds and tells you the algorithm without any disassembly.

Two questions must be answered from the blob alone:

- what is `e`? (a small odd exponent, almost always `65537`)
- how many bits is `n`? (read the field; do not estimate from a hex dump that a document truncated)

Read the layout carefully: a CNG blob and a CryptoAPI blob with similar-looking headers have
**different field orders**. Getting this wrong shifts every subsequent length and produces a
"modulus" that is really the exponent followed by part of the modulus.

## 3. Reconstruct the signed message

The signature covers a request string the client assembles from machine identifiers. Establish:

- how many identifiers take part, and which (BIOS/SMBIOS strings, volume or disk identifiers,
  product UUID);
- the fallback when an identifier is unavailable (a common source of "works on my machine");
- the digest applied to each, its length, and its case;
- the concatenation order.

Verify by reproducing one string the client computes, byte for byte. If your reproduction differs
by a single hex character, stop and fix it — every later conclusion inherits the error.

A shortcut worth knowing: the client often writes the request string somewhere observable
(a registry value, a log, a request body). Capture it instead of deriving it first, then derive it
and compare. Deriving before capturing is how people spend a day on a field order that was wrong.

## 4. Read the verification as a window scan

The decrypted block is compared at several offsets, not at one. Structurally it is:

```
block = activation_data ^ e mod n            (i.e. the "signature" raised to e)
for offset in [0 .. 0x1b]:
    if block[offset:offset+32] == machine_hash
       and (block[offset+32:offset+96] == constant
            or block[offset+32:offset+64] == hash(identifier_a) and block[offset+64:offset+96] == hash(identifier_b))
       and block[offset+96:offset+102] == magic:
           activated
```

Two consequences. First, "it fails at offset 0" means nothing; several offsets can satisfy the
predicate. Second, the two accepted middle-field shapes mean the producer has two valid layouts —
which is why a producer written for one shape still validates.

The decompiler will present the decrypted buffer as a dozen separate locals. Recognise it as one
buffer before reading any byte range, or you will interpret a slice of one variable as if it were a
whole one.

## 5. Size the modulus before attempting anything

Compute the bit length. Then separate two claims that beginners merge:

| claim | how it is established |
|-------|----------------------|
| the modulus is weak | bit length, plus any small factors found by a cheap scan |
| the modulus is factored | an actual factorisation, with both primes verified |

A 1016-bit modulus with a small factor still leaves a ~1005-bit cofactor. Factoring that is not a
matter of effort tuning; it is out of reach. So the report says "small factor found, cofactor
infeasible", not "weak key, therefore broken".

Give the search a budget in minutes and a method list (trial division to a bound, Pollard rho,
Fermat near-square check). Write down what each returned. A blank page claiming "tried factoring"
is not evidence.

## 6. Decide the route in writing

With the keygen closed, what remains is:

1. reproduce the machine-derived inputs locally (so activation data can be produced for a machine
   you control);
2. patch the verify entry so it reports the activated state;
3. add anti-rollback so an update does not silently revert it.

State this as a decision with its reason, because the alternative reading — "we could not factor
it, so we gave up" — is wrong and will be repeated by whoever reads the report next.

## 7. Prove at the export, not only in the UI

The component exposes the verify routine as an **ordinal**, with no name. That is convenient: call
it directly from a small harness and check the return value plus the status byte it writes. This
proves the patched code path independently of any UI, dialog, or shell state.

Then check persistence properly: restart the shell so the module reloads, and diff the registry
before and after. "Still activated" after a process restart can mean "still in memory"; only a
module reload plus a registry diff distinguishes the two.

## 8. What the "trial clock" teaches

The trial logic derives a timestamp from a registry key whose name is a hash of product and
identifier strings, read as the key's last-write time, with a fixed day count. Two bypasses appear
for free: a clock earlier than that timestamp, and a year at or beyond a fixed horizon, both skip
the expiry branch.

Read this as a design lesson rather than a bug to exploit: a trial clock anchored to a filesystem
timestamp is trivially moved, and a hard-coded year horizon guarantees that the product will one day
declare itself unexpired everywhere.

## 9. Stop conditions

- The modulus has no small factors and is beyond your budget → keygen closed, say so.
- The verify entry is not the only consumer of the activation data (a second check elsewhere reads
  it too) → patching one site will look unstable; find all consumers first.
- The client re-verifies against a server on a schedule → report that the local patch is not
  durable, instead of claiming a durable bypass.

## 10. Report shape

Primary: client-side enforcement of a server-side decision (the marker is that the client both
holds the key and decides). Secondary: the activation data is not bound to the UI path (so a
direct export call is enough), the trial clock is anchored to a movable timestamp, and the key
handling offers no protection beyond obscurity.

Remediation: keep the public key, drop the pretence that its size or storage is a control; make
activation state server-authoritative with short-lived signed tokens; bind activation to a
hardware-rooted identifier and re-validate it; replace the timestamp-anchored trial with a
monotonic, tamper-evident counter. And for the key: 1016 bits is below current guidance — but the
real defect is not the size, it is that the client is the authority.
