const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const xpFile = path.join(__dirname, '..', 'xp.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your level stats'),
    
  async execute(interaction) {
    let xpData = {};

    try {
      if (!fs.existsSync(xpFile)) {
        const msg = '`' + err + '` \nerror! Please report this to ales.js (<@1044985132777480253>)';
        console.error('[XP ERROR]: xp.json does not exist (C-X-8)');
        return interaction.reply({ content: msg, ephemeral: true });
      }

      const rawData = fs.readFileSync(xpFile, 'utf-8');

      if (!rawData.trim()) {
        const msg = '`' + err + '` \nerror! Please report this to ales.js (<@1044985132777480253>)';
        console.error('[COMMAND LOG ERROR]: xp.json is empty (C-X-16)');
        return interaction.reply({ content: msg, ephemeral: true });
      }

      try {
        xpData = JSON.parse(rawData);
      } catch (jsonError) {
        level-leaderboard.js
        console.error('[COMMAND LOG ERROR]: failed to parse xp.json:', jsonError, '(C-X-32)');
        return interaction.reply({ content: msg, ephemeral: true });
      }

    } catch (error) {
      const msg = '`' + err + '` \nerror! Please report this to ales.js (<@1044985132777480253>)';
      console.error('[COMMAND LOG ERROR]: unexpected xp.json read error:', error, 'C-X-0');
      return interaction.reply({ content: msg, ephemeral: true });
    }

    const userId = interaction.user.id;
    const userXP = xpData[userId] || { xp: 0, level: 1 };

    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('Your Level Statistics')
      .setDescription(`**Level:** ${userXP.level}\n**XP:** ${userXP.xp}`)
      .setFooter({ text: `requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    console.log(`[COMMAND LOG]: /level used by @${interaction.user.username} (${userId})`);
  },
};
