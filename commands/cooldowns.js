const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cooldowns")
    .setDescription("See when you can next work, commit a crime, rob, beg, and collect income.")
    .setContexts(0),

  async execute(interaction) {
    return runEconomySlash(interaction, "cooldowns");
  }
};
