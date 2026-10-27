#!/usr/bin/env python3
"""Signature forge: turn one known site into a pattern that survives the next build.

The patch-table case kept failing on the same thing: an offset is only true for
the build it was read from. The eight-step pipeline in docs/pipeline.md reduces
that to a mechanical loop, and this tool is the loop:

1. anchor   - locate the site in the baseline build (by RVA or by a pattern);
2. seed     - take a short, dense slice of that site as a search key;
3. find     - require *exactly one* seed hit in every other build. Ambiguity is
              fatal here: two hits means the signature cannot address a site;
4. compare  - align the windows and turn every differing byte into ``??``;
5. widen    - if the merged pattern is not unique per build, grow the window
              and repeat instead of guessing;
6. verify   - the final pattern must hit exactly once in every build, at the
              offsets the tool prints;
7. emit     - signature string, per-build offsets, and the wildcard count;
8. refuse   - if no window makes it unique, exit non-zero. A signature that
              matches everywhere is worse than no signature.

usage:
    python3 sig_forge.py --baseline a.exe --builds b.exe,c.exe --at 0x1010
    python3 sig_forge.py --baseline a.exe --builds b.exe --pattern "0F 85 ?? ?? ?? ??"
    python3 sig_forge.py --baseline a.exe --builds b.exe,c.exe --at 0x1010 --out sig/
    python3 sig_forge.py --self-test
"""

import os
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, fixtures, pe, scan  # noqa: E402

DEFAULT_WINDOW = 24
DEFAULT_SEED = 8


class ForgeError(Exception):
    pass


def locate_seed(image, seed):
    return scan.find_all(image.data, list(seed), limit=8)


def slice_window(image, offset, size):
    return image.data[offset : offset + size]


def merge_windows(windows):
    """Byte-wise merge: positions that disagree become wildcards."""
    if not windows:
        raise ForgeError("no windows to merge")
    size = min(len(window) for window in windows)
    tokens = []
    for index in range(size):
        values = {window[index] for window in windows}
        tokens.append("{:02X}".format(values.pop()) if len(values) == 1 else "??")
    return tokens


def wildcard_count(tokens):
    return sum(1 for token in tokens if token == "??")


def forge(images, anchor_rva, before=4, size=DEFAULT_WINDOW, seed_len=DEFAULT_SEED, grow_to=96):
    """Merge a window across builds until it is unique in each of them.

    The seed is taken **at the anchor**, not at the window start, so it stays
    opcode-aligned and is allowed to shrink: a build that changed the operands
    will not contain a six-byte seed that includes them, but it still contains
    the three-byte opcode. Search length therefore degrades from ``seed_len``
    down to 3 instead of failing outright.

    Returns {'signature', 'offsets', 'wildcards', 'size', 'counts', 'attempts'};
    raises ForgeError when no window in range is unique per build.
    """
    baseline = images[0]
    anchor_off = baseline.rva_to_off(anchor_rva)
    attempts = []
    seed_lengths = []
    for candidate in (seed_len, 6, 5, 4, 3):
        if candidate <= seed_len and candidate >= 3 and candidate not in seed_lengths:
            seed_lengths.append(candidate)

    window_size = size
    while window_size <= grow_to:
        chosen = None
        for length in seed_lengths:
            seed = baseline.data[anchor_off : anchor_off + length]
            if len(seed) < length:
                break
            probe = list(seed)
            starts = []
            counts = []
            for image in images:
                hits = scan.find_all(image.data, probe, limit=4)
                counts.append(len(hits))
                starts.append(hits[0] if len(hits) == 1 else None)
            if all(count == 1 for count in counts):
                chosen = (length, starts)
                break
            attempts.append((window_size, length, "seed hits per build: {}".format(counts)))
        if chosen is None:
            attempts.append((window_size, 0, "no seed length is unique in every build"))
            window_size += 8
            continue

        length, starts = chosen
        windows = []
        for image, hit in zip(images, starts):
            window_start = max(0, hit - before)
            windows.append(slice_window(image, window_start, window_size))
        tokens = merge_windows(windows)
        pattern = scan.compile_pattern(" ".join(tokens))
        hits_per_build = [len(scan.find_all(image.data, pattern, limit=4)) for image in images]
        if all(count == 1 for count in hits_per_build):
            return {
                "signature": " ".join(tokens),
                "offsets": [max(0, hit - before) for hit in starts],
                "anchors": starts,
                "wildcards": wildcard_count(tokens),
                "size": window_size,
                "seed": length,
                "counts": hits_per_build,
                "attempts": attempts,
            }
        attempts.append((window_size, length, "pattern hits per build: {}".format(hits_per_build)))
        window_size += 8
    raise ForgeError(
        "no window up to {} bytes is unique in every build; narrow the site instead of widening the pattern".format(grow_to)
    )


def main(options):
    cli.require(options, "baseline")
    build_names = [name.strip() for name in (options.get("builds") or "").split(",") if name.strip()]
    if not build_names:
        raise cli.UsageError("--builds needs at least one other build")
    images = [pe.read(options["baseline"])] + [pe.read(name) for name in build_names]
    baseline = images[0]

    anchor_rva = None
    if options.get("at"):
        anchor_rva = int(options["at"], 16)
    elif options.get("pattern"):
        hits = scan.find_in_image(baseline, scan.compile_pattern(options["pattern"]))
        if len(hits) != 1:
            raise cli.UsageError(
                "--pattern matched {} sites in the baseline; a signature needs exactly one".format(len(hits))
            )
        anchor_rva = hits[0]["rva"]

    report = cli.Report("signature forge")
    report.field("baseline", options["baseline"])
    report.field("builds", len(images))
    for image in images:
        report.field("  " + os.path.basename(image.path), image.sha256[:16])

    if anchor_rva is None:
        report.line("")
        report.line("No anchor given: pass --at <rva> or --pattern <bytes>. Without an anchor there is")
        report.line("nothing to merge, and a signature invented from scratch matches everything.")
        report.emit()
        return cli.EXIT_FAIL

    report.field("anchor RVA", "0x{:X}".format(anchor_rva))
    size = int(options.get("size") or DEFAULT_WINDOW)
    seed_len = int(options.get("seed") or DEFAULT_SEED)
    before = int(options.get("before") or 4)

    try:
        result = forge(images, anchor_rva, before=before, size=size, seed_len=seed_len)
    except ForgeError as error:
        report.heading("result")
        report.verdict("forge", False, str(error))
        report.emit()
        return cli.EXIT_FAIL

    report.heading("signature")
    report.line("  " + result["signature"])
    report.field("window", "{} bytes".format(result["size"]))
    report.field("wildcards", "{} of {}".format(result["wildcards"], result["size"]))

    report.heading("per build")
    rows = []
    for image, offset in zip(images, result["offsets"]):
        try:
            rva = image.off_to_rva(offset)
            rva_text = "0x{:X}".format(rva)
            delta = rva - anchor_rva
            delta_text = "{:+d}".format(delta)
        except pe.FormatError:
            rva_text = "<unmapped>"
            delta_text = "-"
        rows.append([os.path.basename(image.path), "0x{:X}".format(offset), rva_text, delta_text])
    report.table(["build", "file offset", "rva", "drift vs baseline"], rows)

    if result["attempts"]:
        report.heading("widening attempts")
        for attempt_size, reason in result["attempts"]:
            report.bullet("{} bytes: {}".format(attempt_size, reason))

    report.heading("verdict")
    report.verdict("unique in every build", all(count == 1 for count in result["counts"]))
    report.line("")
    report.line("Wildcards mean 'this byte moved between builds'. If a wildcard covers an opcode byte")
    report.line("rather than an operand, the pattern is describing two different instructions and")
    report.line("must not be used as a patch anchor.")

    out = options.get("out")
    if out:
        os.makedirs(out, exist_ok=True)
        target = os.path.join(out, "signature.txt")
        with open(target, "w", encoding="utf-8") as handle:
            handle.write(result["signature"] + "\n")
            for image, offset in zip(images, result["offsets"]):
                handle.write("{}\t0x{:X}\n".format(os.path.basename(image.path), offset))
        report.field("written", target)

    report.emit()
    return cli.EXIT_OK


def _builds():
    """Three builds of the same site: identical opcodes, moved displacement."""
    images = []
    for index, disp in enumerate((0x40, 0x52, 0x3C)):
        data = bytearray(fixtures.synthetic_pe(version=False))
        body = 0x200
        data[body : body + 0x200] = b"\x00" * 0x200
        # 48 8B 05 <disp32>  mov rax, [rip+disp]   (disp differs per build)
        code = bytes.fromhex("488B05") + disp.to_bytes(4, "little") + bytes.fromhex("4885C07410")
        data[body + 0x10 : body + 0x10 + len(code)] = code
        # a dense, build-invariant filler so the seed slice is unique
        filler = bytes.fromhex("554889E54883EC20488D3D") * 4
        data[body + 0x40 : body + 0x40 + len(filler)] = filler
        images.append(bytes(data))
    return images


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]
    with fixtures.Workspace() as workspace:
        paths = []
        for index, blob in enumerate(_builds()):
            paths.append(workspace.write("build{}.exe".format(index), blob))
        images = [pe.read(path) for path in paths]

        result = forge(images, 0x1010, before=2, size=16, seed_len=6)
        results.append(result["wildcards"] >= 1)
        results.append(all(count == 1 for count in result["counts"]))
        pattern = scan.compile_pattern(result["signature"])
        results.append(scan.matches_at(images[0].data, result["offsets"][0], pattern))
        results.append(len(set(result["offsets"])) >= 1)
        results.append(result["signature"].startswith("55 48 89 E5") is False)

        tokens = merge_windows([b"\x01\x02\x03", b"\x01\x09\x03"])
        results.append(tokens == ["01", "??", "03"])
        results.append(wildcard_count(tokens) == 1)
        results.append(merge_windows([b"\xAA", b"\xAA"]) == ["AA"])

        # Fail closed: two identical copies of the seed make the site ambiguous.
        twin = bytearray(_builds()[0])
        twin[0x240 : 0x240 + len(twin[0x210:0x218])] = twin[0x210:0x218]
        twin_path = workspace.write("twin.exe", bytes(twin))
        try:
            forge([images[0], pe.read(twin_path)], 0x1010, before=2, size=16, seed_len=6, grow_to=24)
            results.append(False)
        except ForgeError:
            results.append(True)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nsig_forge self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ()
VALUES = ("baseline", "builds", "at", "pattern", "before", "size", "seed", "out")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
