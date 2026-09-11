const { SlashCommandBuilder } = require('@discordjs/builders');
const { showLevelLeaderboard } = require('../economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level-leaderboard')
    .setDescription('a leaderboard with users ranked by level and total XP.'),

  async execute(interaction) {
    await showLevelLeaderboard(interaction);
    console.log(`[COMMAND LOG]: /level-leaderboard used by @${interaction.user.username} (${interaction.user.id})`);
  }
};