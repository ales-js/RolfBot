const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("beg")
    .setDescription("Beg strangers for a small but guaranteed amount of Ostmark. pays 25-150")
    .setContexts(0),

  async execute(interaction) {
    return runEconomySlash(interaction, "beg");
  }
};
