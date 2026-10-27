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

## Tools

- [docs/method.md](docs/method.md) - how to find the signer from the outside in, and why the set of
  fields inside the signature matters more than the algorithm.

[`tools/sign_chain_scan.py`](tools/sign_chain_scan.py) reads the bundle as text and reports the six
stages of the chain: collect (`Object.keys`, `URLSearchParams`), order (`.sort()`, `join('&')`,
`qs.stringify`), secret (a hex or base64 constant of key length), digest (`md5`, `sha256`, `hmac`,
`createHash`, `subtle.digest`), attach (`x-sign`, `signature`, `authorization`), and replay guard
(`nonce`, `timestamp`, `Date.now()`). The four positional stages are checked for ascending source
order, and the field-like literals around the ordering call are listed, because that set is the
boundary a server can actually enforce.

```bash
cd tools
python3 sign_chain_scan.py --self-test
python3 sign_chain_scan.py --sample app.min.js
python3 sign_chain_scan.py --sample a.js,b.js --query x-sign
```

The bundle is never executed and no request is made. A missing digest means WebAssembly or a fetched
signer; a missing secret means it arrives at run time.

[`tools/sign_chain_probe.py`](tools/sign_chain_probe.py) answers the other half: given one captured
request, its params, a candidate secret and the observed signature, it enumerates the constructions that
actually ship - sorted or body order, four joins, secret prefixed / suffixed / omitted, lower- or
upper-cased before hashing, MD5 / SHA-1 / SHA-256 / HMAC-SHA256 - and reports which one reproduces the
value. A match is evidence for one request, not yet a rule; the next request is what makes it one. Exit
code 1 means no construction matched.

```bash
python3 sign_chain_probe.py --self-test
python3 sign_chain_probe.py --request req.json --secret demo --algo sha256
python3 sign_chain_probe.py --request req.json --secret demo --sign-field sign --exclude sign,timestamp
```

Both directions are offline: the bundle is never executed and no request leaves the machine.
[`tools/manifest.json`](tools/manifest.json) registers both tools for the scaffolder.
