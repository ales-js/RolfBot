const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const xpFile = path.join(__dirname, '..', 'xp.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level-leaderboard')
    .setDescription('a leaderboard with the top 10 users with the most levels.'),

  async execute(interaction) {
    let xpData = {};

    try {
      if (!fs.existsSync(xpFile)) {
        const msg = '`' + err + '` \nerror! Please report this to ales.js (<@1044985132777480253>)';
        console.error('[COMMAND LOG ERROR]: xp.json does not exist (I-X-8)');
        return interaction.reply({ content: msg, ephemeral: true });
      }

      const rawData = fs.readFileSync(xpFile, 'utf-8');

      if (!rawData.trim()) {
        const msg = '`' + err + '` \nerror! Please report this to ales.js (<@1044985132777480253>)';
        console.error('[COMMAND LOG ERROR]: xp.json is empty (I-X-16)');
        return interaction.reply({ content: msg, ephemeral: true });
      }

      try {
        xpData = JSON.parse(rawData);
      } catch (jsonError) {
        const msg = '`' + err + '` \nerror! Please report this to ales.js (<@1044985132777480253>)';
        console.error('[COMMAND LOG ERROR]: failed to parse xp.json:', jsonError, '(I-X-32)');
        return interaction.reply({ content: msg, ephemeral: true });
      }

    } catch (error) {
        const msg = '`' + err + '` \nerror! Please report this to ales.js (<@1044985132777480253>)';
      console.error('[COMMAND LOG ERROR]: unexpected xp.json read error:', error, 'I-X-0');
      return interaction.reply({ content: msg, ephemeral: true });
    }

const sortedUsers = Object.entries(xpData)
  .sort(([, a], [, b]) => {
    if (b.level !== a.level) {
      return b.level - a.level;
    }

    return b.xp - a.xp;
  })
  .slice(0, 10);

    let leaderboardText = '';

    for (let i = 0; i < sortedUsers.length; i++) {
      const [userId, data] = sortedUsers[i];
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      const name = member ? member.user.username : `Unknown (${userId})`;
      leaderboardText += `**${i + 1}.** ${name}: Level ${data.level} (${data.xp} XP)\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('#ffd700')
      .setTitle('Leveling Leaderboard')
      .setDescription(leaderboardText || 'err - nolvldata')
      .setFooter({ text: `requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    console.log(`[COMMAND LOG]: /xp-leaderboard used by @${interaction.user.username} (${interaction.user.id})`);
  },
};
