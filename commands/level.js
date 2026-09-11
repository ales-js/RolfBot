const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');
const { sendSlashError, logSlashError } = require('../economy-slash');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your level stats'),

  async execute(interaction) {
    try {
      if (!interaction.guildId) {
        return await interaction.reply({ content: 'use this command in a server.', flags: MessageFlags.Ephemeral });
      }
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
      const { getLevelEmbed } = require('../economy');
      const embed = getLevelEmbed(interaction.guildId, interaction.user, interaction.member);
      await interaction.editReply({ embeds: [embed] });
      console.log(`[COMMAND LOG]: /level used by @${interaction.user.username} (${interaction.user.id})`);
    } catch (error) {
      logSlashError(interaction, error);
      return await sendSlashError(interaction, error);
    }
  }
};
