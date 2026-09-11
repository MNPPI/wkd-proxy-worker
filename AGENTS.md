# WKD Proxy Worker

## Hybrid environments

| Environment        | How dependencies install                                               | How Node is selected                                  |
| ------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| Mac workstation    | `pnpm install --frozen-lockfile` (and direnv when this repo uses it).  | nvm / fnm / Homebrew Node reading [`.nvmrc`](.nvmrc). |
| Cursor Cloud Agent | [`.cursor/install.sh`](.cursor/install.sh) (tokenless frozen install). | The same `.nvmrc` pin through nvm.                    |

Do not put tokens in the repo, chat output, or committed env files.

Cloud Agent bootstrap: see [`.cursor/README.md`](.cursor/README.md). Keep `environment.json`, `install.sh`, and dashboard Environment Builds aligned.

## What This Is

A Cloudflare Worker that proxies OpenPGP Web Key Directory (WKD) requests to Proton Mail's API for configured domains. It enables WKD key discovery on custom domains that use Proton Mail for email.

## Architecture

Single-file Worker (`src/index.ts`) with no framework dependencies. Production
`DOMAINS` and routes stay in the Cloudflare dashboard. `wrangler.jsonc` keeps
example domains for local dev and tests.

## Key Files

- `src/index.ts` - The entire Worker implementation
- `test/index.spec.ts` - Tests using `@cloudflare/vitest-pool-workers`
- `wrangler.jsonc` - Wrangler config (example `DOMAINS`, `keep_vars`, no routes)
- `.github/workflows/deploy.yaml` - GitHub CI only: lint, test, `cf:check`

## Commands

- `pnpm run typecheck` - TypeScript strict mode check
- `pnpm run lint` - ESLint with typescript-eslint strict
- `pnpm run test` - Run tests
- `pnpm run coverage` - Tests with 100% coverage enforcement
- `pnpm run dev` - Local dev server

## Testing

Tests use `@cloudflare/vitest-pool-workers` with `fetchMock` for upstream API mocking. The `env` from `cloudflare:test` is augmented with `DOMAINS` via module declaration in the test file. Coverage thresholds are 100% across all metrics.

## Deployment

Cloudflare Workers Builds owns production deploy from `main`. GitHub Actions
validates only. Do not run `wrangler deploy`, remote DNS writes, or use
`CLOUDFLARE_API_TOKEN` from GitHub or a Cloud Agent.

The Builds deploy command is `pnpm deploy:cloudflare` (`wrangler deploy --keep-vars`).
`workers_dev` is false and `route` / `routes` are omitted so dashboard routes stay.
Production `DOMAINS` stays a dashboard Worker var. Do not commit real domains.

Adding a domain is a workstation or dashboard procedure: update the `DOMAINS`
var, add the three route patterns, create the `openpgpkey` CNAME, and add a
root placeholder only when the zone has no A/AAAA/CNAME.

## Code Standards

- TypeScript strict mode with `noUncheckedIndexedAccess`
- No `any`, no `as` assertions, no `@ts-ignore`
- ESLint strict type-checked config
- 100% test coverage required
- All domains use example.com/org/net in tests (no real domains in source)
