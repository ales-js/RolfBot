const fs = require('fs');
const xpFile = './xp.json';
const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require('../config.json');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevel')
    .setDescription('[ADMIN] set the level of a user')
    .addUserOption(option =>
      option.setName('target').setDescription('target user').setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount').setDescription('level amount').setRequired(true)),

  async execute(interaction) {
    try {
      const adminUser = interaction.user;

      if (adminUser.id !== config.ownerId) {
        console.log(`[COMMAND LOG ERROR]: setlevel used: unauthorized access attempt by ${adminUser.tag} (E-X-8)`);
        return await interaction.reply({ content: '`Unauthorized`\n cheeky little guy...', ephemeral: true });
      }

      const target = interaction.options.getUser('target');
      const amount = interaction.options.getInteger('amount');

      if (!target) {
        console.log(`[COMMAND LOG ERROR]: setlevel used: target user not found in interaction options (E-X-16)`);
        return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
      }

      if (amount === null || isNaN(amount)) {
        console.log(`[COMMAND LOG ERROR]: setlevel used: invalid level amount provided (E-X-32)`);
        return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
      }

      let xpData = {};
      if (fs.existsSync(xpFile)) {
        try {
          const fileContent = fs.readFileSync(xpFile, 'utf-8');
          xpData = JSON.parse(fileContent);
        } catch (err) {
           console.log(`[COMMAND LOG ERROR]: setlevel used: failed to read or parse xp.json: ${err.message} (E-X-64)`);
         return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
        }
      } else {
         console.log(`[COMMAND LOG ERROR]: setlevel used: xp.json file does not exist (E-X-128)`);
         return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
      }

      if (!xpData[target.id]) {
        xpData[target.id] = { xp: 0, level: 1 };
      }

      xpData[target.id].level = amount;

      try {
        fs.writeFileSync(xpFile, JSON.stringify(xpData, null, 2));
      } catch (err) {
        console.log(`[COMMAND LOG ERROR]: setlevel used: failed to write to xp.json: ${err.message} (E-X-256)`);
        return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('Level Set')
        .setDescription(`**${target.username}**'s level set to **${amount}**`)
        .setColor(0x57F287)
        .setTimestamp()
       .setFooter({ text: `requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })

      await interaction.reply({ embeds: [embed] });

      console.log(`[ADMIN ACTION]: ${adminUser.tag} (${adminUser.id}) has set level of ${target.tag} (${target.id}) to ${amount}`);
    
    } catch (err) {
      console.log(`[COMMAND LOG ERROR]: unexpected error: ${err.message} (E-X-0)`);
      if (!interaction.replied) {
      return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
      } else {
      return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
      }
    }
  },
};
