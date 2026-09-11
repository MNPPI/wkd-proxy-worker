# WKD Proxy Worker

A Cloudflare Worker that proxies [OpenPGP Web Key Directory (WKD)](https://wiki.gnupg.org/WKD) requests to Proton Mail's API for your custom domains.

If you use Proton Mail with custom domains, this Worker enables WKD key discovery so that email clients can automatically find your OpenPGP public keys via the standard WKD protocol.

## How It Works

When an email client looks up an OpenPGP key for `user@yourdomain.com`, it queries either:

- `https://openpgpkey.yourdomain.com/hu/<hash>?l=user` (direct method)
- `https://yourdomain.com/.well-known/openpgpkey/hu/<hash>?l=user` (advanced method)

This Worker intercepts those requests via Cloudflare route patterns and proxies them to Proton Mail's WKD endpoint, which serves the actual key data.

## Features

- Supports unlimited custom domains via a single environment variable
- Handles both WKD direct (subdomain) and advanced (`.well-known` path) methods
- Dashboard-managed routes and `DOMAINS` so real domains stay out of git
- One-time DNS setup for `openpgpkey.*` subdomains
- 100% test coverage with Cloudflare Workers vitest integration
- Full observability: structured logging, traces, and logpush

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

Set the Worker runtime variable `DOMAINS` in Settings → Variables to a
comma-separated list of your custom domains. Do not commit real domains.

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

`wrangler.jsonc` sets `workers_dev = false` and `keep_vars = true` and
omits `routes` and `vars`. Wrangler still applies any `vars` that are in
the config, so example `DOMAINS` must not appear there. Tests and local
dev supply example domains separately.

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
so local `DOMAINS` uses the example list.

## Testing

```bash
pnpm run test        # Run tests
pnpm run coverage    # Run with 100% coverage enforcement
pnpm run typecheck   # TypeScript strict mode
pnpm run lint        # ESLint strict type-checked
```

## How Deployment Works

GitHub Actions validates the pull request. Cloudflare Workers Builds deploys
from `main` with `pnpm deploy:cloudflare`. That command is
`wrangler deploy --keep-vars`. Dashboard routes stay because `routes` is
omitted. Production `DOMAINS` stays because it is not in `wrangler.jsonc`.

The Worker only intercepts the three WKD route patterns. Other hostname
traffic is unchanged.

## Adding or Removing Domains

1. Update the Worker `DOMAINS` variable in the Cloudflare dashboard.
2. Add or remove the three route patterns for that domain.
3. Add or delete the `openpgpkey.*` CNAME. Add a root placeholder only when
   the zone has no A, AAAA, or CNAME.

Do not put real domains in git or in GitHub Actions secrets.

## Prerequisites

- Custom domains added to Cloudflare (DNS managed by Cloudflare)
- Proton Mail account with those custom domains configured
- OpenPGP keys published in Proton Mail for the email addresses you want discoverable

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
