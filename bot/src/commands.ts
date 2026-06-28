import { SlashCommandBuilder } from "discord.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song or playlist from a music link or search keyword.")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Apple Music, Spotify, YouTube link, or keywords")
        .setRequired(true)
    ),
  new SlashCommandBuilder().setName("queue").setDescription("Show the current music queue."),
  new SlashCommandBuilder().setName("list").setDescription("Show the current music queue."),
  new SlashCommandBuilder().setName("nowplay").setDescription("Show the currently playing track."),
  new SlashCommandBuilder().setName("skip").setDescription("Skip the current track."),
  new SlashCommandBuilder().setName("stop").setDescription("Stop playback and clear the queue, but stay in voice."),
  new SlashCommandBuilder().setName("leave").setDescription("Leave the voice channel and clear the player."),
  new SlashCommandBuilder().setName("resume").setDescription("Resume playback."),
  new SlashCommandBuilder()
    .setName("volum")
    .setDescription("Set the playback volume.")
    .addIntegerOption((option) =>
      option
        .setName("percent")
        .setDescription("Volume from 1 to 150")
        .setMinValue(1)
        .setMaxValue(150)
        .setRequired(true)
    )
].map((command) => command.toJSON());
