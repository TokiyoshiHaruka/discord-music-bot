import "dotenv/config";

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value || value.startsWith("replace-with-")) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value || undefined;
}

function optionalNumber(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = optional(env, name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function optionalPort(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = optional(env, name);
  if (raw === undefined || !/^\d+$/.test(raw)) return fallback;

  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= 65535 ? value : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    discordToken: required(env, "DISCORD_TOKEN"),
    clientId: required(env, "DISCORD_CLIENT_ID"),
    guildId: optional(env, "DISCORD_GUILD_ID"),
    lavalinkHost: optional(env, "LAVALINK_HOST") ?? "discord-lavalink",
    lavalinkPort: optionalPort(env, "LAVALINK_PORT", 2333),
    lavalinkPassword: required(env, "LAVALINK_PASSWORD"),
    defaultVolume: optionalNumber(env, "DEFAULT_VOLUME", 80, 1, 150),
    audioNormalizationPreGain: optionalNumber(env, "AUDIO_NORMALIZATION_PRE_GAIN", 1.3, 0.5, 3),
    audioNormalizationMaxAmplitude: optionalNumber(env, "AUDIO_NORMALIZATION_MAX_AMPLITUDE", 0.65, 0.05, 1),
    logLevel: optional(env, "LOG_LEVEL") ?? "info"
  };
}
