# WKD Proxy Worker

## What This Is

A Cloudflare Worker that proxies OpenPGP Web Key Directory (WKD) requests to Proton Mail's API for configured domains. It enables WKD key discovery on custom domains that use Proton Mail for email.

## Architecture

Single-file Worker (`src/index.ts`) with no framework dependencies. Domains are configured at runtime via the `DOMAINS` environment variable (comma-separated). Routes and DNS records are managed dynamically by the GitHub Actions deploy workflow.

## Key Files

- `src/index.ts` - The entire Worker implementation
- `test/index.spec.ts` - Tests using `@cloudflare/vitest-pool-workers`
- `wrangler.jsonc` - Wrangler config (vars.DOMAINS has test defaults)
- `.github/workflows/deploy.yaml` - CI/CD: lint, test, DNS, deploy

## Commands

- `pnpm run typecheck` - TypeScript strict mode check
- `pnpm run lint` - ESLint with typescript-eslint strict
- `pnpm run test` - Run tests
- `pnpm run coverage` - Tests with 100% coverage enforcement
- `pnpm run dev` - Local dev server

## Testing

Tests use `@cloudflare/vitest-pool-workers` with `fetchMock` for upstream API mocking. The `env` from `cloudflare:test` is augmented with `DOMAINS` via module declaration in the test file. Coverage thresholds are 100% across all metrics.

## Deployment

Deployment is GitHub Actions only (never manual `wrangler deploy` in production). The workflow:

1. Masks domain names in logs (from `DOMAINS` secret)
2. Idempotently creates `openpgpkey.*` DNS CNAME records via Cloudflare API
3. Generates `--route` args for each domain (3 patterns per domain)
4. Deploys with `--var DOMAINS:${DOMAINS}` to inject the runtime config

## Secrets

- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Zone:DNS:Edit, Zone:Zone:Read, Workers Scripts:Edit, Workers Routes:Edit
- `DOMAINS` - Comma-separated list of domains (masked in logs)

## Code Standards

- TypeScript strict mode with `noUncheckedIndexedAccess`
- No `any`, no `as` assertions, no `@ts-ignore`
- ESLint strict type-checked config
- 100% test coverage required
- All domains use example.com/org/net in tests (no real domains in source)
