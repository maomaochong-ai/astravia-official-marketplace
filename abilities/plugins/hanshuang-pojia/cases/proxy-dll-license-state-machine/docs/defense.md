# Defense — an offline state machine is a state machine an attacker can drive

The package audits a fully local authorisation state machine: globals, transitions, downgrade
branches, and a clock. Everything it records is downstream of one decision to compute entitlement
locally. The defensive plan has to start there, because hardening the transitions of a local machine
only changes which transition an attacker uses.

## 1. Replace the machine with a signed claim

A state machine is a natural way to model trial → paid → grace → expired, and it is fine as *client
presentation*. It is not fine as the authority. Keep the states, but derive them from a signed claim
whose fields are the state and its expiry, verified at each transition:

- the claim is issued by the server, signed, bound to the account and (where possible) a device key;
- a transition that is not merely time-based (purchase, upgrade, refund) requires a server call;
- the local machine becomes a cache with a documented TTL, and a cache miss must fail toward the
  *lower* state, never the higher one.

The last point is the one implementations get wrong: renewal failures defaulting to "keep the paid
state" turn every outage into a free month and every clock trick into a permanent licence.

## 2. Remove the single global

Multiple globals that all mean "licensed" is how a downgrade branch survives a patch. Consolidate into
one verified structure, expose read-only accessors, and make every writer go through the verifier.
The package's own advice — read the writer, not the readers — applies in reverse: if there is exactly
one writer and it verifies, there is nothing worth patching among the readers.

## 3. Respect the clock and the allocator

Two implementation details that generate real findings:

- use a monotonic source for elapsed time and cross-check wall-clock rollback against a
  server-recorded last-seen time;
- do not assume a fixed number of states — the recorded bug shape is an allocator whose size came
  from a constant that the state count outgrew.

## 4. What a reviewer should be able to check

- Every gated feature reads one verified structure, not a scatter of globals.
- The failure path of a renewal or verification error moves to the lower state.
- Clock rollback is detected and reported, not silently tolerated.
- State transitions are logged with the claim id that justified them.

## 5. Verifying the fix

Drive the machine through each transition with a patched writer and watch what the gated features do.
Pass condition: patched state produces either a verification failure or a state the server will not
honour, and rolling the clock forward past expiry downgrades rather than extends. Prove both
directions — the package insists on it because one direction always passes by accident.

## 6. Residual risk

Offline products must trust something local. The realistic goal is that the local copy is verifiable,
expires, and cannot be manufactured without a key the client does not hold.
