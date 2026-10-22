# NOTICE

## Bundled artwork

`assets/kali-dragon.svg` is the official Kali Linux dragon icon, downloaded from
<https://www.kali.org/images/kali-dragon-icon.svg> on 2026-10-22.

`assets/icon.png` (512×512) and `assets/composer-icon.png` (256×256) are raster
renders of that same file, produced without modification of the artwork: the SVG
was loaded in Chromium and captured at 512 px with a transparent background, then
scaled down for the composer icon.

Kali Linux is a project of OffSec Services Limited. The Kali dragon mark is theirs;
it is used here only to identify the product this skill drives, which is the
descriptive use the marketplace's card-icon rule requires. No endorsement by
OffSec is implied. If OffSec asks for the mark to be removed, replace the three
files above with a neutral Solar icon and bump the skill version.

## Bundled documentation

The playbooks, category READMEs and tool documents under `references/` — 16 scenario
playbooks, 14 category guides and 270 per-tool references — are derived from the
`x-glacier/kali-pentest` project (<https://github.com/x-glacier/kali-pentest>),
revision `43138c5`, which is licensed under the Apache License, Version 2.0.

Changes made here, as required by section 4(b) of that license:

- Preamble sections were merged into `SKILL.md`; the upstream `SKILL.md` was not copied.
- Every `sudo` prefix was removed (the runtime is root and the image has no `sudo`).
- `apt install` instructions became `ensure <package>`, the skill's install wrapper.
- `docker exec` / `ssh` command wrappers became `kali.sh run`, and the container name
  `kali-pentest` became `astravia-kali`.
- The state directory moved from `/tmp/kali-pentest-state/<target>/` to
  `/work/<target>/`, the one directory mounted back to the host.
- `references/environment/README.md` was rewritten for this skill's four backends;
  the upstream Docker/SSH mode documents are kept, with a header noting that their
  setup steps are superseded.
- Prose that assumed a manually provisioned Kali was otherwise left intact.

The full license text is in `LICENSE-Apache-2.0.md`. The `kali-pentest` project has
no `NOTICE` file, so none is reproduced. The upstream documents are documentation,
not executable code; nothing from the `kali-pentest` project runs on the user's
machine.

## License

The scripts, the original references (`install.md`, `runbook.md`, `safety.md`,
`examples.md`) and the documentation in this package are MIT licensed, like the rest
of this marketplace (see the repository root `LICENSE`). The derived reference
library is Apache-2.0, as described above.

Kali Linux itself, and every tool installed through `kali.sh ensure`, carries its
own license — mostly GPL-3.0 for the base system, and per-package licenses for the
tooling. Nothing from those packages is redistributed here.

