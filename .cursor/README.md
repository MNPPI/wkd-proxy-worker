# Cursor Cloud Agent recipe

These files bootstrap Cursor Cloud Agents for `WKD Proxy Worker`. Keep them
aligned with [`.nvmrc`](../.nvmrc) and [`AGENTS.md`](../AGENTS.md).

| File | Role |
| --- | --- |
| `environment.json` | Install command, `dev` terminal, ports |
| `install.sh` | Pinned Node, `pnpm install --frozen-lockfile` |
| `dev.sh` | Starts `pnpm dev` on the pinned Node |
| `use-pinned-node.sh` | Source-only nvm helper |

This repo installs without a private package token.
