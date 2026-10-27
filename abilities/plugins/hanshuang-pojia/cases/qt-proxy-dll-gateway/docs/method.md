# Method — choosing a proxy DLL, and keeping the two halves of the story apart

The mistake this package exists to prevent is treating "the client thinks I paid" and "the service runs on
my machine" as one finding. They are two, they fail for different reasons, and the fixes live in different
layers. Work them separately and report them separately.

## 1. Decide the route from the import table

Read what the host executable imports, and from where. Count symbols, and check whether they are imported
by name or by ordinal.

- **By name, and the auth surface is one module** → a forwarder proxy is available. Rename the official
  library, ship your own under the original name, put one forwarder per export into its export table. The
  loader resolves everything transparently; your code is now inside the process, able to patch memory and
  hook functions, while every official byte on disk stays as published.
- **By ordinal, or scattered across the executable** → this route is closed. Consider
  [`native-islicensed-patch`](../native-islicensed-patch/README.md) instead, and say in the report why the
  proxy was not available.

Write the count down. It serves two purposes: it proves coverage (nothing was silently dropped) and it is
the feasibility argument for the whole approach.

## 2. Let the framework name the features

A Qt build keeps enum names as meta-object string data. Extracting them gives the authoritative feature
list before you have understood a single predicate — in the source engagement, 14 `FeatureType` entries
with their official labels. Guessing features from the UI produces a report that misses whatever the UI
does not currently show.

Then separate two numbers that are easy to conflate: **how many predicates decide** (11) and **how many
call sites consult them** (107). The first is your patch set; the second is your blast radius.

## 3. Fold predicates at their entry, nothing more

| returns | bytes | meaning |
|---|---|---|
| `bool` | `B0 01 C3` | `mov al,1; ret` |
| `int` | `B8 01 00 00 00 C3` | `mov eax,1; ret` |
| `bool` false | `32 C0 C3` | `xor al,al; ret` |
| enum / int zero | `31 C0 C3` | `xor eax,eax; ret` |
| disable entirely | `C3` | `ret`, for void functions with side effects worth skipping |

All of these return before the frame is allocated, so there is no stack imbalance to reason about. Prefer
them to mid-function edits: an entry patch has one meaning and one verification.

**Check for identical-code folding before you trust the site count.** MSVC merges functions with identical
bodies, so one address can carry two or three exported symbols. That is a documented property of the build,
not a mystery — write it in the patch table as a note on that row, because it means one patch resolves more
than one predicate and the failure mode (if it were wrong) would also be wider.

## 4. Endpoint rewrite has three parts, not one

A base URL used by a client is rarely just a string:

1. the **string body**, somewhere in `.rdata`;
2. the **length immediate** passed to the string constructor (`mov edx, 0x15` for a 21-character URL);
3. the **`lea` displacement** that points at the string.

Changing only the string gives you a truncated URL or a read past the end. Changing string and length but
not the displacement gives you a pointer to the length bytes. Patch all three, recompute the displacement
against the new address, and log the values you computed.

## 5. The gateway is a protocol adapter, not a mock

A rewrite that answers with a stub proves the pointer changed and nothing else. What makes this capability
worth documenting is that the client's own request format is translated to a configurable backend:

- parse just enough of the client's request to find the text/image payload and the target language;
- select the backend by inspecting the configured URL (request shapes differ: `chat/completions` with
  `choices[0].message.content`; Gemini's `generateContent` with `candidates[0].content.parts[*].text`;
  Anthropic's `/v1/messages` with `content[0].text`);
- translate the reply back into exactly what the client expects, in the client's JSON shape.

And then the part people forget: **forward everything else unchanged**. Account, login, sync and quota
traffic must reach the official host untouched, or the client breaks in ways that look like your patch.
Constraining that pass-through to an explicit host list is also the honest way to keep the exercise inside
its authorised scope.

## 6. Then, separately, deal with remote control

Auto-update and remote-configuration channels are a third capability, and they are the ones that undo your
work: an update replaces the library you replaced. Fold those call sites, but count requests to the vendor
host before and after, so the claim is measured rather than assumed. Note that an update endpoint may live
on its own domain and therefore not pass through the endpoint you rewrote.

## 7. Verify with numbers a reader can check

- import count and call-site count;
- feature enum size, quoted;
- patch table rows, with original bytes;
- one log line proving the client talked to the gateway, with the reply length;
- request count to the vendor host before and after;
- official file hashes before and after the revert, and the absence of residual files.

## 8. Report the two findings separately

**Privilege decision.** Local predicates with no signature and no server check; a single constant at a
function entry releases an entire feature domain. Fix: move the decision to a server-issued short-lived
token, verify a signature on the library before loading it, and stop deciding entitlement from a local
`bool`.

**Compute dependency.** The client's model work depends on an endpoint it assembled from a local constant,
with no pinning, so the provider's billing loop is bypassable independent of any privilege decision. Fix:
pin the endpoint, sign requests with nonce and timestamp, and issue the base URL (with expiry) from the
service rather than embedding it.

A reader who gets only the first finding will harden the predicates and leave the second wide open.
