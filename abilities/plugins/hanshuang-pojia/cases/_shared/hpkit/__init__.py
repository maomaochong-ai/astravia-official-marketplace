"""hpkit - shared primitives for the shipped case tools.

The case packages under ``cases/<slug>/tools/`` are meant to be run, not read.
That only works if the boring parts - option parsing, PE/ELF header decoding,
byte-pattern scanning, patch tables, DEX pools, synthetic fixtures - live in one
place and behave the same in every package.

Two layouts are supported, and each tool resolves the import itself:

* source tree        ``cases/<slug>/tools/<tool>.py``  +  ``cases/_shared/hpkit``
* scaffolded case    ``<workspace>/<name>/tools/<tool>.py``  +  ``tools/hpkit``

Modules:

* ``cli``       - options, report, exit codes, kit-wide self test
* ``pe``        - PE / ELF headers, sections, imports, RVA translation
* ``scan``      - array-of-bytes patterns with ``??`` wildcards
* ``patch``     - patch tables: check, apply, verify, restore
* ``dex``       - DEX header, string pool, type and method tables
* ``fixtures``  - synthetic PE / ELF / DEX / APK builders for self tests

Standard library only, Python 3.9+, ASCII source. The tools are meant to run on
an operator's machine with whatever interpreter is already there.
"""

__version__ = "1.0.0"

__all__ = ["cli", "dex", "fixtures", "patch", "pe", "scan"]
