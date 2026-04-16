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
  if (["wav", "mp3", "flac", "pcm"].includes(format)) return format;
  return DEFAULT_FORMAT;
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

async function requestTts(ctx, cfg, body, timeoutMs) {
  const baseUrl = resolveBaseUrl(cfg, ctx);
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
  return { payload, buffer };
}

export function buildVoxCPM2SpeechProvider(ctx) {
  const cfg = resolveConfig(ctx.config);

  return {
    id: "voxcpm2",
    label: "VoxCPM2",
    isConfigured(_ctx) {
      const baseUrl = (cfg.baseUrl || DEFAULT_BASE_URL).toString().trim();
      return Boolean(baseUrl);
    },
    async synthesize(request) {
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
      const { buffer } = await requestTts(ctx, cfg, body, timeoutMs);

      return {
        audioBuffer: buffer,
        outputFormat,
        fileExtension: `.${outputFormat}`,
        voiceCompatible: false,
      };
    },
    async synthesizeTelephony(request) {
      const voicePrompt = cfg.telephonyVoicePrompt || cfg.defaultVoicePrompt;
      const body = {
        text: buildTextWithVoicePrompt(request.text, voicePrompt),
      };

      maybeSet(body, "cfg_value", cfg.telephonyCfgValue ?? cfg.defaultCfgValue ?? DEFAULT_CFG_VALUE);
      maybeSet(body, "inference_timesteps", cfg.telephonyInferenceTimesteps ?? cfg.defaultInferenceTimesteps);

      const timeoutMs = request.timeoutMs ?? cfg.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
      const { payload, buffer } = await requestTts(ctx, cfg, body, timeoutMs);
      const sampleRate = Number(payload.sample_rate);
      if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        throw new Error("VoxCPM2 telephony response missing valid sample_rate");
      }

      return {
        audioBuffer: buffer,
        outputFormat: "wav",
        sampleRate,
      };
    },
  };
}
