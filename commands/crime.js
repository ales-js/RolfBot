const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("crime")
    .setDescription("Commit a crime for a chance to earn a lot of Ostmark... or lose a lot.")
    .setContexts(0),

  async execute(interaction) {
    return runEconomySlash(interaction, "crime");
  }
};
