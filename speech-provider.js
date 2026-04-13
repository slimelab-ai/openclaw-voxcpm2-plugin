const DEFAULT_BASE_URL = "http://127.0.0.1:7861";
const DEFAULT_FORMAT = "wav";
const DEFAULT_CFG_VALUE = 2.0;
const DEFAULT_TIMEOUT_MS = 120000;

function resolveConfig(raw) {
  return raw || {};
}

function resolveBaseUrl(cfg, ctx) {
  const base = (cfg.baseUrl || DEFAULT_BASE_URL).trim();
  const clean = base.replace(/\/+$/u, "");
  ctx.logger?.debug?.(`voxcpm2: using baseUrl=${clean}`);
  return clean;
}

function buildHeaders(cfg) {
  const headers = {};
  if (cfg.apiKey) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  } else if (cfg.username && cfg.password) {
    const token = Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");
    headers.Authorization = `Basic ${token}`;
  }
  return headers;
}

function normalizeFormat(raw) {
  const format = (raw || DEFAULT_FORMAT).toString().trim().toLowerCase();
  if (["wav", "mp3", "flac"].includes(format)) return format;
  return DEFAULT_FORMAT;
}

function detectMimeType(format) {
  switch (format) {
    case "mp3":
      return "audio/mpeg";
    case "flac":
      return "audio/flac";
    case "wav":
    default:
      return "audio/wav";
  }
}

function decodeBase64Audio(encoded) {
  if (!encoded || typeof encoded !== "string") {
    throw new Error("VoxCPM2 response missing base64 audio payload");
  }
  return Buffer.from(encoded, "base64");
}

function buildTextWithVoicePrompt(text, voicePrompt) {
  const prompt = voicePrompt?.trim?.() ?? voicePrompt;
  const trimmedText = text?.trim?.() ?? text;
  if (!trimmedText) throw new Error("Missing text");
  if (!prompt) return trimmedText;
  return `(${prompt})${trimmedText}`;
}

function maybeSet(body, key, value) {
  if (value !== undefined && value !== null && value !== "") {
    body[key] = value;
  }
}

export function buildVoxCPM2SpeechProvider(ctx) {
  const cfg = resolveConfig(ctx.config);

  return {
    id: "voxcpm2",
    label: "VoxCPM2",
    isConfigured() {
      const baseUrl = (cfg.baseUrl || DEFAULT_BASE_URL).toString().trim();
      return Boolean(baseUrl);
    },
    getConfigSummary() {
      return {
        baseUrl: (cfg.baseUrl || DEFAULT_BASE_URL).toString().trim(),
        hasApiKey: Boolean(cfg.apiKey),
        hasBasicAuth: Boolean(cfg.username && cfg.password),
        defaultVoicePrompt: cfg.defaultVoicePrompt || undefined,
      };
    },
    async synthesize(request) {
      const baseUrl = resolveBaseUrl(cfg, ctx);
      const outputFormat = normalizeFormat(request.format || cfg.defaultFormat);
      const voicePrompt = request.voicePrompt || cfg.defaultVoicePrompt;
      const body = {
        text: buildTextWithVoicePrompt(request.text, voicePrompt),
      };

      maybeSet(body, "cfg_value", request.cfgValue ?? cfg.defaultCfgValue ?? DEFAULT_CFG_VALUE);
      maybeSet(body, "inference_timesteps", request.inferenceTimesteps ?? cfg.defaultInferenceTimesteps);
      maybeSet(body, "format", outputFormat);
      maybeSet(body, "seed", request.seed);

      const timeoutMs = request.timeoutMs ?? cfg.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let response;
      try {
        response = await fetch(`${baseUrl}/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...buildHeaders(cfg),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error(`VoxCPM2 request timed out after ${timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`VoxCPM2 request failed (${response.status}): ${text || response.statusText}`);
      }

      const payload = await response.json();
      const buffer = decodeBase64Audio(payload.audio);
      if (!buffer.length) {
        throw new Error("VoxCPM2 response contained no audio");
      }

      return {
        audio: {
          buffer,
          mimeType: detectMimeType(outputFormat),
          fileName: `voxcpm2.${outputFormat}`,
        },
        model: "voxcpm2",
        metadata: {
          voicePrompt: voicePrompt || undefined,
          cfgValue: body.cfg_value,
          inferenceTimesteps: body.inference_timesteps,
          format: outputFormat,
          provider: "voxcpm2",
          sampleRate: payload.sample_rate,
          duration: payload.duration,
        },
      };
    },
  };
}
