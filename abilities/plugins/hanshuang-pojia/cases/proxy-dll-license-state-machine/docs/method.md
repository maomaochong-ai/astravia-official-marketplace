# Method — auditing a fully local authorisation state machine

No addresses or byte values below: those belong to the target, and the ones worth writing down
live in [state-machine.md](state-machine.md). What follows is the order that produced a correct
answer after several confident wrong ones.

## 1. Establish that the decision is local at all

Read the import table before reading any code. A desktop product with no socket, no HTTP client
and no cryptographic provider import cannot be checking anything remotely; whatever it calls
"authorisation" is arithmetic in its own memory.

That single observation reframes the whole engagement. There is no server to attack, no token to
replay, no pinning to bypass. The finding will be a design finding (the client is the authority)
and the useful deliverable is the shape of the gate plus the hardening that would have to be added
— not a network exploit.

Write the import list into the notes with its count. It is the cheapest evidence in the case and it
bounds every later claim.

## 2. Enumerate every global that plausibly means "licensed"

Hosts written in a visual-BASIC lineage carry several globals that all read like the answer:

- a **level integer** (0 = unregistered, small integers = tiers, the maximum = permanent);
- a **version-coverage flag** (does this entitlement cover the running build);
- a **state word** (a 16-bit value where one constant means "trial" and another means "activated");
- **string pointers** for the licensee name and the key, usually wide strings.

Do not pick one and start patching. Rank them first, and rank them by **reader count**. The one the
UI consults from a dozen places is the one being *displayed*; the one written once inside a short
startup block and read by the feature gates is the one being *decided*. On this target the counts
were roughly 18 readers for the level integer, 33 for the coverage flag, and a single writer for the
state word — and the state word was the gate.

## 3. Read the writer, not the readers

Follow the startup path to the store. The block is short and has a recognisable shape:

1. a call whose return value is either `0` or `-1` (a loader that reports success by returning a
   negative value, as this runtime family does);
2. a bitwise transform of that value — a `not` is the classic, because `not -1` is `0` and `not 0`
   is all-ones;
3. a store of the low 16 bits into the state word.

That transform is the entire gate. Once you can say "the gate is `not` of the loader's return
value", the patch writes itself and, more importantly, the *reason* it works is explainable in one
sentence.

If the block turns out to compare a signature, a checksum or an HMAC instead, stop patching: you
have found a stronger design than the one this package describes, and the honest deliverable is a
note saying the local verdict is at least cryptographically bound, plus whatever remains weak
around it.

## 4. Expect downgrade branches

A state machine of this age usually has **more than one write site**: the normal path, plus
fallbacks that mark the product as trial when something earlier failed — a global "installed"
flag, or registration fields that are empty or too short.

Patching only the primary writer produces a result that looks perfect in one session and reverts in
another, because a different startup branch took the fallback. Enumerate all writers by searching
for the trial constant near the state word's address computation, then patch each with the
non-trial value. Every one of them needs its own trigger condition written down; "we also changed
two other places" is not an explanation.

## 5. Three observers, or it is an opinion

For each scenario, record three independent things:

- the in-process values of every candidate global;
- what the window title says;
- what the "about" panel says.

Then compare across four states: untouched, display-only changes, producer patched, producer plus
fallbacks patched. A scenario table like that is what turns "it looks registered" into a
measurement — and it is what exposed the earlier mistake, where the panel showed a permanent
entitlement while the title still advertised a trial day counter. Both were true at once because
they read different globals.

## 6. Respect the allocator and the clock

If the delivery is a proxy DLL writing into host globals, two rules decide whether it survives:

- **Allocate through the host.** A wide string in this runtime is a COM `BSTR`. Allocating it with
  your own allocator and handing it to the host invites `0xC0000374` when the host frees it with
  its own manager. Call the host's own import slot for the string allocator instead — then the
  pointer's ownership is unambiguous.
- **Write after initialisation.** A write performed during load is often discarded, because the
  host loads its configuration afterwards and overwrites the slot. Wait for the host to finish
  (seconds, not milliseconds), verify it is up, then write.

And bound the retries. A timer that rewrites pointers forever grows the heap until the process dies
with an access violation; a handful of attempts two seconds apart is enough for a host that
initialises once.

## 7. Prove both directions

The strong result is not "the feature opened". It is:

- with the change: state word reads activated, title clean, gated capability usable, stable over a
  timed observation;
- after revert: state word reads trial again, title shows the trial text again, and nothing in the
  configuration directory was left behind.

The revert leg is what distinguishes a memory-only change from a permanent modification, and it is
the leg people skip.

## 8. Close on design, not on bytes

The report's value is in the design conclusion: a single 16-bit word, written by one short block,
read by every feature gate, with no signature and no server, is a client-side authority
(CWE-602). Four bytes move it. Everything else in the report follows from that: bind the verdict to
a signature the client can verify but not mint, derive it at use time rather than caching it, keep
it in read-only memory with a periodic check, and make the entitlement content (tier, seats,
expiry) part of the signed payload instead of parsing it out of the key's text.

The hardening section should name the layer for each item — build/loader, runtime mitigation,
memory integrity, token design, server authority — so the vendor can schedule it rather than
admire it.
