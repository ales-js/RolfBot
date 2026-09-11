const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View users by total, wallet, bank, debt, or any tracked statistic.")
    .setContexts(0)
    .addStringOption(option => option
      .setName("category")
      .setDescription("total, wallet, bank, debt, level, list, or any statistic name.")
      .setMinLength(1)
      .setMaxLength(100)),

  async execute(interaction) {
    return runEconomySlash(interaction, "leaderboard");
  }
};
