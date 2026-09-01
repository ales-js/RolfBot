const fs = require('fs');
const xpFile = './xp.json';
const { SlashCommandBuilder } = require('@discordjs/builders');
const config = require('../config.json');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetlevel')
    .setDescription('[ADMIN] reset the level of a user')
    .addUserOption(option =>
      option.setName('target').setDescription('target user').setRequired(true)),

  async execute(interaction) {
    try {
      const adminUser = interaction.user;

      if (adminUser.id !== config.ownerId) {
        console.log(`[COMMAND LOG]: resetlevel used: unauthorized access attempt by ${adminUser.tag} (D-X-8)`);
        return await interaction.reply({ content: '`Unauthorized`\n cheeky little guy...', ephemeral: true });
      }

      const target = interaction.options.getUser('target');
      if (!target) {
        console.log(`[COMMAND LOG ERROR]: resetlevel used: target user not found in interaction options (D-X-16)`);
        return await interaction.reply({ content: '`Target user not found` \nerror! Please report this to ales.js (<@1044985132777480253>)', ephemeral: true });
      }

      let xpData = {};
      if (fs.existsSync(xpFile)) {
        try {
          const fileContent = fs.readFileSync(xpFile, 'utf-8');
          xpData = JSON.parse(fileContent);
        } catch (err) {
          console.log(`[COMMAND LOG ERROR]: failed to read or parse xp.json: ${err.message} (D-X-32)`);
          return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
        }
      } else {
        console.log(`[COMMAND LOG ERROR]: resetlevel used: xp.json file does not exist (D-X-64)`);
        return await interaction.reply({ content: '`xp.json does not exist` \nerror! Please report this to ales.js (<@1044985132777480253>)', ephemeral: true });
      }

      xpData[target.id] = { xp: 0, level: 1 };

      try {
        fs.writeFileSync(xpFile, JSON.stringify(xpData, null, 2));
      } catch (err) {
        console.log(`[COMMAND LOG ERROR]: resetlevel used: failed to write to xp.json: ${err.message} (D-X-128)`);
        return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle('Data Reset')
        .setDescription(`**${target.username}** was cleared from xp.json`)
        .setColor(0x57F287)
        .setTimestamp()
        .setFooter({ text: `requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })

      try {
        await interaction.reply({ embeds: [embed] });
      } catch (err) {
        console.log(`[COMMAND LOG ERROR]: resetlevel used: failed to reply with embed: ${err.message} (D-X-256)`);

        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
        } else {
          return await interaction.followUp({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
        }
      }

      console.log(`[ADMIN ACTION]: ${adminUser.tag} (${adminUser.id}) has reset level and XP of ${target.tag} (${target.id}) to 1 and 0`);
    
    } catch (err) {
      console.log(`[COMMAND LOG ERROR]: resetlevel used: unexpected error: ${err.message} (D-X-0)`);

      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
      } else {
        return await interaction.followUp({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
      }
    }
  },
};