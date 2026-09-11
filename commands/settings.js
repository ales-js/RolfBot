const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("View all available RolfBot Economy settings.")
    .setContexts(0)
    .addStringOption(option => option
      .setName("setting")
      .setDescription("leave blank to view all available settings.")
      .addChoices({"name": "badges", "value": "badges"}, {"name": "color", "value": "color"}))
    .addStringOption(option => option
      .setName("value")
      .setDescription("use `?help` to see usage.")
      .setMinLength(1)
      .setMaxLength(100)),

  async execute(interaction) {
    return runEconomySlash(interaction, "settings");
  }
};
