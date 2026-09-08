const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config.json');
const xpStore = require('../xp-store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevel')
    .setDescription('[ADMIN] set the level of a user')
    .addUserOption(option =>
      option.setName('target').setDescription('target user').setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount').setDescription('level amount').setRequired(true).setMinValue(1)),

  async execute(interaction) {
    const adminUser = interaction.user;
    if (adminUser.id !== config.ownerId) {
      console.log(`[COMMAND LOG ERROR]: setlevel used: unauthorized access attempt by ${adminUser.tag} (E-X-8)`);
      return interaction.reply({ content: '`Unauthorized`\n cheeky little guy...', flags: MessageFlags.Ephemeral });
    }
    const target = interaction.options.getUser('target');
    const amount = interaction.options.getInteger('amount');
    if (!target) throw new Error('Target user not found.');
    xpStore.setLevel(target.id, amount);
    const embed = new EmbedBuilder()
      .setTitle('Level Set')
      .setDescription(`**${target.username}**'s level set to **${amount}**`)
      .setColor(0x57F287)
      .setTimestamp()
      .setFooter({ text: `requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });
    await interaction.reply({ embeds: [embed] });
    console.log(`[ADMIN ACTION]: ${adminUser.tag} (${adminUser.id}) has set level of ${target.tag} (${target.id}) to ${amount}`);
  }
};