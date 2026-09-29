# WKD Proxy Worker

## What This Is

A Cloudflare Worker that proxies OpenPGP Web Key Directory (WKD) requests to Proton Mail's API for configured domains. It enables WKD key discovery on custom domains that use Proton Mail for email.

## Architecture

Single-file Worker (`src/index.ts`) with no framework dependencies. Production
`DOMAINS` is a Cloudflare Worker **secret**, not a plain `vars` entry. Runtime
still reads `env.DOMAINS` as a comma-separated string; secrets bind the same
way. Dashboard routes stay out of git. Do not put `DOMAINS` in
`wrangler.jsonc` `vars`. Tests set example domains in `vitest.config.ts`.
Local `wrangler dev` reads `.dev.vars`.

README.md **Production `DOMAINS` secret** is the primary user-facing guidance
for operators and forks. Follow that section for how to set or rotate the
secret (dashboard Secrets or `wrangler secret put DOMAINS`), never commit the
value, and keep example.com / example.org / example.net only in tests and
`.dev.vars.example`.

## Key Files

- `src/index.ts` - The entire Worker implementation
- `test/index.spec.ts` - Tests using `@cloudflare/vitest-pool-workers`
- `wrangler.jsonc` - Wrangler config (`secrets.required` for `DOMAINS`, no `keep_vars`, no routes, no `DOMAINS` var)
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

The Builds deploy command is `pnpm deploy:cloudflare` (`wrangler deploy`).
`workers_dev` is false and `route` / `routes` are omitted so dashboard routes stay.
`wrangler.jsonc` lists `DOMAINS` under `secrets.required` so Builds fails closed
when the secret is missing. Do not commit `DOMAINS` in `vars`, including
example values. This public repo has no GitHub `DOMAINS` secret. Agents must
not run `wrangler secret put` or use `CLOUDFLARE_API_TOKEN`. Operators set or
rotate from a workstation with Mark's token using the README procedure.

Adding a domain is a workstation or dashboard procedure: update the `DOMAINS`
secret per README, add the three route patterns, create the `openpgpkey` CNAME,
and add a root placeholder only when the zone has no A/AAAA/CNAME.

## Code Standards

- TypeScript strict mode with `noUncheckedIndexedAccess`
- No `any`, no `as` assertions, no `@ts-ignore`
- ESLint strict type-checked config
- 100% test coverage required
- All domains use example.com/org/net in tests (no real domains in source)
