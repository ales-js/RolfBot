const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("collect")
    .setDescription("Collect your daily income. Resets every day at 00:00 Berlin time. (buy income roles in `?shop`)")
    .setContexts(0),

  async execute(interaction) {
    return runEconomySlash(interaction, "collect");
  }
};
