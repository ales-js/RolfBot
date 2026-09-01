const fs = require('fs');
const xpFile = './xp.json';
const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require('../config.json');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('[ADMIN] set the XP of a user')
    .addUserOption(option =>
      option.setName('target').setDescription('target user').setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount').setDescription('XP amount').setRequired(true)),
  
  async execute(interaction) {
    const adminUser = interaction.user;

if (adminUser.id !== config.ownerId) {
  console.log(`[SERVER EVENT]: ${adminUser.tag} tried to use command /setxp`);
        return await interaction.reply({ content: '`Unauthorized`\n cheeky little guy...', ephemeral: true });
}

    const target = interaction.options.getUser('target');
    const amount = interaction.options.getInteger('amount');

    let xpData = {};
    if (fs.existsSync(xpFile)) {
      xpData = JSON.parse(fs.readFileSync(xpFile, 'utf-8'));
    }

    if (!xpData[target.id]) {
      xpData[target.id] = { xp: 0, level: 1 };
    }

    xpData[target.id].xp = amount;

    fs.writeFileSync(xpFile, JSON.stringify(xpData, null, 2));

    const { EmbedBuilder } = require('discord.js');

const embed = new EmbedBuilder()
  .setTitle('XP Aktualisiert')
  .setDescription(`XP of **${target.username}** was set to **${amount}**`)
  .setColor(0x57F287)
  .setTimestamp()
  .setFooter({ text: `requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })

await interaction.reply({ embeds: [embed] });

    console.log(`[ADMIN ACTION]: ${adminUser.tag} (${adminUser.id}) has set XP of ${target.tag} (${target.id}) to ${amount}`);
  },
};
