import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.ts";

function baseEnv(): NodeJS.ProcessEnv {
  return {
    DISCORD_TOKEN: "discord-token",
    DISCORD_CLIENT_ID: "client-id",
    LAVALINK_PASSWORD: "lavalink-password"
  };
}

test("loads safe defaults without reading the process environment", () => {
  const config = loadConfig(baseEnv());

  assert.equal(config.lavalinkHost, "discord-lavalink");
  assert.equal(config.lavalinkPort, 2333);
  assert.equal(config.defaultVolume, 80);
  assert.equal(config.audioNormalizationPreGain, 1.3);
  assert.equal(config.audioNormalizationMaxAmplitude, 0.65);
  assert.equal(config.logLevel, "info");
});

test("accepts a trimmed integer Lavalink port in the valid range", () => {
  const config = loadConfig({ ...baseEnv(), LAVALINK_PORT: " 2444 " });

  assert.equal(config.lavalinkPort, 2444);
});

test("falls back for malformed or out-of-range Lavalink ports", () => {
  for (const value of ["", "NaN", "80.5", "1e3", "0", "65536", "-1"]) {
    const config = loadConfig({ ...baseEnv(), LAVALINK_PORT: value });

    assert.equal(config.lavalinkPort, 2333, `unexpected port for ${value}`);
  }
});

test("rejects missing and placeholder required credentials", () => {
  for (const name of ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "LAVALINK_PASSWORD"]) {
    const missing = baseEnv();
    delete missing[name];
    assert.throws(() => loadConfig(missing), new RegExp(`Missing required environment variable: ${name}`));

    assert.throws(
      () => loadConfig({ ...baseEnv(), [name]: `replace-with-${name.toLowerCase()}` }),
      new RegExp(`Missing required environment variable: ${name}`),
    );
  }
});

test("clamps optional volume and normalization values to safe ranges", () => {
  const config = loadConfig({
    ...baseEnv(),
    DEFAULT_VOLUME: "999",
    AUDIO_NORMALIZATION_PRE_GAIN: "0.1",
    AUDIO_NORMALIZATION_MAX_AMPLITUDE: "2"
  });

  assert.equal(config.defaultVolume, 150);
  assert.equal(config.audioNormalizationPreGain, 0.5);
  assert.equal(config.audioNormalizationMaxAmplitude, 1);
});
