const fs = require('fs');
const path = require('path');
const readline = require('readline');
const levelRewards = require('./level-rewards');
const {
  ActivityType,
  ChannelType,
  PermissionFlagsBits,
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
  syncLevelRewards,
  backfillLevelRewards,
  getUserEmbedColor
} = require('./economy');
const xpStore = require('./xp-store');
const activityStore = require('./activity-store');
const voiceXp = require('./vc-xp');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const lvlRoles = [
  { level: 5, roleId: config.lvlRole1Id },
  { level: 10, roleId: config.lvlRole3Id },
  { level: 15, roleId: config.lvlRole2Id }
];

xpStore.loadXp();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

activityStore.start(client);

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
  if (!config.vcLevelUpChannelId) {
    console.error('[VC XP]: set vcLevelUpChannelId in config.json for level-up messages.');
  }
  voiceXp.start(readyClient, {
    guildId: config.guildId,
    award: (member, xp) => awardXp(member.guild, member.user, member, xp, null, true)
  });
  for (const guild of readyClient.guilds.cache.values()) {
    backfillLevelRewards(guild).catch(error => {
      console.error('[LEVEL REWARDS]: backfill failed:', error);
    });
  }
  const activityGuild = readyClient.guilds.cache.get(config.guildId);
  if (activityGuild) activityStore.scanMessages(activityGuild);

  console.log(`[STARTUP INFO]: logged in as ${readyClient.user.tag}`);
  console.log(`[STARTUP INFO]: successfully started! v${config.version}`);
});

let checkingLvlRole1 = false;

async function checkLvlRole1(readyClient) {
  if (!readyClient.isReady()) {
    console.log('[LEVEL ROLES]: bot is not ready yet.');
    return;
  }
  if (checkingLvlRole1) {
    console.log('[LEVEL ROLES]: check already running.');
    return;
  }
  checkingLvlRole1 = true;
  console.log('[LEVEL ROLES]: starting check...');

  let checked = 0;
  let added = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const guild = await readyClient.guilds.fetch(config.guildId);
    const members = await guild.members.fetch();
    const users = xpStore.loadXp();

    console.log(
      `[LEVEL ROLES]: loaded ${members.size} members from ${guild.name}`
    );

    for (const member of members.values()) {
      const label = `${member.user.tag} (${member.id})`;

      if (member.user.bot) {
        console.log(`[LEVEL ROLES]: skip ${label}: bot`);
        skipped++;
        continue;
      }

      checked++;

      const level = xpStore.getProgress(
        users[member.id] || { xp: 0, level: 1 }
      ).level;

      console.log(`[LEVEL ROLES]: checking ${label}: level ${level}`);

      for (const reward of lvlRoles) {
        if (!reward.roleId) {
          console.error(
            `[LEVEL ROLES]: err: no roleid configured for level ${reward.level}`
          );
          failed++;
          continue;
        }

        if (level < reward.level) {
          console.log(
            `[LEVEL ROLES]: skip ${label}: needs level ${reward.level}`
          );
          skipped++;
          continue;
        }

        if (member.roles.cache.has(reward.roleId)) {
          console.log(
            `[LEVEL ROLES]: skip ${label}: already has role ${reward.roleId}`
          );
          skipped++;
          continue;
        }

        try {
          await member.roles.add(
            reward.roleId,
            `Manual level check: level ${level}`
          );

          console.log(
            `[LEVEL ROLES]: added role ${reward.roleId} to ${label}: level ${level}`
          );
          added++;
        } catch (error) {
          console.error(
            `[LEVEL ROLES]: failed role ${reward.roleId} for ${label}:`,
            error
          );
          failed++;
        }
      }
    }
  } catch (error) {
    failed++;
    console.error('[LEVEL ROLES]: check failed:', error);
  } finally {
    checkingLvlRole1 = false;
    console.log(
      `[LEVEL ROLES]: finished! ${checked} non-bot members checked, ` +
      `${added} roles added, ${skipped} skips, ${failed} errors`
    );
  }
}

async function checkLvlRole2(readyClient) {
  return checkLvlRole1(readyClient);
}

async function checkLvlRole3(readyClient) {
  return checkLvlRole1(readyClient);
}

let checkingOldXp = false;

async function checkOldXp(readyClient) {
  if (!readyClient.isReady()) {
    console.log('[OLD XP]: bot is not ready yet.');
    return;
  }
  if (checkingOldXp) {
    console.log('[OLD XP]: scan already running.');
    return;
  }
  checkingOldXp = true;
  let errors = 0;
  let addedMessages = 0;
  let addedXp = 0;
  let completed = 0;
  let alreadyDone = 0;

  try {
    const guild = await readyClient.guilds.fetch(config.guildId);
    const me = await guild.members.fetchMe({ force: true });
    const scan = xpStore.beginOldXp(guild.id, readyClient.user.id, me.joinedTimestamp);
    const first = ((BigInt(scan.cutoff) - 1420070400000n) << 22n).toString();
    console.log(`[OLD XP]: scanning ${guild.name}, before ${new Date(scan.cutoff).toISOString()}`);
    if (scan.cutoff !== me.joinedTimestamp) {
      console.log('[OLD XP]: keeping the saved cutoff from the earlier scan.');
    }
    const targets = new Map();
    const channels = await guild.channels.fetch();
    const add = channel => {
      if (channel?.messages?.fetch) targets.set(channel.id, channel);
    };
    for (const channel of channels.values()) add(channel);
    try {
      const active = await guild.channels.fetchActiveThreads();
      for (const thread of active.threads.values()) add(thread);
    } catch (error) {
      errors++;
      console.error(`[OLD XP]: active thread discovery failed: ${error.message}`);
    }

    for (const channel of channels.values()) {
      if (!channel?.threads?.fetchArchived) continue;
      const permissions = channel.permissionsFor(me);
      if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
          !permissions.has(PermissionFlagsBits.ReadMessageHistory)) {
        errors++;
        console.log(`[OLD XP]: cannot read archived threads in #${channel.name}`);
        continue;
      }
      const kinds = [{ type: 'public' }];
      if (channel.type === ChannelType.GuildText) {
        kinds.push({ type: 'private', fetchAll: permissions.has(PermissionFlagsBits.ManageThreads) });
      }
      for (const kind of kinds) {
        let before;
        let pages = 0;
        try {
          while (true) {
            const page = await channel.threads.fetchArchived({ ...kind, limit: 100, ...(before ? { before } : {}) });
            for (const thread of page.threads.values()) add(thread);
            pages++;
            console.log(`[OLD XP]: #${channel.name}: ${kind.type} archived threads, page ${pages}`);
            if (!page.hasMore) break;
            if (!page.threads.size) throw new Error('empty thread page with more results');
            let next;
            if (kind.type === 'private' && !kind.fetchAll) {
              next = [...page.threads.keys()].reduce((a, b) => BigInt(a) < BigInt(b) ? a : b);
              if (before && BigInt(next) >= BigInt(before)) throw new Error('thread cursor did not advance');
            } else {
              const timestamps = [...page.threads.values()].map(thread => thread.archiveTimestamp);
              if (timestamps.some(time => !Number.isSafeInteger(time))) throw new Error('missing thread archive time');
              next = new Date(Math.min(...timestamps));
              if (before && next.getTime() >= before.getTime()) throw new Error('thread cursor did not advance');
            }
            before = next;
          }
        } catch (error) {
          errors++;
          console.error(`[OLD XP]: #${channel.name}: ${kind.type} thread discovery failed: ${error.message}`);
        }
      }
    }

    console.log(`[OLD XP]: found ${targets.size} channels and threads.`);
    let index = 0;
    for (const channel of targets.values()) {
      index++;
      let state = scan.channels[channel.id];
      const label = `[${index}/${targets.size}] #${channel.name}`;
      if (state?.done) {
        alreadyDone++;
        console.log(`[OLD XP]: ${label}: already done`);
        continue;
      }
      const permissions = channel.permissionsFor(me);
      if (!permissions?.has(PermissionFlagsBits.ViewChannel) ||
          !permissions.has(PermissionFlagsBits.ReadMessageHistory)) {
        errors++;
        console.log(`[OLD XP]: ${label}: missing view channel or read message history`);
        continue;
      }
      console.log(`[OLD XP]: ${label}: scanning...`);
      while (!state?.done) {
        const before = state?.before || first;
        let batch;
        try {
          batch = await channel.messages.fetch({ limit: 100, before, cache: false });
        } catch (error) {
          errors++;
          console.error(`[OLD XP]: ${label}: ${error.message}. progress saved, rerun to retry.`);
          break;
        }
        state = xpStore.applyOldXpBatch(guild.id, channel.id, before, [...batch.values()]);
        addedMessages += state.addedMessages;
        addedXp += state.addedXp;
        console.log(`[OLD XP]: ${label}: ${state.messages} messages, ${state.xp} XP${state.done ? ' (done)' : ''}`);
      }
      if (state?.done) completed++;
    }
    console.log(`[OLD XP]: finished! +${addedXp} XP from ${addedMessages} old messages. ${completed} channels completed, ${alreadyDone} already done, ${errors} access/discovery errors.`);
    if (errors) console.log('[OLD XP]: some history could not be read. fix access if needed, then run check oldxp again.');
    console.log('[OLD XP]: use check lvlrole1 to update level roles. level rewards sync on the next message, VC XP payout or restart.');
  } catch (error) {
    console.error('[OLD XP]: scan stopped; saved batches are kept. run check oldxp again to resume:', error);
  } finally {
    checkingOldXp = false;
  }
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  const receivedAge = Date.now() - interaction.createdTimestamp;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error('[SLASH COMMAND ERROR]:', {
      command: interaction.commandName,
      code: error.code,
      message: error.message,
      receivedAgeMs: receivedAge,
      failedAgeMs: Date.now() - interaction.createdTimestamp
    });

    if ([10062, 40060].includes(Number(error.code))) return;

    const errorResponse = {
      content:
        `\`${String(error.message).replace(/`/g, "'").slice(0, 1500)}\`\n` +
        'Error! Please report this to ales.js (<@1044985132777480253>)',
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] }
    };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorResponse);
      } else {
        await interaction.reply(errorResponse);
      }
    } catch (replyError) {
      console.error('[SLASH ERROR RESPONSE FAILED]:', {
        command: interaction.commandName,
        code: replyError.code,
        message: replyError.message
      });
    }
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

const xpJobs = new Map();

function awardXp(guild, user, member, amount, channel, fromVc = false) {
  const previous = xpJobs.get(user.id) || Promise.resolve();
  const job = previous.catch(() => {}).then(async () => {
    const userId = user.id;
    const result = xpStore.addXp(userId, amount);
    try {
      await syncLevelRewards(guild.id, userId, member);
    } catch (error) {
      console.error(`[LEVEL REWARDS]: failed for ${userId}:`, error);
    }

    if (guild.id === config.guildId && member) {
      for (const { level, roleId } of lvlRoles) {
        if (!roleId || result.level < level) continue;
        if (member.roles.cache.has(roleId)) continue;

        try {
          await member.roles.add(
            roleId,
            `Reached level ${level}`
          );
        } catch (error) {
          console.error(
            `[LEVEL ROLE ERROR]: failed to give ${roleId} to ${userId}:`,
            error
          );
        }
      }
    }

    if (result.leveledUp) {
      const embedColor = getUserEmbedColor(
        guild.id,
        userId,
        member
      );

      const reward = levelRewards.rewards.find(r => r.level === result.level);
      const nextReward = levelRewards.rewards.find(r => r.level > result.level);

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('Leveled Up!')
        .setDescription([
          `HURRA, ${user}! you leveled up.`,
          `> Level: **${result.level}**`,
          `> XP: **${xpStore.getUserProgress(userId).totalXp.toLocaleString('en-US')}**`,
          `> Reward Unlocked: **${reward ? levelRewards.describe(reward, config) : 'None'}**`,
          `> Next Reward: **${nextReward ? `${levelRewards.describe(nextReward, config)} (level ${nextReward.level})` : 'All level rewards unlocked!'}**`,
          '-# use `?level` to see XP bar and `?level rewards` to see all leveling rewards.'
        ].join('\n'))
        .setTimestamp();

      if (fromVc) {
        channel = config.vcLevelUpChannelId
          ? guild.channels.cache.get(config.vcLevelUpChannelId) ||
            await guild.channels.fetch(config.vcLevelUpChannelId)
          : null;
      }
      if (channel?.isTextBased() && typeof channel.send === 'function') {
        await channel.send({ embeds: [embed] });
      } else if (fromVc) {
        console.error('[VC XP]: level-up earned, but vcLevelUpChannelId is missing or invalid.');
      }
    }
  });
  xpJobs.set(user.id, job);
  const cleanup = () => {
    if (xpJobs.get(user.id) === job) xpJobs.delete(user.id);
  };
  job.then(cleanup, cleanup);
  return job;
}

// Leveling \\
client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  try {
    activityStore.recordMessage(message);
  } catch (error) {
    console.error('[ACTIVITY ERROR]: Failed to count message:', error);
  }

  try {
    await handleEconomyCommand(message);
  } catch (error) {
    console.error('[ECONOMY COMMAND ERROR]:', error);
  }

  try {
    const baseXpAdd = Math.floor(Math.random() * 10) + 5;
    await awardXp(message.guild, message.author, message.member, baseXpAdd, message.channel);
  } catch (error) {
    console.error('[XP ERROR]: Failed to award message XP or send level-up:', error);
  }
});

client.login(config.token);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', input => {
  const cmd = input.trim().toLowerCase();
  if (!cmd) return;

  if (cmd === 're') {
    console.log('[CONSOLE INFO]: restarting...');
    process.exit(0);
  } else if (cmd === 'check oldxp') {
    checkOldXp(client).catch(error => console.error('[OLD XP]:', error));
  } else if (cmd === 'check messages') {
    const guild = client.guilds.cache.get(config.guildId);
    if (!client.isReady() || !guild) console.log('[MESSAGES]: bot is not ready yet.');
    else activityStore.scanMessages(guild, true);
  } else if (cmd === 'check lvlrole1') {
    checkLvlRole1(client).catch(error => {
      console.error('[LEVEL ROLES]: check failed:', error);
    });
  } else if (cmd === 'check lvlrole2') {
    checkLvlRole2(client).catch(error => {
      console.error('[LEVEL ROLES]: check failed:', error);
    });
  } else if (cmd === 'check lvlrole3') {
    checkLvlRole3(client).catch(error => {
      console.error('[LEVEL ROLES]: check failed:', error);
    });
  } else if (cmd === 'exit') {
    console.log('[CONSOLE INFO]: shutting down...');
    process.exit(42);
  } else {
    console.log(`[CONSOLE ERROR]: unknown command '${cmd}'`);
  }
});

rl.on('SIGINT', () => process.exit(42));