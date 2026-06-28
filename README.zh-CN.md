<p align="center">
  <h1 align="center">Discord Music Bot for 1Panel</h1>
</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/Language-English-blue?style=for-the-badge" alt="English README"></a>
  <img src="https://img.shields.io/badge/Discord.js-14-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="discord.js 14">
  <img src="https://img.shields.io/badge/Lavalink-v4-2B7FFF?style=for-the-badge" alt="Lavalink v4">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

这是一个面向 1Panel Docker 目录结构的自托管 Discord App 音乐机器人。它通过 Discord 斜杠命令工作，进入服务器语音频道，用 Lavalink 播放音乐，并提供队列、跳过、停止、离开、恢复、音量和当前播放信息等控制。

这个项目按正式 Discord Developer Portal App 流程设计，不是临时测试 Bot。技术栈包括 `discord.js`、Lavalink v4、LavaSrc、Lavalink YouTube 插件和 LavaDSPX 音量归一化滤镜。

## 功能概览

| 模块 | 说明 |
| --- | --- |
| Discord App 流程 | 使用正式 Discord Developer Portal App，安装 scopes 为 `bot` 和 `applications.commands`。 |
| 语音播放 | 自动进入调用者所在语音频道，通过 Lavalink 播放音频。 |
| 搜索和链接 | 支持 YouTube 链接、YouTube Music/YouTube 关键词搜索、Apple Music 分享链接、Spotify 分享链接。 |
| 元数据回退 | Apple Music 和 Spotify 链接会先提取歌曲/歌手信息，再去 YouTube Music 和 YouTube 搜索播放。 |
| 队列控制 | 提供播放、队列、当前播放、跳过、停止、离开、恢复、音量等命令。 |
| 音量均衡 | 使用预增益加 LavaDSPX normalization，缓解不同上传源音量忽大忽小的问题。 |
| 空闲离开 | 队列结束后不会立刻退出，10 分钟内无人继续点歌才离开语音频道。 |
| 1Panel 结构 | Compose 文件贴合 `/opt/1panel/apps/<应用名>/<实例名>` 风格，并接入外部 `1panel-network`。 |

## 当前音源支持

| 输入 | 状态 | 说明 |
| --- | --- | --- |
| YouTube 视频链接 | 支持 | 会规范化 `youtu.be` 和 `youtube.com/watch?v=...`。 |
| 关键词搜索 | 支持 | 优先搜索 YouTube Music，再回退到 YouTube。 |
| Apple Music 分享链接 | 支持元数据搜索 | 尽量用 Apple/iTunes 公开 lookup 获取歌曲信息，再回退到页面预览元数据和 YouTube 搜索。 |
| Spotify 分享链接 | 支持元数据搜索 | 尽量用 Spotify oEmbed 获取标题，再回退到页面预览元数据和 YouTube 搜索。 |
| Bilibili 链接 | 不支持 | 当前版本会明确提示不支持。 |
| 网易云音乐链接 | 不支持 | 当前版本会明确提示不支持。 |

Apple Music 和 Spotify 的 API 凭据不是必须项。没有这些凭据时，Bot 仍可以通过公开预览元数据和 YouTube 搜索回退工作；配置官方凭据只是在某些部署中让 LavaSrc 更稳定。

## 快速开始

### 1. 创建 Discord App

1. 打开 Discord Developer Portal 并创建 Application。
2. 在 Bot 页面创建或重置 Bot Token。
3. 在 Installation 页面启用 Guild Install。
4. 添加 scopes：`bot` 和 `applications.commands`。
5. 授权以下权限：
   - View Channels
   - Send Messages
   - Embed Links
   - Use Slash Commands
   - Connect
   - Speak
6. 用安装链接把 App 加入目标 Discord 服务器。

### 2. 按 1Panel 风格部署

推荐放到 1Panel 应用目录：

```bash
mkdir -p /opt/1panel/apps/discord-music-bot/discord-music-bot
cd /opt/1panel/apps/discord-music-bot/discord-music-bot
```

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env`，至少填写：

```env
DISCORD_TOKEN=replace-with-discord-bot-token
DISCORD_CLIENT_ID=replace-with-discord-application-id
LAVALINK_PASSWORD=replace-with-a-long-random-password
```

测试阶段建议填写 `DISCORD_GUILD_ID`，这样斜杠命令更新会更快。留空则注册全局命令，可能需要等待 Discord 同步。

启动：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker logs --tail 100 1Panel-discord-music-bot
docker logs --tail 100 1Panel-discord-music-bot-lavalink
```

## 命令列表

| 命令 | 说明 |
| --- | --- |
| `/play query:<文本或链接>` | 用关键词、YouTube、Apple Music 或 Spotify 播放单首歌曲。 |
| `/queue` | 查看当前队列。 |
| `/list` | `/queue` 的别名。 |
| `/nowplay` | 查看当前正在播放的歌曲。 |
| `/skip` | 跳过当前歌曲。 |
| `/stop` | 停止播放并清空队列，但保留语音连接。 |
| `/leave` | 离开语音频道并清空播放器。 |
| `/resume` | 恢复播放。 |
| `/volum percent:<1-150>` | 设置播放音量。当前部署命令拼写保留为 `volum`。 |

## 配置项

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | 是 | 无 | Discord Developer Portal 的 Bot Token，必须保密。 |
| `DISCORD_CLIENT_ID` | 是 | 无 | Discord Application ID。 |
| `DISCORD_GUILD_ID` | 否 | 空 | 测试服务器 ID。填写后命令只注册到该服务器，更新更快。 |
| `LAVALINK_HOST` | 否 | `discord-lavalink` | Docker 网络内 Lavalink 服务名。 |
| `LAVALINK_PORT` | 否 | `2333` | Lavalink 内部 HTTP/WebSocket 端口。 |
| `LAVALINK_PASSWORD` | 是 | 无 | Bot 和 Lavalink 之间的共享密码，必须保密。 |
| `SPOTIFY_CLIENT_ID` | 否 | 空 | 可选 Spotify Client ID，供 LavaSrc 使用。 |
| `SPOTIFY_CLIENT_SECRET` | 否 | 空 | 可选 Spotify Client Secret，必须保密。 |
| `APPLE_MUSIC_MEDIA_API_TOKEN` | 否 | 空 | 可选 Apple Music API Token，必须保密。 |
| `DEFAULT_VOLUME` | 否 | `80` | 初始播放音量，范围 1 到 150。 |
| `AUDIO_NORMALIZATION_PRE_GAIN` | 否 | `1.3` | 音量归一化前的预增益，用来托起小声源。 |
| `AUDIO_NORMALIZATION_MAX_AMPLITUDE` | 否 | `0.65` | LavaDSPX normalization 的峰值限制。 |
| `LOG_LEVEL` | 否 | `info` | 预留日志等级配置。 |
| `CONTAINER_NAME` | 否 | `1Panel-discord-music-bot` | Compose 容器名前缀。 |
| `CPUS` | 否 | `0` | 1Panel/Compose CPU 限制值。 |
| `MEMORY_LIMIT` | 否 | `0` | 1Panel/Compose 内存限制值。 |

## 架构

```text
Discord 斜杠命令
        |
        v
discord.js Bot 容器
        |
        | Lavalink v4 REST/WebSocket
        v
Lavalink 容器
        |
        | YouTube plugin / LavaSrc / LavaDSPX
        v
Discord 语音频道
```

Bot 容器负责 Discord 事件、命令、队列和消息 Embed。Lavalink 容器负责音频解析、播放和滤镜。默认情况下 Lavalink 只在 Docker 网络内提供服务，不对公网暴露。

### 重要文件

| 路径 | 用途 |
| --- | --- |
| `bot/src/index.ts` | Discord 事件、播放流程、队列控制、搜索回退、Embed、10 分钟空闲离开计时器。 |
| `bot/src/commands.ts` | 斜杠命令定义。 |
| `bot/src/config.ts` | 环境变量解析和安全默认值。 |
| `lavalink/application.yml` | Lavalink 音源、插件、滤镜和 LavaSrc 配置。 |
| `docker-compose.yml` | 1Panel 风格服务定义和 `1panel-network` 接入。 |
| `data.yml` | 1Panel 表单元数据。 |

## 常见问题

### Discord 里看不到斜杠命令

- 测试时填写 `DISCORD_GUILD_ID` 并重启 Bot。
- 确认 App 安装时包含 `applications.commands`。
- 查看 Bot 日志里是否有 `Registered 9 slash commands`。

### Bot 进入语音频道但没有声音

- 确认 Bot 在该语音频道拥有 Connect 和 Speak 权限。
- 查看 Lavalink 日志是否有音源解析错误。
- 先用简单 YouTube 链接测试，再测试 Apple Music 或 Spotify。

### Apple Music 或 Spotify 识别错歌

当前 Bot 不直接从 Apple Music 或 Spotify 拉流，而是提取元数据后去 YouTube Music/YouTube 搜索。如果分享页元数据不完整或搜索结果噪声很大，可以直接用 `/play 歌名 歌手` 搜索。

### 不同歌曲音量差异还是明显

当前默认滤镜：

```env
AUDIO_NORMALIZATION_PRE_GAIN=1.3
AUDIO_NORMALIZATION_MAX_AMPLITUDE=0.65
```

如果小声歌还是太小，可以把 `AUDIO_NORMALIZATION_PRE_GAIN` 稍微调高，例如 `1.4` 或 `1.5`。如果大声歌还是刺耳，可以把 `AUDIO_NORMALIZATION_MAX_AMPLITUDE` 稍微调低。

### Bilibili 或网易云链接不能播放

这是当前版本的预期行为。这两个来源暂时不支持，因为稳定提取和播放需要额外的站点专用处理。

## 安全

- 不要提交 `.env`。
- 不要提交 Discord Token、GitHub Token、API Key、SSH Key 或生产密码。
- 任何曾经发到聊天里或提交到 Git 的 token，都应当视为已经泄露并立刻轮换。
- 不要把 Lavalink `2333` 端口直接暴露到公网，除非你明确知道如何保护它。
- 详细处理流程见 [SECURITY.md](SECURITY.md)。

## 开发

安装依赖并构建：

```bash
cd bot
npm install
npm run build
```

本地开发时需要可访问的 Lavalink：

```bash
cp ../.env.example ../.env
npm run dev
```

## License

MIT，详见 [LICENSE](LICENSE)。
