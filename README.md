# WKD Proxy Worker

A Cloudflare Worker that proxies [OpenPGP Web Key Directory (WKD)](https://wiki.gnupg.org/WKD) requests to Proton Mail's API for your custom domains.

If you use Proton Mail with custom domains, this Worker enables WKD key discovery so that email clients can automatically find your OpenPGP public keys via the standard WKD protocol.

## How It Works

When an email client looks up an OpenPGP key for `user@yourdomain.com`, it queries either:

- `https://openpgpkey.yourdomain.com/hu/<hash>?l=user` (direct method)
- `https://yourdomain.com/.well-known/openpgpkey/hu/<hash>?l=user` (advanced method)

This Worker intercepts those requests via Cloudflare route patterns and proxies them to Proton Mail's WKD endpoint, which serves the actual key data.

## Features

- Supports unlimited custom domains via a single Worker secret
- Handles both WKD direct (subdomain) and advanced (`.well-known` path) methods
- Dashboard-managed routes and a `DOMAINS` Worker secret so real domains stay out of this public repo
- One-time DNS setup for `openpgpkey.*` subdomains
- 100% test coverage with Cloudflare Workers vitest integration
- Full observability: structured logging, traces, and logpush

## Production `DOMAINS` secret

This is the primary guidance for operators and anyone forking the Worker.

Production `DOMAINS` is a **Cloudflare Worker secret**, not a plain Wrangler `vars` entry and not a GitHub Actions secret. The Worker reads `env.DOMAINS` at runtime as a comma-separated list of hostnames (no spaces required). Secrets bind the same way as vars, so existing code does not change.

**Never commit the value.** Do not put real domains in git, in `wrangler.jsonc` `vars`, in docs examples, in tests, or in GitHub Actions secrets or variables. This public repository has no GitHub `DOMAINS` secret.

### Set or rotate the secret

Use either path. Do not put the value in the repo.

1. Cloudflare dashboard: Worker `wkd-proxy-worker` → Settings → Secrets → add or update `DOMAINS`.
2. Workstation CLI (account token on that machine only):

```bash
wrangler secret put DOMAINS
```

Paste the comma-separated list when prompted, for example:

```text
example.com,example.org,example.net
```

That example is documentation only. Production uses your real custom domains in the secret, never in git.

`wrangler.jsonc` lists `DOMAINS` under `secrets.required`. Workers Builds (`pnpm deploy:cloudflare`, which is `wrangler deploy`) fails closed if the secret is missing. A Worker that somehow ran without it would return HTTP 500 when `env.DOMAINS` is empty.

If `DOMAINS` still exists as a dashboard **plain** variable, convert it to a **secret** before the next Builds deploy. Secrets survive deploys. Leftover plains do not, because this project no longer uses `keep_vars`.

### Example domains only in tests and local files

Tests (`vitest.config.ts`, `test/index.spec.ts`) and `.dev.vars.example` use only `example.com`, `example.org`, and `example.net`. Copy `.dev.vars.example` to `.dev.vars` for local `wrangler dev`. Never copy production domains into those files.

## Quick Start

### 1. Fork This Repository

Fork this repo and clone your fork locally.

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Connect Workers Builds

In the Cloudflare dashboard, open Worker `wkd-proxy-worker` → Settings →
Builds and connect this repository. Production branch: `main`. Deploy
command: `pnpm deploy:cloudflare`. Leave non-production branch builds off.

Set production `DOMAINS` as a Worker secret using [Production `DOMAINS` secret](#production-domains-secret). GitHub Actions has no Cloudflare deploy token.

### 4. Add routes and DNS once

For each domain, add these Worker routes in the dashboard:

| Pattern                               | Purpose                       |
| ------------------------------------- | ----------------------------- |
| `openpgpkey.{domain}/*`               | WKD direct method (subdomain) |
| `{domain}/.well-known/openpgpkey/*`   | WKD advanced method (path)    |
| `*.{domain}/.well-known/openpgpkey/*` | WKD advanced on any subdomain |

Create a proxied CNAME `openpgpkey.{domain}` → `{domain}`. If the root zone
has no A, AAAA, or CNAME (common for email-only domains), add proxied
placeholders `192.0.2.1` and `100::` so Cloudflare can intercept
`.well-known` requests. Existing website records stay untouched.

`wrangler.jsonc` sets `workers_dev = false` and `secrets.required` to
`["DOMAINS"]` and omits `routes` and `vars`. Wrangler still applies any
`vars` that are in the config, so `DOMAINS` must not appear there.

### 5. Push to Deploy

Push to `main`. GitHub Actions runs typecheck, lint, tests, and
`cf:check`. Cloudflare Workers Builds deploys the Worker.

### 6. Verify

```bash
curl https://openpgpkey.yourdomain.com/policy
```

A `200` response confirms the Worker is serving WKD requests for that domain.

## Local Development

```bash
pnpm run dev
```

This starts a local dev server. Copy `.dev.vars.example` to `.dev.vars`
so local `DOMAINS` uses the example list (`example.com`, `example.org`,
`example.net`). See [Production `DOMAINS` secret](#production-domains-secret).

## Testing

```bash
pnpm run test        # Run tests
pnpm run coverage    # Run with 100% coverage enforcement
pnpm run typecheck   # TypeScript strict mode
pnpm run lint        # ESLint strict type-checked
```

Tests inject the same example list. They never use production domains.

## How Deployment Works

GitHub Actions validates the pull request. Cloudflare Workers Builds deploys
from `main` with `pnpm deploy:cloudflare`. That command is
`wrangler deploy`. Dashboard routes stay because `routes` is omitted.

Production `DOMAINS` is a Worker secret. Set and rotate it as described in
[Production `DOMAINS` secret](#production-domains-secret).

The Worker only intercepts the three WKD route patterns. Other hostname
traffic is unchanged.

### MNPPI Required Public Checks

GitHub runs the MNPPI Public Token-Free Security check for each pull request.
That org-required workflow uses hosted runners and no MNPPI secrets.

## Adding or Removing Domains

1. Update the Worker `DOMAINS` secret (dashboard Secrets or
   `wrangler secret put DOMAINS`). Never commit the value. See
   [Production `DOMAINS` secret](#production-domains-secret).
2. Add or remove the three route patterns for that domain.
3. Add or delete the `openpgpkey.*` CNAME. Add a root placeholder only when
   the zone has no A, AAAA, or CNAME.

## Prerequisites

- Custom domains added to Cloudflare (DNS managed by Cloudflare)
- Proton Mail account with those custom domains configured
- OpenPGP keys published in Proton Mail for the email addresses you want discoverable

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
