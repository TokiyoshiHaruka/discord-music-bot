import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("replace-with-")) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function optionalNumber(name: string, fallback: number, min: number, max: number): number {
  const raw = optional(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

export const config = {
  discordToken: required("DISCORD_TOKEN"),
  clientId: required("DISCORD_CLIENT_ID"),
  guildId: optional("DISCORD_GUILD_ID"),
  lavalinkHost: optional("LAVALINK_HOST") ?? "discord-lavalink",
  lavalinkPort: Number(optional("LAVALINK_PORT") ?? 2333),
  lavalinkPassword: required("LAVALINK_PASSWORD"),
  defaultVolume: optionalNumber("DEFAULT_VOLUME", 80, 1, 150),
  audioNormalizationPreGain: optionalNumber("AUDIO_NORMALIZATION_PRE_GAIN", 1.3, 0.5, 3),
  audioNormalizationMaxAmplitude: optionalNumber("AUDIO_NORMALIZATION_MAX_AMPLITUDE", 0.65, 0.05, 1),
  logLevel: optional("LOG_LEVEL") ?? "info"
};
