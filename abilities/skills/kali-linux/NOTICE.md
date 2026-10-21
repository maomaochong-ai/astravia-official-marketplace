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

No other third-party code, fonts, images or data files are bundled in this package.
The scripts only call tools that the user installs at run time inside their own Kali
environment.

## License

The scripts, references and documentation in this package are MIT licensed, like
the rest of this marketplace (see the repository root `LICENSE`).

Kali Linux itself, and every tool installed through `kali.sh ensure`, carries its
own license — mostly GPL-3.0 for the base system, and per-package licenses for the
tooling. Nothing from those packages is redistributed here.
