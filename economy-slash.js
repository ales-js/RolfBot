const { Collection, MessageFlags } = require('discord.js');

function getRequest(interaction, command) {
  const str = name => interaction.options.getString(name)?.trim() || null;
  const target = interaction.options.getUser('user');
  const mention = target ? `<@${target.id}>` : null;
  const action = str('action');
  const request = { command, target, args: [], admin: false };
  const need = (value, message) => {
    if (!value) throw new Error(message);
    return value;
  };
  const token = (value, message) => {
    need(value, message);
    if (/\s/.test(value)) throw new Error(message);
    return value;
  };
  switch (command) {
    case 'balance':
      request.args = mention ? [mention] : [];
      break;
    case 'rob':
      request.args = [need(mention, 'Select a user.')];
      break;
    case 'give':
      request.args = [need(mention, 'Select a user.'), token(str('amount'), 'Enter an amount, all, half, or quarter.')];
      break;
    case 'deposit':
    case 'withdraw':
    case 'slots':
      request.args = [token(str('amount'), 'Enter an amount, all, half, or quarter.')];
      break;
    case 'roulette':
      request.args = [token(str('amount'), 'Enter an amount, all, half, or quarter.'), need(str('space'), 'Enter a roulette space.')];
      break;
    case 'leaderboard':
      request.args = str('category') ? [str('category')] : [];
      break;
    case 'settings': {
      const setting = str('setting');
      const value = str('value');
      if (setting === 'color') request.args = ['color', token(value, 'For color, enter a HEX color or reset in value.')];
      else if (setting === 'badges' && !value) request.args = ['badges'];
      else if (setting || value) throw new Error('Choose badges without a value, or color with a HEX value or reset.');
      break;
    }
    case 'stats':
    case 'achievements': {
      const statistic = str('statistic');
      const amount = str('amount');
      const achievement = str('achievement');
      if (!action) {
        if (target || statistic || amount || achievement) throw new Error('Choose an action when supplying admin options.');
        break;
      }
      request.admin = true;
      const actions = command === 'stats' ? ['edit', 'add', 'remove', 'reset', 'list'] : ['grant', 'revoke', 'auto', 'list'];
      if (!actions.includes(action)) throw new Error('Invalid admin action.');
      if (action === 'list') {
        if (target || statistic || amount || achievement) throw new Error('The list action takes no other options.');
        request.args = ['list'];
      } else if (command === 'stats') {
        request.args = [action, need(mention, 'Select a user.'), token(statistic, 'Enter a statistic name.')];
        if (action !== 'reset') request.args.push(token(amount, 'Enter an amount.'));
        else if (amount) throw new Error('The reset action takes no amount.');
      } else {
        request.args = [action, need(mention, 'Select a user.'), token(achievement, 'Enter an achievement ID or all.')];
      }
      break;
    }
    case 'add-money':
    case 'remove-money':
    case 'set-money':
      request.admin = true;
      request.args = [need(mention, 'Select a user.'), String(interaction.options.getInteger('amount', true)), need(str('pocket'), 'Select wallet or bank.')];
      break;
    case 'reset-cooldown':
      request.admin = true;
      request.args = [need(mention, 'Select a user.'), need(str('command'), 'Select a cooldown.')];
      break;
    case 'adminhelp':
      request.admin = true;
      break;
  }
  return request;
}

async function sendError(interaction, error) {
  if ([10062, 40060].includes(Number(error?.code))) return;
  const reply = {
    content: `\`${String(error.message || error).replace(/`/g, "'").slice(0, 1600)}\`\nError! Please report this to ales.js (<@1044985132777480253>)`,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] }
  };
  try {
    if (interaction.deferred && !interaction.replied) {
      await interaction.deleteReply().catch(() => {});
      return await interaction.followUp(reply);
    }
    if (interaction.replied || interaction.deferred) return await interaction.followUp(reply);
    return await interaction.reply(reply);
  } catch (replyError) {
    logSlashError(interaction, replyError, 'error response failed');
  }
}

function logSlashError(interaction, error, stage = 'command failed') {
  console.error('[ECONOMY SLASH ERROR]:', JSON.stringify({
    command: interaction.commandName,
    stage,
    code: error?.code,
    message: String(error?.message || error),
    ageMs: Date.now() - interaction.createdTimestamp,
    deferred: interaction.deferred,
    replied: interaction.replied
  }));
}

async function runEconomySlash(interaction, command) {
  try {
    if (!interaction.guildId) {
      return await interaction.reply({ content: 'use this command in a server.', flags: MessageFlags.Ephemeral });
    }
    let request;
    try {
      request = getRequest(interaction, command);
    } catch (error) {
      return await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral });
    }
    if (request.admin) {
      const config = require('./config.json');
      if (typeof config.ownerId !== 'string' || interaction.user.id !== config.ownerId) {
        console.warn('[ECONOMY ADMIN DENIED]:', JSON.stringify({ status: 'DENIED', userId: interaction.user.id,
          username: interaction.user.username, guildId: interaction.guildId, command: interaction.commandName }));
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.deleteReply();
        return;
      }
    }
    await interaction.deferReply();
    const guild = interaction.guild || await interaction.client.guilds.fetch(interaction.guildId);
    const member = interaction.member?.roles?.cache
      ? interaction.member : await guild.members.fetch(interaction.user.id);
    const channel = interaction.channel || await interaction.client.channels.fetch(interaction.channelId);
    if (!channel?.isTextBased() || typeof channel.send !== 'function') throw new Error('This command needs a server text channel.');
    const users = new Collection();
    const members = new Collection();
    if (request.target) {
      const resolved = guild.members.cache.get(request.target.id)
        || await guild.members.fetch(request.target.id).catch(() => null);
      if (!resolved) {
        await interaction.deleteReply();
        return await interaction.followUp({ content: 'That user is not a member of this server.', flags: MessageFlags.Ephemeral });
      }
      users.set(resolved.id, resolved.user);
      members.set(resolved.id, resolved);
    }
    let firstReply = true;
    const message = {
      id: interaction.id,
      content: `?${request.command}${request.args.length ? ` ${request.args.join(' ')}` : ''}`,
      author: interaction.user,
      member, guild, guildId: guild.id, channel, channelId: channel.id,
      client: interaction.client,
      mentions: { users, members },
      async reply(payload) {
        const data = typeof payload === 'string' ? { content: payload } : { ...payload };
        if (typeof data.content === 'string' && data.content.includes('Error! Please report this to ales.js')) {
          data.flags = MessageFlags.Ephemeral;
          if (firstReply) {
            firstReply = false;
            await interaction.deleteReply();
          }
          return interaction.followUp(data);
        }
        if (firstReply) {
          firstReply = false;
          return interaction.editReply(data);
        }
        if (Date.now() - interaction.createdTimestamp >= 14 * 60 * 1000) {
          return channel.send(data);
        }
        return interaction.followUp(data);
      }
    };
    const { handleEconomyCommand } = require('./economy');
    const handled = await handleEconomyCommand(message);
    if (!handled) throw new Error(`Unknown economy command: ${request.command}`);
    if (firstReply) await interaction.deleteReply();
    console.log(`[COMMAND LOG]: /${interaction.commandName} used by @${interaction.user.username} (${interaction.user.id})`);
  } catch (error) {
    logSlashError(interaction, error);
    return await sendError(interaction, error);
  }
}

module.exports = { runEconomySlash, sendSlashError: sendError, logSlashError };