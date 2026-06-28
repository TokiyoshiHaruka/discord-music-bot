<p align="center">
  <h1 align="center">Discord Music Bot for 1Panel</h1>
</p>

<p align="center">
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/Language-%E4%B8%AD%E6%96%87-red?style=for-the-badge" alt="Chinese README"></a>
  <img src="https://img.shields.io/badge/Discord.js-14-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="discord.js 14">
  <img src="https://img.shields.io/badge/Lavalink-v4-2B7FFF?style=for-the-badge" alt="Lavalink v4">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

A self-hosted Discord App music bot designed for a 1Panel Docker layout. It joins a server voice channel, accepts slash commands, queues one track at a time from shared links or search keywords, and plays through Lavalink.

The bot is built for a real Discord Developer Portal App, not a temporary toy bot. It uses Discord slash commands, `discord.js`, Lavalink v4, LavaSrc metadata resolution, the official Lavalink YouTube plugin, and LavaDSPX audio normalization.

## Features

| Area | What it does |
| --- | --- |
| Discord App flow | Uses a real Discord Developer Portal App with `bot` and `applications.commands` install scopes. |
| Voice playback | Joins the caller's voice channel and plays audio through Lavalink. |
| Search and links | Supports YouTube links, YouTube Music/YouTube keyword search, Apple Music links, and Spotify links. |
| Metadata fallback | Apple Music and Spotify links are converted to a track/artist query first, then searched on YouTube Music and YouTube. |
| Queue control | Provides play, queue/list, now playing, skip, stop, leave, resume, and volume commands. |
| Audio normalization | Applies pre-gain plus LavaDSPX normalization to reduce loudness jumps between uploads. |
| Idle behavior | Stays in the voice channel after the queue ends, then leaves after 10 minutes without new requests. |
| 1Panel layout | Compose file follows a `/opt/1panel/apps/<app>/<instance>` style and uses the external `1panel-network`. |

## Current Source Support

| Input | Status | Notes |
| --- | --- | --- |
| YouTube video URL | Supported | Normalizes `youtu.be` and `youtube.com/watch?v=...` to a single video URL. |
| Search keywords | Supported | Searches YouTube Music first, then YouTube. |
| Apple Music share URL | Supported via metadata search | Uses Apple/iTunes public lookup when possible, then falls back to preview metadata and YouTube search. |
| Spotify share URL | Supported via metadata search | Uses Spotify oEmbed when possible, then falls back to preview metadata and YouTube search. |
| Bilibili URL | Not supported | The bot rejects these links with a clear message. |
| NetEase Cloud Music URL | Not supported | The bot rejects these links with a clear message. |

Apple Music and Spotify API credentials are optional for this project. The bot can still use public metadata and search fallback, but official credentials may improve LavaSrc behavior in some deployments.

## Quick Start

### 1. Create the Discord App

1. Open Discord Developer Portal and create an application.
2. In the Bot page, create/reset the bot token.
3. In Installation, enable Guild Install.
4. Add the scopes `bot` and `applications.commands`.
5. Grant these permissions:
   - View Channels
   - Send Messages
   - Embed Links
   - Use Slash Commands
   - Connect
   - Speak
6. Install the App into the target Discord server.

### 2. Deploy with 1Panel-style Docker Compose

Place the repository under your 1Panel app directory, for example:

```bash
mkdir -p /opt/1panel/apps/discord-music-bot/discord-music-bot
cd /opt/1panel/apps/discord-music-bot/discord-music-bot
```

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` and fill at least:

```env
DISCORD_TOKEN=replace-with-discord-bot-token
DISCORD_CLIENT_ID=replace-with-discord-application-id
LAVALINK_PASSWORD=replace-with-a-long-random-password
```

For instant slash command updates during testing, set `DISCORD_GUILD_ID` to your Discord server ID. Leave it empty for global commands.

Start the stack:

```bash
docker compose up -d --build
```

Watch logs:

```bash
docker logs --tail 100 1Panel-discord-music-bot
docker logs --tail 100 1Panel-discord-music-bot-lavalink
```

## Commands

| Command | Description |
| --- | --- |
| `/play query:<text-or-url>` | Search or play a single song from keywords, YouTube, Apple Music, or Spotify. |
| `/queue` | Show the current queue. |
| `/list` | Alias for `/queue`. |
| `/nowplay` | Show the currently playing track. |
| `/skip` | Skip the current track. |
| `/stop` | Stop playback and clear the queue, while staying in voice. |
| `/leave` | Leave the voice channel and clear the player. |
| `/resume` | Resume playback. |
| `/volum percent:<1-150>` | Set Lavalink playback volume. The spelling is intentionally kept as `volum` for the current deployed command set. |

## Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes | none | Discord Bot Token from Developer Portal. Keep it secret. |
| `DISCORD_CLIENT_ID` | Yes | none | Discord Application ID. |
| `DISCORD_GUILD_ID` | No | empty | Guild-specific command registration for fast testing. Empty means global commands. |
| `LAVALINK_HOST` | No | `discord-lavalink` | Internal Lavalink service hostname. |
| `LAVALINK_PORT` | No | `2333` | Internal Lavalink HTTP/WebSocket port. |
| `LAVALINK_PASSWORD` | Yes | none | Shared password between bot and Lavalink. Keep it secret. |
| `SPOTIFY_CLIENT_ID` | No | empty | Optional Spotify client ID for LavaSrc. |
| `SPOTIFY_CLIENT_SECRET` | No | empty | Optional Spotify client secret for LavaSrc. Keep it secret. |
| `APPLE_MUSIC_MEDIA_API_TOKEN` | No | empty | Optional Apple Music API token for LavaSrc. Keep it secret. |
| `DEFAULT_VOLUME` | No | `80` | Initial player volume, clamped from 1 to 150. |
| `AUDIO_NORMALIZATION_PRE_GAIN` | No | `1.3` | Filter pre-gain used to lift quiet uploads. |
| `AUDIO_NORMALIZATION_MAX_AMPLITUDE` | No | `0.65` | LavaDSPX normalization peak limit. |
| `LOG_LEVEL` | No | `info` | Reserved app log level setting. |
| `CONTAINER_NAME` | No | `1Panel-discord-music-bot` | Compose container name prefix. |
| `CPUS` | No | `0` | 1Panel/Compose CPU limit value. |
| `MEMORY_LIMIT` | No | `0` | 1Panel/Compose memory limit value. |

## Architecture

```text
Discord slash command
        |
        v
discord.js bot container
        |
        | Lavalink v4 REST/WebSocket
        v
Lavalink container
        |
        | YouTube plugin / LavaSrc / LavaDSPX
        v
Discord voice channel
```

The bot container is the only service that talks to Discord and Lavalink. Lavalink is attached to the same Docker network and is not published to the public internet by default.

### Important files

| Path | Purpose |
| --- | --- |
| `bot/src/index.ts` | Discord event handling, playback flow, queue control, search fallback, embeds, idle leave timer. |
| `bot/src/commands.ts` | Slash command definitions. |
| `bot/src/config.ts` | Environment variable parsing and safe defaults. |
| `lavalink/application.yml` | Lavalink sources, plugins, filters, and LavaSrc configuration. |
| `docker-compose.yml` | 1Panel-style service definitions and `1panel-network` integration. |
| `data.yml` | 1Panel form metadata for environment variables. |

## Troubleshooting

### Slash commands do not show up

- Set `DISCORD_GUILD_ID` during testing and restart the bot.
- Confirm the App was installed with `applications.commands`.
- Check bot logs for `Registered 9 slash commands`.

### The bot joins but no audio plays

- Confirm the bot has Connect and Speak permissions in the voice channel.
- Check Lavalink logs for source errors.
- Try a simple YouTube link first, then test Apple Music or Spotify.

### Apple Music or Spotify resolves the wrong song

The bot does not stream directly from Apple Music or Spotify. It extracts metadata and searches YouTube Music/YouTube. If a share link has poor metadata or the search result is noisy, use `/play` with direct song and artist keywords.

### Tracks have uneven volume

The bot applies a Lavalink filter chain:

```env
AUDIO_NORMALIZATION_PRE_GAIN=1.3
AUDIO_NORMALIZATION_MAX_AMPLITUDE=0.65
```

Raise `AUDIO_NORMALIZATION_PRE_GAIN` slightly if quiet tracks are still too quiet. Lower `AUDIO_NORMALIZATION_MAX_AMPLITUDE` if loud tracks still feel too sharp.

### Bilibili or NetEase links fail

This is expected in the current release. Those sources are intentionally disabled because reliable extraction and playback require extra source-specific handling.

## Security

- Do not commit `.env`.
- Do not commit Discord tokens, GitHub tokens, API keys, SSH keys, or production passwords.
- Rotate any token that has ever been shared in chat or committed to Git.
- Keep Lavalink internal to Docker; do not expose port `2333` to the public internet unless you know how to secure it.
- See [SECURITY.md](SECURITY.md) for the secret rotation checklist.

## Development

Install dependencies and build the bot:

```bash
cd bot
npm install
npm run build
```

Run locally against a reachable Lavalink node:

```bash
cp ../.env.example ../.env
npm run dev
```

## License

MIT. See [LICENSE](LICENSE).
