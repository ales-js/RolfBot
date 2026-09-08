const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');
const { getLevelEmbed } = require('../economy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your level stats'),

  async execute(interaction) {
    if (!interaction.guildId) {
      return interaction.reply({ content: 'use this command in a server.', flags: MessageFlags.Ephemeral });
    }
    try {
      const embed = getLevelEmbed(interaction.guildId, interaction.user, interaction.member);
      await interaction.reply({ embeds: [embed] });
      console.log(`[COMMAND LOG]: /level used by @${interaction.user.username} (${interaction.user.id})`);
    } catch (error) {
      console.error('[XP ERROR]:', error);
      const reply = {
        content: `\`${error.message}\`\nError! Please report this to ales.js (<@1044985132777480253>)`,
        flags: MessageFlags.Ephemeral
      };
      if (interaction.replied || interaction.deferred) return interaction.followUp(reply);
      return interaction.reply(reply);
    }
  }
};