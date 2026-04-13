import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { buildVoxCPM2SpeechProvider } from "./speech-provider.js";

export default definePluginEntry({
  id: "voxcpm2",
  name: "VoxCPM2",
  description: "Speech provider for VoxCPM2 prompt-based text to speech",
  register(api) {
    api.registerSpeechProvider(
      buildVoxCPM2SpeechProvider({
        config: api.pluginConfig || {},
        logger: api.logger,
      }),
    );
  },
});
