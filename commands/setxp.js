const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config.json');
const xpStore = require('../xp-store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('[ADMIN] set the total XP of a user')
    .addUserOption(option =>
      option.setName('target').setDescription('target user').setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount').setDescription('Total XP amount (recalculates level)').setRequired(true).setMinValue(0)),

  async execute(interaction) {
    const adminUser = interaction.user;
    if (adminUser.id !== config.ownerId) {
      console.log(`[SERVER EVENT]: ${adminUser.tag} tried to use command /setxp`);
      return interaction.reply({ content: '`Unauthorized`\n cheeky little guy...', flags: MessageFlags.Ephemeral });
    }
    const target = interaction.options.getUser('target');
    const amount = interaction.options.getInteger('amount');
    if (!target) throw new Error('Target user not found.');
    xpStore.setTotalXp(target.id, amount);
    const embed = new EmbedBuilder()
      .setTitle('XP Aktualisiert')
      .setDescription(`XP of **${target.username}** was set to **${amount}**`)
      .setColor(0x57F287)
      .setTimestamp()
      .setFooter({ text: `requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });
    await interaction.reply({ embeds: [embed] });
    console.log(`[ADMIN ACTION]: ${adminUser.tag} (${adminUser.id}) has set XP of ${target.tag} (${target.id}) to ${amount}`);
  }
};