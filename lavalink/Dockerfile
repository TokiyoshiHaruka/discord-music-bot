FROM ghcr.io/lavalink-devs/lavalink:4

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      ffmpeg \
      python3 \
      python3-pip \
    && python3 -m pip install --no-cache-dir --upgrade yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER lavalink
