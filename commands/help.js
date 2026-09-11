const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("View all available RolfBot Economy commands.")
    .setContexts(0),

  async execute(interaction) {
    return runEconomySlash(interaction, "help");
  }
};
