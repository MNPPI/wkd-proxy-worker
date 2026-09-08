#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_root}"
# shellcheck disable=SC1091
. "${repo_root}/.cursor/use-pinned-node.sh"
nvm use "${NODE_VERSION}" >/dev/null
exec pnpm dev
