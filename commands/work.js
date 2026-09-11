const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("Work to earn Ostmark. pays 250-750")
    .setContexts(0),

  async execute(interaction) {
    return runEconomySlash(interaction, "work");
  }
};
