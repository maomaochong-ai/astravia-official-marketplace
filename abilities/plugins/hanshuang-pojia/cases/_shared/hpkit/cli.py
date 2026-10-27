"""Shared primitives for the shipped case tools.

Every case tool is a plain Python 3 script with no third-party dependency, so it
runs on the operator's machine and in CI without a setup step. The kit is copied
next to the tool when a precedent is scaffolded into a case, which is why the
bootstrapping in each tool only looks for a sibling ``hpkit`` directory.

This module deliberately holds the pieces that were re-implemented in every
upstream script: argument handling, report rendering, exit codes and the
kit-wide self test.
"""

from __future__ import annotations

import os
import sys

EXIT_OK = 0
EXIT_FAIL = 1
EXIT_SELFTEST = 2

USAGE = """usage: {name} [options]

Every tool accepts --self-test, which builds synthetic fixtures in a temporary
directory and asserts the primitives it depends on. CI runs it for every tool.
"""


class UsageError(Exception):
    """Bad command line: reported without a traceback."""


def parse_options(argv, flags=(), values=()):
    """Minimal long-option parser.

    ``flags`` are booleans (``--force``), ``values`` take an argument
    (``--sample PATH``). Accepts ``--key=value`` and ``--key value``. Hyphens in
    option names are normalised to underscores, so ``--machine-code`` is read as
    ``options["machine_code"]``; the two spellings are interchangeable.
    """
    flags = tuple(name.replace("-", "_") for name in flags)
    values = tuple(name.replace("-", "_") for name in values)
    out = {flag: False for flag in flags}
    out.update({value: None for value in values})
    rest = []
    index = 0
    while index < len(argv):
        item = argv[index]
        if not item.startswith("--"):
            rest.append(item)
            index += 1
            continue
        body = item[2:].replace("-", "_")
        if "=" in body:
            key, _, given = body.partition("=")
            if key not in values:
                raise UsageError("unknown option --{}".format(key))
            out[key] = given
        elif body in flags:
            out[body] = True
        elif body in values:
            if index + 1 >= len(argv):
                raise UsageError("--{} needs a value".format(body))
            out[body] = argv[index + 1]
            index += 1
        elif body in ("help", "h"):
            out["help"] = True
        else:
            raise UsageError("unknown option --{}".format(body))
        index += 1
    out["_"] = rest
    return out


def require(options, *names):
    missing = [name for name in names if not options.get(name)]
    if missing:
        raise UsageError("missing required: " + ", ".join("--" + name for name in missing))


class Report:
    """Line-oriented report: stable enough to diff, plain enough to read."""

    def __init__(self, title=None, stream=None):
        self.lines = []
        self.stream = stream if stream is not None else sys.stdout
        if title:
            self.lines.append(title)
            self.lines.append("")

    def line(self, text=""):
        self.lines.append(text)
        return self

    def field(self, key, value):
        self.lines.append("- {}: {}".format(key, value))
        return self

    def bullet(self, text):
        self.lines.append("  * {}".format(text))
        return self

    def heading(self, text):
        self.lines.append("")
        self.lines.append("## " + text)
        return self

    def table(self, headers, rows):
        rows = [list(map(str, row)) for row in rows]
        widths = [len(head) for head in headers]
        for row in rows:
            for index, cell in enumerate(row):
                if index < len(widths):
                    widths[index] = max(widths[index], len(cell))
        def render(cells):
            padded = [cell.ljust(widths[index]) for index, cell in enumerate(cells)]
            return "| " + " | ".join(padded).rstrip() + " |"
        self.lines.append(render(headers))
        self.lines.append("| " + " | ".join("-" * width for width in widths) + " |")
        for row in rows:
            self.lines.append(render(row))
        return self

    def verdict(self, label, ok, detail=""):
        mark = "PASS" if ok else "FAIL"
        suffix = (" - " + detail) if detail else ""
        self.lines.append("[{}] {}{}".format(mark, label, suffix))
        return self

    def emit(self):
        text = "\n".join(self.lines)
        self.stream.write(text + "\n")
        return text


def run(main, self_test=None, flags=(), values=(), argv=None):
    """Run ``main(options)`` with the standard exit-code and error contract.

    ``flags`` and ``values`` name the tool's own options, exactly as
    ``parse_options`` takes them. ``self_test`` is the tool's ``--self-test``
    entry point; when the tool does not supply one the flag still runs the
    kit-wide test, so it is never silently ignored.
    """
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--self-test" in argv:
        if self_test is not None:
            return self_test()
        from . import selftest
        return selftest.run()
    name = os.path.basename(sys.argv[0]) or "tool"
    try:
        options = parse_options(argv, flags=flags, values=values)
        if options.get("help"):
            sys.stdout.write(USAGE.format(name=name))
            return EXIT_OK
        return main(options) or EXIT_OK
    except UsageError as error:
        sys.stderr.write("{}: {}\n".format(name, error))
        sys.stderr.write(USAGE.format(name=name))
        return EXIT_FAIL
    except FileNotFoundError as error:
        sys.stderr.write("{}: not found: {}\n".format(name, error.filename or error))
        return EXIT_FAIL
    except Exception as error:  # noqa: BLE001 - a tool must not dump a traceback at the operator
        sys.stderr.write("{}: {}: {}\n".format(name, type(error).__name__, error))
        return EXIT_FAIL


def bootstrap():
    """Put the copied (or in-tree) kit on sys.path and return the loaded package."""
    here = os.path.dirname(os.path.abspath(sys.argv[0]))
    candidates = (
        here,
        os.path.abspath(os.path.join(here, "..", "..", "_shared")),
        os.path.abspath(os.path.join(here, "..", "..", "..", "_shared")),
    )
    for candidate in candidates:
        if os.path.isdir(os.path.join(candidate, "hpkit")):
            if candidate not in sys.path:
                sys.path.insert(0, candidate)
            break
    return here
