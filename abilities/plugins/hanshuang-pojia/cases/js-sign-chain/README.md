# Web request signature chain — precedent

An endpoint rejects unsigned traffic. The signature is computed in the page by a bundled
function, and the only honest way to test the API is to reproduce that function outside the
browser — or to prove where it is computed and what it covers.

## When this precedent applies

- a request carries `sign`, `signature`, `x-sign`, `token` plus `ts` / `nonce`;
- the page is a webpack or vite bundle, possibly with string-array obfuscation;
- replaying a captured request works until the timestamp window closes;
- the signing function takes the parameters, sorts them, and appends a constant.

## Shape of the work

1. Capture one working request and its response. That is the oracle; everything else is checked
   against it.
2. Locate the signer in the bundle: search for the header name, then walk to the function that
   builds it. `run_radare` is the wrong tool here — read the JS.
3. Breakpoint or hook the signing call and log its inputs and output. Compare with the captured
   request to confirm you have the real chain and not a decoy.
4. Reproduce it in isolation with the same inputs; the output must match byte for byte.
5. Only then vary an input and see whether the server accepts it: that is the actual test.

## Traps

- Assuming the signature covers every parameter. It usually covers a sorted subset plus a
  nonce; changing a parameter outside the subset is a different experiment.
- Treating an obfuscated constant as a secret. If it ships in the bundle it is public; say so.
- Skipping step 4. Without a local reproduction you cannot tell "signature wrong" from
  "something else about the request is wrong".
- Recording live cookies or tokens in the case. They are credentials; redact them.

## Evidence you must be able to show

The captured request with secrets redacted, the signer's source location, the local
reproduction with matching output, and the varied-input result with the server's own response.
