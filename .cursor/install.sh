#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for WKD Proxy Worker.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"

# shellcheck disable=SC1091
. "${repo_root}/.cursor/use-pinned-node.sh"
nvm install "${NODE_VERSION}" >/dev/null
nvm alias default "${NODE_VERSION}" >/dev/null
nvm use "${NODE_VERSION}" >/dev/null
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@11.8.0 --activate >/dev/null 2>&1 || true

echo "Using node $(node -v) / pnpm $(pnpm -v)"

pnpm install --frozen-lockfile
echo "Cloud Agent bootstrap complete."
