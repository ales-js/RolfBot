const fs = require('fs');
const path = require('path');
const {
  ActivityType,
  Client,
  Collection,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes
} = require('discord.js');

const {
  handleEconomyCommand,
  getUserEmbedColor
} = require('./economy');
const xpStore = require('./xp-store');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Validate and migrate before connecting. Invalid data stops startup, not resets it.
xpStore.loadXp();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith('.js'));

const commands = commandFiles.map(file => {
  const command = require(path.join(commandsPath, file));

  client.commands.set(command.data.name, command);
  return command.data.toJSON();
});

const rest = new REST({ version: '10' }).setToken(config.token);

rest
  .put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands }
  )
  .then(() => console.log('[STARTUP INFO]: starting...'))
  .catch(error => {
    console.error('[STARTUP ERROR]: Failed to register commands:', error);
  });

const rotatingStatuses = [
  'FDJ (Freie Deutsche Jugend)',
  'Frau Gorbatschowa tanzt Bossanova',
  'Kosmoskost',
  'Zur Konferenz in Rostock',
  'Es ist nicht so schlimm auf der Insel Krim',
  'Der alte böse Kapitalismus',
  'Hey, Radiofunker',
  'Agrarwissenschaft im Dienste des Sozialismus',
  'Zwei Tage in Berlin',
  'Hallo, guter Kommunist',
  'Volksfest in Ukraina',
  'Der Berliner',
  'Nightclub in Berlin',
  'Spassjazz',
  'Das Mauer Power',
  'Im Dienste des KGB',
  'Sorbisches Fischerlied',
  'Biologie und Pathologie des Weibes',
  'Wo ist mein Kassler?',
  'Sessel aus Kassel',
  'Meine Möbeln in Köln',
  'Wenn IFA Wartburg spielt',
  'Kulturarbeiter des Monats'
];

const statusInterval = 3 * 60 * 1000;

function startStatusRotation(readyClient) {
  let statusIndex = 0;

  function updateStatus() {
    const status = rotatingStatuses[statusIndex];

    readyClient.user.setPresence({
      activities: [
        {
          name: status,
          type: ActivityType.Listening
        }
      ],
      status: 'dnd'
    });

    console.log(`[STATUS INFO]: Listening to ${status}`);

    statusIndex =
      (statusIndex + 1) % rotatingStatuses.length;
  }

  updateStatus();
  setInterval(updateStatus, statusInterval);
}

client.once('ready', readyClient => {
  startStatusRotation(readyClient);

  console.log(`[STARTUP INFO]: logged in as ${readyClient.user.tag}`);
  console.log('[STARTUP INFO]: successfully started!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error('[SLASH COMMAND ERROR]:', error);

    const errorResponse = {
      content:
        `\`${error.message}\`\n` +
        'Error! Please report this to ales.js (<@1044985132777480253>)',
      flags: MessageFlags.Ephemeral
    };

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(errorResponse);
    }

    return interaction.reply(errorResponse);
  }
});

function getOrdinal(number) {
  const lastTwoDigits = number % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${number}th`;
  }

  switch (number % 10) {
    case 1:
      return `${number}st`;

    case 2:
      return `${number}nd`;

    case 3:
      return `${number}rd`;

    default:
      return `${number}th`;
  }
}

// Welcome Message \\
client.on('guildMemberAdd', async member => {
  const channel = member.guild.channels.cache.get(
    config.welcomeChannelId
  );

  if (!channel) return;

  try {
    const guildMembers = await member.guild.members.fetch();
    const memberCount = guildMembers.filter(
      guildMember => !guildMember.user.bot
    ).size;

    const gifs = [
      {
        url:
          'https://media1.tenor.com/m/j27YO2ypz2oAAAAd/ifa-wartburg-rolf-kempinski.gif',
        name: 'rolf-kempinski.gif'
      },
      {
        url:
          'https://media1.tenor.com/m/eopWTJwWfJ0AAAAd/ifa-wartburg-heinz-klinger.gif',
        name: 'heinz-klinger.gif'
      }
    ];

    const selectedGif = gifs[Math.floor(Math.random() * gifs.length)];

    const embed = new EmbedBuilder()
      .setColor(0x5b9dff)
      .setTitle('New Arrival')
      .setDescription(
        `${member} just joined the server and is now our ` +
        `**${getOrdinal(memberCount)}** citizen. Willkommen.`
      )
      .setThumbnail(
        member.user.displayAvatarURL({ dynamic: true })
      )
      .setImage(`attachment://${selectedGif.name}`)
      .setTimestamp();

    await channel.send({
      embeds: [embed],
      files: [
        {
          attachment: selectedGif.url,
          name: selectedGif.name
        }
      ]
    });
  } catch (error) {
    console.error('[WELCOME MESSAGE ERROR]:', error);
  }
});

// Leave Message \\
client.on('guildMemberRemove', async member => {
  const channel = member.guild.channels.cache.get(
    config.leaveChannelId
  );

  if (!channel) return;

  try {
    const guildMembers = await member.guild.members.fetch();
    const memberCount = guildMembers.filter(
      guildMember => !guildMember.user.bot
    ).size;

    const gifs = [
      {
        url:
          'https://media1.tenor.com/m/8jPspr4e0bIAAAAC/ifa-wartburg-rolf.gif',
        name: 'rolf-kempinski.gif'
      },
      {
        url:
          'https://media1.tenor.com/m/SHKzg3XDgRsAAAAC/heinz-heinz-klinger.gif',
        name: 'heinz-klinger.gif'
      }
    ];

    const selectedGif = gifs[Math.floor(Math.random() * gifs.length)];

    const embed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle('Citizen Left')
      .setDescription(
        `${member.user.displayName} (@${member.user.tag}) just left the server ` +
        `and we're now down to **${memberCount}** citizens. boooo!`
      )
      .setThumbnail(
        member.user.displayAvatarURL({ dynamic: true })
      )
      .setImage(`attachment://${selectedGif.name}`)
      .setTimestamp();

    await channel.send({
      embeds: [embed],
      files: [
        {
          attachment: selectedGif.url,
          name: selectedGif.name
        }
      ]
    });
  } catch (error) {
    console.error('[LEAVE MESSAGE ERROR]:', error);
  }
});

// Boost Message \\
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const boostChannel = newMember.guild.channels.cache.get(
    config.boostChannelId
  );

  const startedBoosting =
    !oldMember.premiumSince && newMember.premiumSince;

  if (!startedBoosting || !boostChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('+1 Boost!')
    .setDescription(
      `${newMember} just boosted this server! view your perks in ` +
      'https://discord.com/channels/1531931159326625802/1543373842297397268'
    )
    .setColor(0xff73fa)
    .setThumbnail(
      newMember.user.displayAvatarURL({ dynamic: true })
    )
    .setTimestamp();

  try {
    await boostChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[BOOST MESSAGE ERROR]:', error);
  }
});

// Leveling \\
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  try {
    await handleEconomyCommand(message);
  } catch (error) {
    console.error('[ECONOMY COMMAND ERROR]:', error);
  }

  try {
    const userId = message.author.id;
    const baseXpAdd = Math.floor(Math.random() * 10) + 5;
    // Read fresh data and save before any Discord reply can yield control.
    const result = xpStore.addXp(userId, baseXpAdd);

    if (result.leveledUp) {
      const embedColor = getUserEmbedColor(
        message.guild.id,
        userId,
        message.member
      );

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('Levelup')
        .setDescription(
          `HURRA, ${message.author}! you are now level ` +
          `**${result.level}**`
        )
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error('[XP ERROR]: Failed to award message XP or send level-up:', error);
  }
});

client.login(config.token);