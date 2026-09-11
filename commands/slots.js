const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slots")
    .setDescription("Gamble your wallet balance away.")
    .setContexts(0)
    .addStringOption(option => option
      .setName("amount")
      .setDescription("[ amount | all | half | quarter ]")
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(100)),

  async execute(interaction) {
    return runEconomySlash(interaction, "slots");
  }
};
