const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("give")
    .setDescription("Give another user money from your wallet.")
    .setContexts(0)
    .addUserOption(option => option
      .setName("user")
      .setDescription("[ @mention | username | userID ]")
      .setRequired(true))
    .addStringOption(option => option
      .setName("amount")
      .setDescription("[ amount | all | half | quarter ]")
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(100)),

  async execute(interaction) {
    return runEconomySlash(interaction, "give");
  }
};
