const { SlashCommandBuilder, ActivityType } = require('discord.js');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setstatus')
    .setDescription('[ADMIN] sets the status and activity of RolfBot.')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Bot status')
        .setRequired(true)
        .addChoices(
          { name: 'Online', value: 'online' },
          { name: 'Idle', value: 'idle' },
          { name: 'Do Not Disturb', value: 'dnd' },
          { name: 'Invisible', value: 'invisible' }
        ))
    .addStringOption(option =>
      option.setName('activity_type')
        .setDescription('Activity Type')
        .setRequired(true)
        .addChoices(
          { name: 'Playing', value: 'Playing' },
          { name: 'Watching', value: 'Watching' },
          { name: 'Listening', value: 'Listening' },
          { name: 'Competing', value: 'Competing' }
        ))
    .addStringOption(option =>
      option.setName('activity_name')
        .setDescription('Name of the activity')
        .setRequired(true)),

  async execute(interaction, client) {
    try {
      const userId = interaction.user.id;

      if (userId !== config.ownerId) {
        console.log(`[COMMAND LOG ERROR]: unauthorized access attempt by ${interaction.user.tag} (F-X-8)`);
        return await interaction.reply({ content: '`Unauthorized`\n cheeky little guy...', ephemeral: true });
      }

      const status = interaction.options.getString('status');
      const activityType = interaction.options.getString('activity_type');
      const activityName = interaction.options.getString('activity_name');

      const activityMap = {
        Playing: ActivityType.Playing,
        Watching: ActivityType.Watching,
        Listening: ActivityType.Listening,
        Competing: ActivityType.Competing
      };

      client.user.setStatus(status);
      client.user.setActivity(activityName, { type: activityMap[activityType] });

      await interaction.reply({
        content: `status was set to **${status}** and activity was set to **${activityType} ${activityName}**.`,
        ephemeral: true
      });

      console.log(`[ADMIN ACTION]: ${interaction.user.tag} set status to ${status} and activity to ${activityType} ${activityName}`);
    } catch (err) {
      console.log(`[COMMAND LOG ERROR]: unexpected error: ${err.message} (F-X-0)`);
      if (!interaction.replied) {
        return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
      } else {
        return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
      }
    }
  }
};
