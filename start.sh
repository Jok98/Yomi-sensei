#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then pnpm install --frozen-lockfile; fi
if [ ! -x .venv/bin/python ]; then pnpm prepare:runtime; fi
pnpm build
pnpm start
