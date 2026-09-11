const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-money")
    .setDescription("sets a users money balance.")
    .setContexts(0)
    .addUserOption(option => option
      .setName("user")
      .setDescription("[ @mention | username | userID ]")
      .setRequired(true))
    .addIntegerOption(option => option
      .setName("amount")
      .setDescription("[ amount ]")
      .setRequired(true))
    .addStringOption(option => option
      .setName("pocket")
      .setDescription("[ bank | wallet ]")
      .setRequired(true)
      .addChoices({"name": "wallet", "value": "wallet"}, {"name": "bank", "value": "bank"})),

  async execute(interaction) {
    return runEconomySlash(interaction, "set-money");
  }
};
