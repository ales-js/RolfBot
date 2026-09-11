const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin-help")
    .setDescription("View all owner only commands.")
    .setContexts(0),

  async execute(interaction) {
    return runEconomySlash(interaction, "adminhelp");
  }
};
