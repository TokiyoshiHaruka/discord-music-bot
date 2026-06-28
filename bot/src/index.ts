import {
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  TextBasedChannel
} from "discord.js";
import { LavalinkManager } from "lavalink-client";
import { config } from "./config.js";
import { commands } from "./commands.js";
import { REST, Routes } from "discord.js";

type AnyPlayer = any;
type AnyTrack = any;

const idleLeaveMs = 10 * 60 * 1000;
const idleLeaveTimers = new Map<string, NodeJS.Timeout>();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const lavalink = new LavalinkManager({
  nodes: [
    {
      id: "1panel-lavalink",
      host: config.lavalinkHost,
      port: config.lavalinkPort,
      authorization: config.lavalinkPassword
    }
  ],
  sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
  autoSkip: true,
  client: {
    id: config.clientId,
    username: "DiscordMusicBot"
  },
  playerOptions: {
    defaultSearchPlatform: "ytsearch",
    onDisconnect: {
      autoReconnect: false,
      destroyPlayer: true
    }
  }
} as any);

client.on("raw", (packet) => lavalink.sendRawData(packet as any));

client.once("clientReady", async () => {
  if (!client.user) return;
  await registerCommands().catch((error) => {
    console.error("Slash command registration failed. Check the App install and DISCORD_GUILD_ID.", error);
  });
  await lavalink.init({ id: client.user.id, username: client.user.username } as any);
  console.log(`Logged in as ${client.user.tag}`);
});

lavalink.nodeManager.on("connect", (node: any) => {
  console.log(`Lavalink node connected: ${node.id}`);
});

lavalink.nodeManager.on("error", (node: any, error: Error) => {
  console.error(`Lavalink node error on ${node.id}:`, error);
});

lavalink.on("trackStart", async (player: AnyPlayer, track: AnyTrack) => {
  clearIdleLeaveTimer(player.guildId);
  await applyAudioNormalization(player);
  await sendPlayerEmbed(player, playbackEmbed("✅ Music started", track));
});

lavalink.on("trackError", async (player: AnyPlayer, track: AnyTrack, payload: any) => {
  console.error("Track error:", payload);
  await sendPlayerEmbed(player, playbackEmbed("❌ Music error, trying next track", track));
});

lavalink.on("queueEnd", async (player: AnyPlayer) => {
  await sendPlayerEmbed(
    player,
    baseEmbed("Audio player").setDescription("✅ Queue ended\nI will leave the voice channel if there are no new requests for 10 minutes")
  );
  scheduleIdleLeave(player);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply();

    switch (interaction.commandName) {
      case "play":
        await handlePlay(interaction);
        break;
      case "queue":
      case "list":
        await handleQueue(interaction);
        break;
      case "nowplay":
        await handleNowPlay(interaction);
        break;
      case "skip":
        await withPlayer(interaction, async (player) => {
          await player.skip();
          await interaction.editReply({ embeds: [baseEmbed("Play Command").setDescription("✅ Skipped the current track")] });
        });
        break;
      case "stop":
        await withPlayer(interaction, async (player) => {
          clearIdleLeaveTimer(interaction.guildId!);
          await player.stopPlaying(true, false);
          await interaction.editReply({
            embeds: [baseEmbed("Audio player").setDescription("✅ Stopped playback and cleared the queue")]
          });
        });
        break;
      case "leave":
        await withPlayer(interaction, async (player) => {
          clearIdleLeaveTimer(interaction.guildId!);
          await player.destroy("left by user");
          await interaction.editReply({
            embeds: [baseEmbed("Audio player").setDescription("❌ Left the voice channel and cleared the player")]
          });
        });
        break;
      case "resume":
        await withPlayer(interaction, async (player) => {
          await player.resume();
          await interaction.editReply({ embeds: [baseEmbed("Audio player").setDescription("✅ Resumed")] });
        });
        break;
      case "volum":
        await withPlayer(interaction, async (player) => {
          const percent = interaction.options.getInteger("percent", true);
          await player.setVolume(percent);
          await interaction.editReply({ embeds: [baseEmbed("Audio player").setDescription(`✅ Volume set to ${percent}%`)] });
        });
        break;
    }
  } catch (error) {
    console.error(error);
    const embed = baseEmbed("Play Command").setDescription(`❌ ${error instanceof Error ? error.message : "Command failed"}`);
    await interaction.editReply({ embeds: [embed] }).catch(() => undefined);
  }
});

async function handlePlay(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.guild) {
    throw new Error("This command only works inside a Discord server.");
  }

  const query = normalizeUserQuery(interaction.options.getString("query", true));
  if (isUnsupportedMusicLink(query)) {
    throw new Error("Bilibili and NetEase Cloud Music links are not supported.");
  }
  clearIdleLeaveTimer(interaction.guildId);

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    throw new Error("Join a voice channel first.");
  }

  const permissions = voiceChannel.permissionsFor(client.user!);
  if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
    throw new Error("I need Connect and Speak permissions in your voice channel.");
  }

  await interaction.editReply({
    embeds: [baseEmbed("Play Command").setDescription(`✅ Searching with the keyword: ${query}`)]
  });

  const player = lavalink.createPlayer({
    guildId: interaction.guildId,
    voiceChannelId: voiceChannel.id,
    textChannelId: interaction.channelId,
    selfDeaf: false,
    selfMute: false,
    volume: config.defaultVolume
  } as any);

  if (!player.connected) {
    await player.connect();
  }

  const result = await searchWithFallback(player, query, interaction.user);
  const tracks = getTracks(result);

  if (!tracks.length) {
    throw new Error("No playable music found for that link or keyword.");
  }

  const firstTrack = tracks[0];
  player.queue.add(firstTrack);

  const queuedCount = player.queue.tracks.length + (player.queue.current ? 1 : 0);
  const description = [
    "✅ Added the song to the request queue",
    "",
    `song: ${linkTrack(firstTrack)}`,
    `Songs on the queue: ${queuedCount}`,
    `Request number: ${Math.max(1, queuedCount)}`,
    `Requested by: ${interaction.user}`
  ].join("\n");

  const embed = baseEmbed("Play Command")
    .setDescription(description)
    .setThumbnail(trackArtwork(firstTrack) ?? null);

  await interaction.followUp({ embeds: [embed] });

  if (!player.playing && !player.paused) {
    await player.play();
  }
}

async function handleQueue(interaction: ChatInputCommandInteraction) {
  await withPlayer(interaction, async (player) => {
    const current = player.queue.current;
    const upcoming = player.queue.tracks.slice(0, 10);
    const lines = [
      current ? `Now: ${trackTitle(current)} (${formatDuration(trackDuration(current))})` : "Now: nothing",
      ...upcoming.map((track: AnyTrack, index: number) => `${index + 1}. ${trackTitle(track)} (${formatDuration(trackDuration(track))})`)
    ];

    await interaction.editReply({
      embeds: [
        baseEmbed("Music Queue").setDescription(lines.join("\n")).setFooter({
          text: upcoming.length < player.queue.tracks.length ? `Showing 10 of ${player.queue.tracks.length}` : `${player.queue.tracks.length} queued`
        })
      ]
    });
  });
}

async function handleNowPlay(interaction: ChatInputCommandInteraction) {
  await withPlayer(interaction, async (player) => {
    const current = player.queue.current;
    if (!current) {
      await interaction.editReply({ embeds: [baseEmbed("Now Playing").setDescription("There is no track playing right now.")] });
      return;
    }

    await interaction.editReply({ embeds: [playbackEmbed("✅ Now playing", current)] });
  });
}

async function withPlayer(interaction: ChatInputCommandInteraction, action: (player: AnyPlayer) => Promise<void>) {
  if (!interaction.guildId) {
    throw new Error("This command only works inside a Discord server.");
  }

  const player = lavalink.getPlayer(interaction.guildId);
  if (!player) {
    throw new Error("There is no active player in this server.");
  }

  await action(player);
}

function scheduleIdleLeave(player: AnyPlayer) {
  const guildId = player.guildId;
  if (!guildId) return;

  clearIdleLeaveTimer(guildId);
  const timer = setTimeout(async () => {
    const currentPlayer = lavalink.getPlayer(guildId);
    if (!currentPlayer) return;

    const queuedTracks = currentPlayer.queue?.tracks?.length ?? 0;
    if (currentPlayer.playing || currentPlayer.paused || currentPlayer.queue?.current || queuedTracks > 0) return;

    await sendPlayerEmbed(
      currentPlayer,
      baseEmbed("Audio player").setDescription("❌ Leaving the voice channel\nsince there were no song requests for 10 minutes")
    );
    await currentPlayer.destroy("idle timeout");
    idleLeaveTimers.delete(guildId);
  }, idleLeaveMs);

  idleLeaveTimers.set(guildId, timer);
}

function clearIdleLeaveTimer(guildId: string | undefined | null) {
  if (!guildId) return;
  const timer = idleLeaveTimers.get(guildId);
  if (!timer) return;
  clearTimeout(timer);
  idleLeaveTimers.delete(guildId);
}

async function applyAudioNormalization(player: AnyPlayer) {
  const filterManager = player.filterManager;
  if (!filterManager) return;

  try {
    // Pre-gain lifts quiet uploads, then LavaDSPX normalization catches sharp peaks.
    filterManager.data.volume = config.audioNormalizationPreGain;
    filterManager.filters.volume = config.audioNormalizationPreGain !== 1;
    filterManager.equalizerBands = [];
    filterManager.data.pluginFilters = {
      ...(filterManager.data.pluginFilters ?? {}),
      normalization: {
        adaptive: true,
        maxAmplitude: config.audioNormalizationMaxAmplitude
      }
    };
    filterManager.checkFiltersState();
    await filterManager.applyPlayerFilters();
  } catch (error) {
    console.warn("Could not apply audio normalization filters:", error);
  }
}

async function searchWithFallback(player: AnyPlayer, query: string, requester: unknown) {
  const metadataQuery = isUrl(query) ? await searchQueryFromSharedLink(query) : undefined;
  const candidates = isUrl(query)
    ? buildUrlSearchCandidates(query, metadataQuery)
    : musicSearchCandidates(query);

  for (const candidate of candidates) {
    const result = await player.search(candidate, requester, false);
    if (getTracks(result).length) {
      return result;
    }
  }

  return { tracks: [] };
}

function buildUrlSearchCandidates(rawUrl: string, metadataQuery: string | undefined): string[] {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  const isMusicMetadataLink =
    host === "open.spotify.com" ||
    host.endsWith(".open.spotify.com") ||
    host === "music.apple.com" ||
    host.endsWith(".music.apple.com");

  if (isMusicMetadataLink) {
    return [...musicSearchCandidates(metadataQuery), rawUrl].filter(Boolean) as string[];
  }

  if (isYouTubeLink(host)) {
    return [normalizeYouTubeUrl(url), ...musicSearchCandidates(metadataQuery)].filter(Boolean) as string[];
  }

  return [rawUrl, ...musicSearchCandidates(metadataQuery), `ytsearch:${rawUrl}`].filter(Boolean) as string[];
}

function musicSearchCandidates(query: string | undefined): string[] {
  if (!query) return [];
  return [`ytmsearch:${query}`, `ytsearch:${query}`];
}

function normalizeUserQuery(value: string) {
  return value.trim();
}

function isUnsupportedMusicLink(value: string) {
  const normalized = looksLikeBareUnsupportedUrl(value) ? `https://${value}` : value;
  if (!isUrl(normalized)) return false;
  const host = new URL(normalized).hostname.toLowerCase();
  return isUnsupportedMusicHost(host);
}

function looksLikeBareUnsupportedUrl(value: string) {
  return /^(?:www\.)?(?:bilibili\.com|b23\.tv|music\.163\.com|y\.music\.163\.com|m\.music\.163\.com)\//i.test(value);
}

function isUnsupportedMusicHost(host: string) {
  return (
    host === "bilibili.com" ||
    host.endsWith(".bilibili.com") ||
    host === "b23.tv" ||
    host === "music.163.com" ||
    host === "y.music.163.com" ||
    host === "m.music.163.com"
  );
}

function isYouTubeLink(host: string) {
  return host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be";
}

function normalizeYouTubeUrl(url: URL) {
  if (url.hostname.toLowerCase() === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? `https://www.youtube.com/watch?v=${id}` : url.toString();
  }

  const videoId = url.searchParams.get("v");
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : url.toString();
}

async function searchQueryFromSharedLink(rawUrl: string): Promise<string | undefined> {
  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase();
  const isSpotify = host === "open.spotify.com" || host.endsWith(".open.spotify.com");
  const isAppleMusic = host === "music.apple.com" || host.endsWith(".music.apple.com");
  const isSupportedPreviewPage = isSpotify || isAppleMusic;

  if (!isSupportedPreviewPage) return undefined;

  if (isAppleMusic) {
    const appleQuery = await searchQueryFromAppleMusic(url);
    if (appleQuery) return appleQuery;
  }

  if (isSpotify) {
    const spotifyQuery = await searchQueryFromSpotify(rawUrl);
    if (spotifyQuery) return spotifyQuery;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(rawUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; DiscordMusicBot/0.1; +https://discord.com/developers/docs/intro)"
      },
      signal: controller.signal,
      redirect: "follow"
    });

    if (!response.ok) return undefined;

    const html = (await response.text()).slice(0, 600_000);
    return rejectPollutedMusicTitle(normalizePreviewTitle(extractPreviewTitle(html), host));
  } catch (error) {
    console.warn(`Could not read preview metadata for ${host}:`, error);
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchQueryFromAppleMusic(url: URL): Promise<string | undefined> {
  const trackId = url.searchParams.get("i") ?? lastNumericPathPart(url);
  if (!trackId) return undefined;

  const country = appleMusicCountry(url);
  const lookupUrl = new URL("https://itunes.apple.com/lookup");
  lookupUrl.searchParams.set("id", trackId);
  lookupUrl.searchParams.set("country", country);
  lookupUrl.searchParams.set("entity", "song");

  try {
    const response = await fetchJsonWithTimeout(lookupUrl.toString());
    const result = Array.isArray(response?.results)
      ? response.results.find((item: any) => item.wrapperType === "track" || item.kind === "song") ?? response.results[0]
      : undefined;

    const trackName = cleanMusicSearchPart(result?.trackName);
    const artistName = cleanMusicSearchPart(result?.artistName);

    return joinSearchParts(trackName, artistName);
  } catch (error) {
    console.warn(`Could not read Apple Music lookup metadata for ${url.toString()}:`, error);
    return undefined;
  }
}

async function searchQueryFromSpotify(rawUrl: string): Promise<string | undefined> {
  const oembedUrl = new URL("https://open.spotify.com/oembed");
  oembedUrl.searchParams.set("url", rawUrl);

  try {
    const response = await fetchJsonWithTimeout(oembedUrl.toString());
    return rejectPollutedMusicTitle(normalizePreviewTitle(response?.title, "open.spotify.com"));
  } catch (error) {
    console.warn(`Could not read Spotify oEmbed metadata for ${rawUrl}:`, error);
    return undefined;
  }
}

async function fetchJsonWithTimeout(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      headers: {
        "accept": "application/json",
        "user-agent":
          "Mozilla/5.0 (compatible; DiscordMusicBot/0.1; +https://discord.com/developers/docs/intro)"
      },
      signal: controller.signal,
      redirect: "follow"
    });

    if (!response.ok) return undefined;
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function appleMusicCountry(url: URL) {
  const pathCountry = url.pathname.split("/").filter(Boolean)[0];
  return /^[a-z]{2}$/i.test(pathCountry ?? "") ? pathCountry.toUpperCase() : "JP";
}

function lastNumericPathPart(url: URL) {
  return url.pathname
    .split("/")
    .filter(Boolean)
    .reverse()
    .find((part) => /^\d+$/.test(part));
}

function cleanMusicSearchPart(value: unknown) {
  return typeof value === "string"
    ? value
        .replace(/\s+/g, " ")
        .replace(/\s*-\s*Single\s*$/i, "")
        .replace(/\s*-\s*EP\s*$/i, "")
        .trim()
    : undefined;
}

function joinSearchParts(...parts: Array<string | undefined>) {
  const query = parts.filter(Boolean).join(" ");
  return query.length >= 2 ? query : undefined;
}

function rejectPollutedMusicTitle(value: string | undefined) {
  if (!value) return undefined;

  const pollutedPatterns = [
    /apple music/i,
    /spotify/i,
    /hi[-\s]?res/i,
    /攻略/,
    /字幕/,
    /教學/,
    /教程/
  ];

  return pollutedPatterns.some((pattern) => pattern.test(value)) ? undefined : value;
}

function extractPreviewTitle(html: string): string | undefined {
  const candidates = [
    /<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:title["']/i,
    /<meta\s+(?:property|name)=["']twitter:title["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']twitter:title["']/i,
    /<title>([^<]+)<\/title>/i
  ];

  for (const pattern of candidates) {
    const value = html.match(pattern)?.[1];
    if (value) return decodeHtml(value);
  }

  return undefined;
}

function normalizePreviewTitle(title: string | undefined, host: string): string | undefined {
  if (!title) return undefined;

  let value = title
    .replace(/\s+/g, " ")
    .replace(/\s*[-|]\s*Spotify\s*$/i, "")
    .replace(/\s*[-|]\s*Apple Music\s*$/i, "")
    .replace(/\s+on Apple Music\s*$/i, "")
    .trim();

  if (host.includes("spotify")) {
    value = value
      .replace(/^Spotify\s*[-|]\s*/i, "")
      .replace(/\s+song by\s+/i, " ")
      .replace(/\s+album by\s+/i, " ")
      .replace(/\s+playlist by\s+/i, " ");
  }

  return value.length >= 2 ? value : undefined;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getTracks(result: any): AnyTrack[] {
  if (!result) return [];
  if (Array.isArray(result.tracks)) return result.tracks;
  if (Array.isArray(result.playlist?.tracks)) return result.playlist.tracks;
  if (result.track) return [result.track];
  return [];
}

function baseEmbed(title: string) {
  return new EmbedBuilder().setTitle(title).setColor(0x2b7fff).setTimestamp(new Date());
}

function playbackEmbed(status: string, track: AnyTrack) {
  const embed = baseEmbed("Play Command")
    .setDescription(
      [
        status,
        "",
        `title: ${linkTrack(track)}`,
        `Duration: ${formatDuration(trackDuration(track))}`,
        `Requested by: ${track.requester ? `<@${track.requester.id ?? track.requester}>` : "unknown"}`
      ].join("\n")
    );

  const artwork = trackArtwork(track);
  if (artwork) embed.setThumbnail(artwork);
  return embed;
}

async function sendPlayerEmbed(player: AnyPlayer, embed: EmbedBuilder) {
  if (!player.textChannelId) return;
  const channel = await client.channels.fetch(player.textChannelId).catch(() => null);
  if (channel?.isTextBased() && "send" in channel) {
    await channel.send({ embeds: [embed] }).catch(() => undefined);
  }
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: commands });
  console.log(`Registered ${commands.length} slash commands.`);
}

function isUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function linkTrack(track: AnyTrack) {
  const title = trackTitle(track);
  const uri = track.info?.uri ?? track.uri;
  return uri ? `[${escapeMarkdown(title)}](${uri})` : escapeMarkdown(title);
}

function trackTitle(track: AnyTrack) {
  return track.info?.title ?? track.title ?? "Unknown title";
}

function trackArtwork(track: AnyTrack) {
  return track.info?.artworkUrl ?? track.info?.thumbnail ?? track.artworkUrl ?? track.thumbnail;
}

function trackDuration(track: AnyTrack) {
  return Number(track.info?.duration ?? track.info?.length ?? track.duration ?? 0);
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "live";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}

client.login(config.discordToken);
