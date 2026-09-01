const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, REST, Routes, EmbedBuilder, PermissionsBitField } = require('discord.js');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(config.token);
rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands })
  .then(() => console.log('[STARTUP INFO]: starting...'))
  .catch(console.error);

client.once('ready', () => {
  console.log(`[STARTUP INFO]: logged in as ${client.user.tag}`);
  console.log(`[STARTUP INFO]: successfully started!`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    return await interaction.reply({ content: `\`${err}\` \nerror! Please report this to ales.js (<@1044985132777480253>)`, ephemeral: true });
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
  const channel = member.guild.channels.cache.get(config.welcomeChannelId);
  if (!channel) return;

  try {
    const guildMembers = await member.guild.members.fetch();
    const memberCount = guildMembers.filter(
      guildMember => !guildMember.user.bot
    ).size;

    const gifs = [
      {
        url: 'https://media1.tenor.com/m/j27YO2ypz2oAAAAd/ifa-wartburg-rolf-kempinski.gif',
        name: 'rolf-kempinski.gif'
      },
      {
        url: 'https://media1.tenor.com/m/eopWTJwWfJ0AAAAd/ifa-wartburg-heinz-klinger.gif',
        name: 'heinz-klinger.gif'
      }
    ];

    const selectedGif = gifs[Math.floor(Math.random() * gifs.length)];

    const embed = new EmbedBuilder()
      .setColor(0x5b9dff)
      .setTitle('New Arrival')
      .setDescription(
        `${member} just joined the server and is now our **${getOrdinal(memberCount)}** citizen. Willkommen.`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setImage(`attachment://${selectedGif.name}`)
      .setTimestamp();

    await channel.send({
      embeds: [embed],
      files: [{
        attachment: selectedGif.url,
        name: selectedGif.name
      }]
    });
  } catch (error) {
    console.error('[WELCOME MESSAGE ERROR]:', error);
  }
});

// Leave Message \\
client.on('guildMemberRemove', async member => {
  const channel = member.guild.channels.cache.get(config.leaveChannelId);
  if (!channel) return;

  try {
    const guildMembers = await member.guild.members.fetch();
    const memberCount = guildMembers.filter(
      guildMember => !guildMember.user.bot
    ).size;

    const gifs = [
      {
        url: 'https://media1.tenor.com/m/8jPspr4e0bIAAAAC/ifa-wartburg-rolf.gif',
        name: 'rolf-kempinski.gif'
      },
      {
        url: 'https://media1.tenor.com/m/SHKzg3XDgRsAAAAC/heinz-heinz-klinger.gif',
        name: 'heinz-klinger.gif'
      }
    ];

    const selectedGif = gifs[Math.floor(Math.random() * gifs.length)];

    const embed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle('Citizen Left')
      .setDescription(
        `${member.user.displayName} (@${member.user.tag}) just left the server and we're now down to **${memberCount}** citizens. boooo!`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setImage(`attachment://${selectedGif.name}`)
      .setTimestamp();

    await channel.send({
      embeds: [embed],
      files: [{
        attachment: selectedGif.url,
        name: selectedGif.name
      }]
    });
  } catch (error) {
    console.error('[LEAVE MESSAGE ERROR]:', error);
  }
});


// Boost Message \\
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const boostChannel = newMember.guild.channels.cache.get(config.boostChannelId);

  const wasNotBoosting = !oldMember.premiumSince;
  const isBoostingNow = newMember.premiumSince;

  if (wasNotBoosting && isBoostingNow && boostChannel) {
    const embed = new EmbedBuilder()
      .setTitle('[boost title]')
      .setDescription(`${newMember.toString()} [boost body]`)
      .setColor(0xFF73FA)
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    boostChannel.send({ embeds: [embed] }).catch(console.error);
  }
});

// Leveling \\
const xpFile = './xp.json';
let xpData = {};

if (fs.existsSync(xpFile)) {
  xpData = JSON.parse(fs.readFileSync(xpFile, 'utf-8'));
} else {
  fs.writeFileSync(xpFile, '{}');
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;

  const baseXpAdd = Math.floor(Math.random() * 10) + 5;

  if (!xpData[userId]) {
    xpData[userId] = { xp: 0, level: 1 };
  }

  xpData[userId].xp += baseXpAdd;

  const nextLevelXP = xpData[userId].level * 100;

  if (xpData[userId].xp >= nextLevelXP) {
    xpData[userId].level++;
    xpData[userId].xp = 0;

    const embed = new EmbedBuilder()
      .setColor('#8000ff')
      .setTitle('Levelup')
      .setDescription(`HURRA, ${message.author}! you are now level **${xpData[userId].level}**`)
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }

  fs.writeFileSync(xpFile, JSON.stringify(xpData, null, 2));
});

client.login(config.token);
