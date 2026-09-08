#!/usr/bin/env bash
# Shared Node activation for Cloud Agent and hybrid scripts.
#
# Source this file; do not execute it. It reads the exact Node version from
# .nvmrc and loads nvm so callers can `nvm install` / `nvm use`.
#
# The Cloud Agent runtime prepends /exec-daemon/node ahead of nvm, so callers
# must `nvm use` after sourcing. That puts the pinned version first on PATH.
if [[ -z "${BASH_SOURCE[0]:-}" ]]; then
  echo "ERROR: source .cursor/use-pinned-node.sh; do not execute it." >&2
  exit 1
fi

_cursor_repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "${_cursor_repo_root}/.nvmrc" ]]; then
  echo "ERROR: missing ${_cursor_repo_root}/.nvmrc" >&2
  return 1 2>/dev/null || exit 1
fi

# Trim BOM / whitespace so a one-line .nvmrc stays an exact X.Y.Z pin.
NODE_VERSION="$(tr -d '[:space:]' < "${_cursor_repo_root}/.nvmrc")"
if [[ ! "${NODE_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: ${_cursor_repo_root}/.nvmrc must contain an exact X.Y.Z Node version." >&2
  return 1 2>/dev/null || exit 1
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  . "${NVM_DIR}/nvm.sh"
fi

if ! type nvm >/dev/null 2>&1; then
  echo "ERROR: nvm is required to activate Node ${NODE_VERSION}." >&2
  return 1 2>/dev/null || exit 1
fi
