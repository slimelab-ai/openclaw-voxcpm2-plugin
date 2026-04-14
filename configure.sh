#!/usr/bin/env bash
# Interactive configuration script for openclaw-voxcpm2-plugin
# Usage: ./configure.sh [--update]
#   --update    Show current values as defaults, allow empty to keep existing

set -euo pipefail

PLUGIN_ID="voxcpm2"
CONFIG_PREFIX="plugins.entries.${PLUGIN_ID}.config"

# Check if openclaw is available
if ! command -v openclaw &> /dev/null; then
    echo "Error: openclaw command not found in PATH"
    exit 1
fi

# Helper to get current config value (returns empty if not set)
get_current() {
    local key="$1"
    openclaw config get "${CONFIG_PREFIX}.${key}" 2>/dev/null || echo ""
}

# Helper to set config value
set_config() {
    local key="$1"
    local value="$2"
    openclaw config set "${CONFIG_PREFIX}.${key}" "$value"
}

# Default values
DEFAULT_BASE_URL="http://127.0.0.1:7861"
DEFAULT_VOICE_PROMPT="A deep male voice, slow and friendly"
DEFAULT_CFG_VALUE="2.0"
DEFAULT_TIMESTEPS="10"
DEFAULT_FORMAT="wav"

# Check if we're in update mode
UPDATE_MODE=false
if [[ "${1:-}" == "--update" ]]; then
    UPDATE_MODE=true
fi

# Get existing values if any
echo "=== VoxCPM2 Plugin Configuration ==="
echo ""

if $UPDATE_MODE; then
    echo "Update mode - press Enter to keep existing values shown in [brackets]"
    echo ""
fi

# Read current values or use defaults
CURRENT_BASE_URL=$(get_current "baseUrl")
CURRENT_VOICE_PROMPT=$(get_current "defaultVoicePrompt")
CURRENT_CFG=$(get_current "defaultCfgValue")
CURRENT_TIMESTEPS=$(get_current "defaultInferenceTimesteps")
CURRENT_FORMAT=$(get_current "defaultFormat")

# Prompt for base URL
if $UPDATE_MODE && [[ -n "$CURRENT_BASE_URL" ]]; then
    PROMPT="VoxCPM2 server URL [${CURRENT_BASE_URL}]: "
else
    PROMPT="VoxCPM2 server URL [${DEFAULT_BASE_URL}]: "
fi
read -rp "$PROMPT" BASE_URL
if [[ -z "$BASE_URL" ]]; then
    if $UPDATE_MODE && [[ -n "$CURRENT_BASE_URL" ]]; then
        BASE_URL="$CURRENT_BASE_URL"
    else
        BASE_URL="$DEFAULT_BASE_URL"
    fi
fi

# Prompt for voice prompt
if $UPDATE_MODE && [[ -n "$CURRENT_VOICE_PROMPT" ]]; then
    PROMPT="Default voice prompt [${CURRENT_VOICE_PROMPT}]: "
else
    PROMPT="Default voice prompt [${DEFAULT_VOICE_PROMPT}]: "
fi
read -rp "$PROMPT" VOICE_PROMPT
if [[ -z "$VOICE_PROMPT" ]]; then
    if $UPDATE_MODE && [[ -n "$CURRENT_VOICE_PROMPT" ]]; then
        VOICE_PROMPT="$CURRENT_VOICE_PROMPT"
    else
        VOICE_PROMPT="$DEFAULT_VOICE_PROMPT"
    fi
fi

# Prompt for CFG value
if $UPDATE_MODE && [[ -n "$CURRENT_CFG" ]]; then
    PROMPT="Default CFG value [${CURRENT_CFG}]: "
else
    PROMPT="Default CFG value [${DEFAULT_CFG_VALUE}]: "
fi
read -rp "$PROMPT" CFG_VALUE
if [[ -z "$CFG_VALUE" ]]; then
    if $UPDATE_MODE && [[ -n "$CURRENT_CFG" ]]; then
        CFG_VALUE="$CURRENT_CFG"
    else
        CFG_VALUE="$DEFAULT_CFG_VALUE"
    fi
fi

# Prompt for inference timesteps
if $UPDATE_MODE && [[ -n "$CURRENT_TIMESTEPS" ]]; then
    PROMPT="Default inference timesteps [${CURRENT_TIMESTEPS}]: "
else
    PROMPT="Default inference timesteps [${DEFAULT_TIMESTEPS}]: "
fi
read -rp "$PROMPT" TIMESTEPS
if [[ -z "$TIMESTEPS" ]]; then
    if $UPDATE_MODE && [[ -n "$CURRENT_TIMESTEPS" ]]; then
        TIMESTEPS="$CURRENT_TIMESTEPS"
    else
        TIMESTEPS="$DEFAULT_TIMESTEPS"
    fi
fi

# Prompt for output format
if $UPDATE_MODE && [[ -n "$CURRENT_FORMAT" ]]; then
    PROMPT="Default output format [${CURRENT_FORMAT}]: "
else
    PROMPT="Default output format [${DEFAULT_FORMAT}]: "
fi
read -rp "$PROMPT" FORMAT
if [[ -z "$FORMAT" ]]; then
    if $UPDATE_MODE && [[ -n "$CURRENT_FORMAT" ]]; then
        FORMAT="$CURRENT_FORMAT"
    else
        FORMAT="$DEFAULT_FORMAT"
    fi
fi

# Apply configuration
echo ""
echo "=== Applying configuration ==="

openclaw config set "plugins.entries.${PLUGIN_ID}.enabled" true
set_config "baseUrl" "$BASE_URL"
set_config "defaultVoicePrompt" "$VOICE_PROMPT"
set_config "defaultCfgValue" "$CFG_VALUE"
set_config "defaultInferenceTimesteps" "$TIMESTEPS"
set_config "defaultFormat" "$FORMAT"

echo ""
echo "=== Configuration complete ==="
echo ""
echo "Settings saved:"
echo "  Server URL: $BASE_URL"
echo "  Voice prompt: $VOICE_PROMPT"
echo "  CFG value: $CFG_VALUE"
echo "  Inference timesteps: $TIMESTEPS"
echo "  Output format: $FORMAT"
echo ""
echo "You can re-run this script anytime with:"
echo "  ./configure.sh --update"
