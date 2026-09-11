const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("statistics")
    .setDescription("View all of your economy statistics.")
    .setContexts(0)
    .addStringOption(option => option
      .setName("action")
      .setDescription("view a users statistics.")
      .addChoices({"name": "edit", "value": "edit"}, {"name": "add", "value": "add"}, {"name": "remove", "value": "remove"}, {"name": "reset", "value": "reset"}, {"name": "list", "value": "list"}))
    .addUserOption(option => option
      .setName("user")
      .setDescription("[ @mention | username | userID ]"))
    .addStringOption(option => option
      .setName("statistic")
      .setDescription("[ statistic ]")
      .setMinLength(1)
      .setMaxLength(100))
    .addStringOption(option => option
      .setName("amount")
      .setDescription("optional: [ new value ]")
      .setMinLength(1)
      .setMaxLength(100)),

  async execute(interaction) {
    return runEconomySlash(interaction, "stats");
  }
};
