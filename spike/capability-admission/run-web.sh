#!/usr/bin/env bash
# One-key throwaway official DSH web instance carrying the capability-admission spike bundle.
# The official checkout is a built copy under .agent-work/tmp (never reference/).
# Overridable: DSH_OFFICIAL_ROOT, CAPABILITY_ADMISSION_WEB_HOME, CAPABILITY_ADMISSION_WEB_PORT.
set -euo pipefail

SPIKE_DIR="$(cd "$(dirname "$0")" && pwd)"
DSH_ROOT="${DSH_OFFICIAL_ROOT:-/Users/ibobby/Projects/dsh-zcode-acp/.agent-work/tmp/dsh-official}"
DH="${CAPABILITY_ADMISSION_WEB_HOME:-/tmp/dsh-capability-admission-web}"
PORT="${CAPABILITY_ADMISSION_WEB_PORT:-3199}"

if [[ ! -f "$DSH_ROOT/apps/cli/lib/bin.js" ]]; then
  echo "official DSH build missing at $DSH_ROOT/apps/cli/lib/bin.js" >&2
  exit 1
fi

rm -rf "$DH"
mkdir -p "$DH/workspace"
DSH_HOME="$DH" node "$DSH_ROOT/apps/cli/lib/bin.js" plugin --profile web add \
  --ignore-scripts "file:$SPIKE_DIR" >"$DH/plugin-add.log" 2>&1
cd "$DH/workspace"
exec env DSH_HOME="$DH" CAPABILITY_ADMISSION_SPIKE_RESULT="$DH/spike-host.json" \
  node "$DSH_ROOT/apps/cli/lib/bin.js" web --no-open --port "$PORT"
