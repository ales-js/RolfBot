const { SlashCommandBuilder } = require('@discordjs/builders');
const { runEconomySlash } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName("achievements")
    .setDescription("View your locked and unlocked achievements.")
    .setContexts(0)
    .addStringOption(option => option
      .setName("action")
      .setDescription("[ grant | revoke | auto | list ]")
      .addChoices({"name": "grant", "value": "grant"}, {"name": "revoke", "value": "revoke"}, {"name": "auto", "value": "auto"}, {"name": "list", "value": "list"}))
    .addUserOption(option => option
      .setName("user")
      .setDescription("[ user ]"))
    .addStringOption(option => option
      .setName("achievement")
      .setDescription("[ achievement.id | all ]")
      .setMinLength(1)
      .setMaxLength(100)),

  async execute(interaction) {
    return runEconomySlash(interaction, "achievements");
  }
};
