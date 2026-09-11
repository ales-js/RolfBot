const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reset-cooldowns")
    .setDescription("clear all cooldowns from a user.")
    .setContexts(0)
    .addUserOption(option => option
      .setName("user")
      .setDescription("[ @mention | username | userID ]")
      .setRequired(true))
    .addStringOption(option => option
      .setName("command")
      .setDescription("[ work | crime | beg | rob | collect ]")
      .setRequired(true)
      .addChoices({"name": "all", "value": "all"}, {"name": "work", "value": "work"}, {"name": "crime", "value": "crime"}, {"name": "rob", "value": "rob"}, {"name": "beg", "value": "beg"}, {"name": "collect", "value": "collect"})),

  async execute(interaction) {
    return runEconomySlash(interaction, "reset-cooldown");
  }
};
