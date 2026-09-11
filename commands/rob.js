const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rob")
    .setDescription("Rob 40-50% of another user's wallet.")
    .setContexts(0)
    .addUserOption(option => option
      .setName("user")
      .setDescription("[ @mention | username | userID ]")
      .setRequired(true)),

  async execute(interaction) {
    return runEconomySlash(interaction, "rob");
  }
};
