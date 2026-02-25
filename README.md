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
- Automated DNS record creation for `openpgpkey.*` subdomains
- Domain names masked in CI/CD logs for privacy
- 100% test coverage with Cloudflare Workers vitest integration
- Full observability: structured logging, traces, and logpush

## Quick Start

### 1. Fork This Repository

Fork this repo and clone your fork locally.

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Your Domains

Set the `DOMAINS` GitHub secret with a comma-separated list of your custom domains:

```bash
gh secret set DOMAINS --body "yourdomain.com,anotherdomain.org"
```

### 4. Configure Cloudflare API Token

Create a [Cloudflare API token](https://dash.cloudflare.com/profile/api-tokens) with these permissions:

| Permission Scope | Permission      | Access |
| ---------------- | --------------- | ------ |
| Account          | Workers Scripts | Edit   |
| Zone             | Workers Routes  | Edit   |
| Zone             | DNS             | Edit   |
| Zone             | Zone            | Read   |

The token must cover all zones (domains) you plan to use. Set it as a GitHub secret:

```bash
gh secret set CLOUDFLARE_API_TOKEN --body "your-token-here"
```

### 5. Push to Deploy

Push to `main` and the GitHub Actions workflow will:

1. Run typecheck, lint, and tests with 100% coverage
2. Create `openpgpkey.*` DNS CNAME records (idempotent - skips existing)
3. Deploy the Worker with routes for all configured domains

### 6. Verify

```bash
curl https://openpgpkey.yourdomain.com/policy
```

A `200` response confirms the Worker is serving WKD requests for that domain.

## Local Development

```bash
pnpm run dev
```

This starts a local dev server. The `DOMAINS` variable defaults to example domains from `wrangler.jsonc` for local development.

## Testing

```bash
pnpm run test        # Run tests
pnpm run coverage    # Run with 100% coverage enforcement
pnpm run typecheck   # TypeScript strict mode
pnpm run lint        # ESLint strict type-checked
```

## How Deployment Works

The deploy workflow generates three route patterns per domain:

| Pattern                               | Purpose                       |
| ------------------------------------- | ----------------------------- |
| `openpgpkey.{domain}/*`               | WKD direct method (subdomain) |
| `{domain}/.well-known/openpgpkey/*`   | WKD advanced method (path)    |
| `*.{domain}/.well-known/openpgpkey/*` | WKD advanced on any subdomain |

Before deploying, it ensures the required DNS records exist for each domain:

- **`openpgpkey.{domain}`** - A proxied CNAME pointing to the root domain, for the WKD direct method
- **Root domain A/AAAA records** - If the root domain has no existing A, AAAA, or CNAME records (common for email-only domains), proxied placeholder records are created (`192.0.2.1` / `100::`) so Cloudflare can intercept `.well-known` requests

All DNS creation is idempotent - existing records are never modified or overwritten.

> **If your domain already hosts a website**: The deploy workflow detects existing root domain DNS records and leaves them untouched. Your web hosting is not affected. The Worker only intercepts requests matching the WKD route patterns above - all other traffic passes through normally.

The `DOMAINS` value is injected as a Worker environment variable at deploy time via `--var`, so domains never appear in source code.

## Adding or Removing Domains

1. Update the `DOMAINS` GitHub secret
2. Push any commit to `main` (or trigger the workflow manually)
3. New DNS records are created automatically; removed domains simply stop receiving routes

For removed domains, you may want to manually delete the orphaned `openpgpkey.*` DNS records in the Cloudflare dashboard.

## Prerequisites

- Custom domains added to Cloudflare (DNS managed by Cloudflare)
- Proton Mail account with those custom domains configured
- OpenPGP keys published in Proton Mail for the email addresses you want discoverable

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).
