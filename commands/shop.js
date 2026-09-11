const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("View the shop and buy items using the buttons.")
    .setContexts(0),

  async execute(interaction) {
    return runEconomySlash(interaction, "shop");
  }
};
