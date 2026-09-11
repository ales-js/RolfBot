const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("deposit")
    .setDescription("Deposit money from your wallet into your bank.")
    .setContexts(0)
    .addStringOption(option => option
      .setName("amount")
      .setDescription("[ amount | all | half | quarter ]")
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(100)),

  async execute(interaction) {
    return runEconomySlash(interaction, "deposit");
  }
};
