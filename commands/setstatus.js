const fs = require('fs');
const path = require('path');
const {
  ActivityType,
  MessageFlags,
  SlashCommandBuilder
} = require('discord.js');

const config = require('../config.json');
const statusFile = path.join(__dirname, '..', 'status.json');

const activityTypes = {
  playing: ActivityType.Playing,
  watching: ActivityType.Watching,
  listening: ActivityType.Listening,
  competing: ActivityType.Competing
};

function saveStatus(statusData) {
  fs.writeFileSync(
    statusFile,
    JSON.stringify(statusData, null, 2)
  );
}

function loadStatus() {
  if (!fs.existsSync(statusFile)) {
    return null;
  }

  try {
    return JSON.parse(
      fs.readFileSync(statusFile, 'utf8')
    );
  } catch (error) {
    console.error(
      `[STATUS ERROR]: Failed to read status.json: ${error.message}`
    );

    return null;
  }
}

function applyStatus(client, statusData) {
  const activityType =
    activityTypes[statusData.activityType];

  if (!activityType) {
    throw new Error(
      `Unknown activity type: ${statusData.activityType}`
    );
  }

  client.user.setPresence({
    status: statusData.status,
    activities: [
      {
        name: statusData.activityName,
        type: activityType
      }
    ]
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setstatus')
    .setDescription(
      '[ADMIN] Sets the status and activity of RolfBot.'
    )
    .addStringOption(option =>
      option
        .setName('status')
        .setDescription('Bot status')
        .setRequired(true)
        .addChoices(
          {
            name: 'Online',
            value: 'online'
          },
          {
            name: 'Idle',
            value: 'idle'
          },
          {
            name: 'Do Not Disturb',
            value: 'dnd'
          },
          {
            name: 'Invisible',
            value: 'invisible'
          }
        )
    )
    .addStringOption(option =>
      option
        .setName('activity_type')
        .setDescription('Activity type')
        .setRequired(true)
        .addChoices(
          {
            name: 'Playing',
            value: 'playing'
          },
          {
            name: 'Watching',
            value: 'watching'
          },
          {
            name: 'Listening',
            value: 'listening'
          },
          {
            name: 'Competing',
            value: 'competing'
          }
        )
    )
    .addStringOption(option =>
      option
        .setName('activity_name')
        .setDescription('Name of the activity')
        .setRequired(true)
        .setMaxLength(128)
    ),

  async execute(interaction) {
    if (interaction.user.id !== config.ownerId) {
      console.log(
        `[COMMAND LOG ERROR]: Unauthorized access attempt by ${interaction.user.tag}`
      );

      return interaction.reply({
        content: '`Unauthorized`\ncheeky little guy...',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      const statusData = {
        status:
          interaction.options.getString(
            'status',
            true
          ),
        activityType:
          interaction.options.getString(
            'activity_type',
            true
          ),
        activityName:
          interaction.options.getString(
            'activity_name',
            true
          )
      };

      applyStatus(
        interaction.client,
        statusData
      );

      saveStatus(statusData);

      const activityLabel =
        statusData.activityType
          .charAt(0)
          .toUpperCase() +
        statusData.activityType.slice(1);

      await interaction.reply({
        content:
          `Status was set to **${statusData.status}** and ` +
          `activity was set to **${activityLabel} ${statusData.activityName}**.`,
        flags: MessageFlags.Ephemeral
      });

      console.log(
        `[ADMIN ACTION]: ${interaction.user.tag} set status to ` +
        `${statusData.status} and activity to ` +
        `${activityLabel} ${statusData.activityName}`
      );
    } catch (error) {
      console.error(
        `[COMMAND LOG ERROR]: Failed to set status: ${error.stack || error}`
      );

      const response = {
        content:
          `\`${error.message}\`\n` +
          'Error! Please report this to ales.js ' +
          '(<@1044985132777480253>).',
        flags: MessageFlags.Ephemeral
      };

      if (
        interaction.replied ||
        interaction.deferred
      ) {
        return interaction.followUp(response);
      }

      return interaction.reply(response);
    }
  },

  loadStatus,
  applyStatus
};