# Defense — the agent route and the tier field are two separate findings

This package demonstrates two things at once and they must not be fixed as one. The tier is a field
the client decides; the loader is a mechanism that lets anyone put code into the process. Fixing the
first does nothing about the second, and the second is the more serious of the two because it affects
every customer, not only the ones who want a higher tier.

## 1. Close the loader route first

A JVM process accepts an agent because something told it to. Enumerate the ways, and close them as
deployment policy rather than as code:

- **environment**: `JAVA_TOOL_OPTIONS`, `_JAVA_OPTIONS`, `JDK_JAVA_OPTIONS` are read by the launcher
  and printed to stderr — a build script should assert they are empty in the shipped launcher;
- **command line**: `-javaagent` and `-agentlib` must not be reachable from any user-editable config
  file the product reads;
- **attach**: the dynamic attach mechanism can be restricted on platforms that support it, and its
  use should be logged by the launcher when it happens;
- **DLL search order**: the classic hijack. Ship an application directory with no writable path
  earlier than it, and sign the DLLs that must be loaded.

None of this stops a user with administrator rights on their own machine. It does stop the "drop one
file next to the exe" class, which is what turns a research technique into a distributed crack.

## 2. Then make the tier server-side

If the client can decide `PRO` and every feature reads that field, the field is the product's
pricing model with a debugger attached. Move the decision to the server, and let the client's copy be
a cache of a signed claim:

- the claim names the tier, the account, the expiry and the features;
- the client verifies the signature where the feature is used, not once at startup;
- derived entitlements (the metadata array this package records) must be recomputed from the verified
  claim, not stored alongside it.

## 3. Bytecode rewriting: minimise what can be rewritten

The recorded route rewrites bytecode to construct an object instead of returning `null`. That works
because the seam is small and predictable. Defensively:

- keep authorisation objects immutable and constructed only by a factory that verifies the claim;
- avoid a null-returning accessor that callers are expected to interpret — the ambiguity is the seam;
- if a value is derived from a licence, derive it inside the verification function's scope.

## 4. What a reviewer should be able to check

- The shipped launcher asserts a clean environment for the agent variables and logs the check.
- No configuration file the user can edit supplies JVM arguments.
- Tier decisions trace back to a signed claim and fail closed when the signature is absent.
- The application directory is not writable by the user account that runs the product.

## 5. Verifying the fix

Re-run the agent attach from this package's method, then re-run the bytecode patch. Two separate pass
conditions: the agent no longer loads through any of the enumerated routes, and the patched class
still cannot grant a tier because the gated feature refuses without a valid signed claim.

## 6. Residual risk

Java is reflective by design, and a self-hosted JVM will always permit instrumentation. The defensible
position is that instrumentation is detectable, that it does not change what the server delivers, and
that shipping a signed launcher raises the cost of doing it quietly.
