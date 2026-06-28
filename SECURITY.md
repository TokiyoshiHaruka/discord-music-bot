# Security Policy

## Supported Versions

This repository tracks the current public release of the Discord music bot.
Security fixes should be applied to the latest commit on the default branch.

## Secrets

Never commit real Discord tokens, Lavalink passwords, Spotify credentials,
Apple Music API tokens, GitHub tokens, SSH keys, or production `.env` files.

Use `.env.example` as a template and keep the real `.env` only on the server.
The repository `.gitignore` excludes `.env`, runtime logs, Lavalink plugin jars,
compiled output, and dependency folders.

## If a Secret Is Exposed

Treat exposed secrets as compromised:

1. Rotate the Discord Bot Token in Discord Developer Portal.
2. Rotate any GitHub password, PAT, or SSH key that was shared or committed.
3. Replace `LAVALINK_PASSWORD` with a new random value.
4. Rebuild/restart the Docker Compose stack after updating `.env`.
5. Review commit history and GitHub secret scanning alerts.

## Reporting

Open a private report or contact the maintainer directly before publishing
details that could allow account takeover or unauthorized bot control.
