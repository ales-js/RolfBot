const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config.json');
const xpStore = require('../xp-store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetlevel')
    .setDescription('[ADMIN] reset the level of a user')
    .addUserOption(option =>
      option.setName('target').setDescription('target user').setRequired(true)),

  async execute(interaction) {
    const adminUser = interaction.user;
    if (adminUser.id !== config.ownerId) {
      console.log(`[COMMAND LOG]: resetlevel used: unauthorized access attempt by ${adminUser.tag} (D-X-8)`);
      return interaction.reply({ content: '`Unauthorized`\n cheeky little guy...', flags: MessageFlags.Ephemeral });
    }
    const target = interaction.options.getUser('target');
    if (!target) throw new Error('Target user not found.');
    xpStore.resetLevel(target.id);
    const embed = new EmbedBuilder()
      .setTitle('Data Reset')
      .setDescription(`**${target.username}** was cleared from xp.json`)
      .setColor(0x57F287)
      .setTimestamp()
      .setFooter({ text: `requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });
    await interaction.reply({ embeds: [embed] });
    console.log(`[ADMIN ACTION]: ${adminUser.tag} (${adminUser.id}) has reset level and XP of ${target.tag} (${target.id}) to 1 and 0`);
  }
};