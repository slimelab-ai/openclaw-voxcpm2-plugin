#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/slimelab-ai/openclaw-voxcpm2-plugin"
TMPDIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

echo "Cloning $REPO_URL ..."
git clone "$REPO_URL" "$TMPDIR/openclaw-voxcpm2-plugin"

EXISTING_PLUGIN_ENTRY_JSON="$(python3 - <<'PY'
import json
from pathlib import Path
p = Path.home() / '.openclaw' / 'openclaw.json'
try:
    cfg = json.loads(p.read_text())
except Exception:
    print('{}')
    raise SystemExit(0)
entry = (((cfg.get('plugins') or {}).get('entries') or {}).get('voxcpm2') or {})
print(json.dumps(entry))
PY
)"

echo "Installing plugin from fresh clone ..."
openclaw plugins install --force "$TMPDIR/openclaw-voxcpm2-plugin"

echo "Restoring voxcpm2 plugin config ..."
python3 - <<'PY' "$EXISTING_PLUGIN_ENTRY_JSON"
import json, sys
from pathlib import Path
entry = json.loads(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1] else {}
p = Path.home() / '.openclaw' / 'openclaw.json'
try:
    cfg = json.loads(p.read_text())
except Exception:
    cfg = {}
plugins = cfg.setdefault('plugins', {})
entries = plugins.setdefault('entries', {})
current = entries.get('voxcpm2') or {}
merged = dict(current)
merged.update(entry)
current_config = current.get('config') or {}
entry_config = entry.get('config') or {}
if current_config or entry_config:
    merged['config'] = dict(current_config)
    merged['config'].update(entry_config)
merged['enabled'] = entry.get('enabled', True)
entries['voxcpm2'] = merged
p.write_text(json.dumps(cfg, indent=2) + '\n')
PY

echo "Enabling voxcpm2 plugin ..."
openclaw config set plugins.entries.voxcpm2.enabled true

echo "Restarting gateway ..."
openclaw gateway restart

echo "Done."
echo "If needed, set the VoxCPM2 server URL with:"
echo "  openclaw config set plugins.entries.voxcpm2.config.baseUrl http://127.0.0.1:7861"
