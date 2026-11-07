# Zread

This optional Ability connects Astravia to Zread's hosted MCP server at <https://api.z.ai/api/mcp/zread/mcp> over Streamable HTTP. Zread answers questions about a GitHub repository from that repository's own documentation, directory structure and files.

Zread is open to **GLM Coding Plan** subscribers only and is **billed per request**. Create the key in the Z.ai console and read the current quota on the Coding Plan page. Enter only the key in Astravia's install form; `mcp.json` supplies `Authorization: Bearer {value}`. Do not add a real key to this repository, an issue, a prompt, or a log.

Three tools are exposed: `search_doc` (search a repository's documentation, including recent issues and commits), `get_repo_structure` (directory layout of a repository or one subdirectory), and `read_file` (full content of one file). The connection sets no allowlist; the tool set is whatever the service publishes, and details may change upstream. Repositories must be reachable by the service — private repositories are not covered.

Tool inputs, including repository names, paths and search terms, leave Astravia for `api.z.ai` over HTTPS. Returned content may then be passed to a model provider according to the client's settings. Everything Zread returns is repository content, so treat it as material to verify rather than as a conclusion.

Astravia stores installed MCP configuration through its existing settings mechanism. The secret input hides the key in the installation form; that alone is not a promise of encrypted storage. Use an appropriately scoped key and protect local configuration and backups.

The card image is an unmodified official icon published by zread.ai. Its source and checksum are recorded in [BRAND-ASSET.md](BRAND-ASSET.md); the marketplace's MIT license does not transfer rights in that mark.
