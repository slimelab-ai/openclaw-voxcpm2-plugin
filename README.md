# openclaw-voxcpm2-plugin

Local OpenClaw speech plugin that adds prompt-based TTS via a VoxCPM2 server.

It is designed for the same basic external-plugin workflow as the Slimelab A1111 plugin, but registers a speech provider instead of an image provider.

## What it does

- registers a `voxcpm2` speech provider
- sends TTS requests to a VoxCPM2 HTTP server, default `http://127.0.0.1:7861/tts`
- supports prompt-based voice design by prepending a voice prompt like `(A deep male voice, slow and friendly)` to the spoken text
- supports config defaults for voice prompt, CFG value, inference timesteps, and output format

## Install

### Normal install/update

```bash
TMPDIR="$(mktemp -d)" && trap 'rm -rf "$TMPDIR"' EXIT && git clone https://github.com/slimelab-ai/openclaw-voxcpm2-plugin "$TMPDIR/openclaw-voxcpm2-plugin" && openclaw plugins install --force "$TMPDIR/openclaw-voxcpm2-plugin"
```

### Local dev install

```bash
openclaw plugins install -l /path/to/openclaw-voxcpm2-plugin
```

### Repo-hosted installer script

```bash
curl -fsSL https://raw.githubusercontent.com/slimelab-ai/openclaw-voxcpm2-plugin/main/install.sh | bash
```

## Config

Example config:

```json5
{
  plugins: {
    entries: {
      voxcpm2: {
        enabled: true,
        config: {
          baseUrl: "http://127.0.0.1:7861",
          defaultVoicePrompt: "A deep male voice, slow and friendly",
          defaultCfgValue: 2.0,
          defaultInferenceTimesteps: 10,
          defaultFormat: "wav"
        }
      }
    }
  }
}
```

Set config from CLI:

```bash
openclaw config set plugins.entries.voxcpm2.enabled true
openclaw config set plugins.entries.voxcpm2.config.baseUrl http://127.0.0.1:7861
openclaw config set plugins.entries.voxcpm2.config.defaultVoicePrompt "A deep male voice, slow and friendly"
```

Depending on current OpenClaw speech-selection behavior, you may also need to point your default speech provider or TTS path at `voxcpm2` in main config.

## API expectations

This plugin currently expects a VoxCPM2-compatible HTTP endpoint at:

- `POST /tts`
- request body includes `text`
- optional fields include `cfg_value`, `inference_timesteps`, `format`, and `seed`
- response body is raw audio bytes

If the server contract differs, adjust `speech-provider.js` accordingly.

## Voice prompt behavior

If a voice prompt is provided, the plugin transforms input like:

- voice prompt: `A deep male voice, slow and friendly`
- text: `Is mayonnaise an instrument?`

into:

```text
(A deep male voice, slow and friendly)Is mayonnaise an instrument?
```

That matches the prompt style used in local VoxCPM2 experiments.
