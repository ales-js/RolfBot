const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("View your or another user's wallet and bank balance.")
    .setContexts(0)
    .addUserOption(option => option
      .setName("user")
      .setDescription("[ @mention | username | userID ]")),

  async execute(interaction) {
    return runEconomySlash(interaction, "balance");
  }
};
