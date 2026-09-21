const fs = require('fs');
const path = require('path');
const { guildId: allowedGuildId } = require('./config.json');

const file = path.join(__dirname, 'activity.json');
const stored = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
if (stored?.format && stored.format !== 'rolfbot-activity-v2') throw new Error('unknown activity format');
const data = stored?.format === 'rolfbot-activity-v2' ? stored.users : stored;
const history = stored?.format === 'rolfbot-activity-v2' ? stored.history || {} : {};
const scans = new Map();
if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid activity.json');
for (const users of Object.values(data)) {
  if (!users || typeof users !== 'object' || Array.isArray(users)) throw new Error('invalid activity.json');
  for (const stats of Object.values(users)) {
    if (!stats || !Number.isSafeInteger(stats.messages) || stats.messages < 0 ||
        !Number.isSafeInteger(stats.voiceMs) || stats.voiceMs < 0) throw new Error('invalid activity stats');
  }
}
const sessions = new Map();
let started = false;

function account(guildId, userId) {
  data[guildId] ??= {};
  return data[guildId][userId] ??= { messages: 0, voiceMs: 0 };
}

function save() {
  fs.writeFileSync(`${file}.tmp`, JSON.stringify({ format: 'rolfbot-activity-v2', users: data, history }, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}

function checkpoint(now = Date.now()) {
  for (const session of sessions.values()) {
    account(session.guildId, session.userId).voiceMs += Math.max(0, now - session.since);
    session.since = now;
  }
}

function flush() {
  checkpoint();
  save();
}

function recordMessage(message) {
  if (message.guild?.id !== allowedGuildId) return;
  if (!message.guild || message.author.bot || message.webhookId || message.system) return;
  const guildId = message.guild.id;
  const userId = message.author.id;
  account(guildId, userId).messages++;
  const scan = scans.get(guildId);
  if (scan && BigInt(message.id) >= BigInt(scan.cutoff)) {
    scan.live[userId] = (scan.live[userId] || 0) + 1;
  }
  save();
}

function getStats(guildId, userId) {
  const stats = data[guildId]?.[userId] || { messages: 0, voiceMs: 0 };
  const session = sessions.get(`${guildId}:${userId}`);
  return { ...stats, voiceMs: stats.voiceMs + (session ? Math.max(0, Date.now() - session.since) : 0) };
}

function updateVoice(state) {
  if (state.guild.id !== allowedGuildId) return;
  const key = `${state.guild.id}:${state.id}`;
  if (state.channelId && state.member?.user.bot === false) {
    if (!sessions.has(key)) sessions.set(key, { guildId: state.guild.id, userId: state.id, since: Date.now() });
  } else {
    sessions.delete(key);
  }
}

function start(client) {
  if (started) return;
  started = true;
  const sync = shardId => {
    checkpoint();
    for (const guild of client.guilds.cache.values()) {
      if (guild.id !== allowedGuildId) continue;
      if (shardId !== undefined && guild.shardId !== shardId) continue;
      for (const [key, session] of sessions) if (session.guildId === guild.id) sessions.delete(key);
      if (guild.available !== false) for (const state of guild.voiceStates.cache.values()) updateVoice(state);
    }
    save();
  };
  const safe = fn => (...args) => {
    try { fn(...args); } catch (error) { console.error('[ACTIVITY ERROR]:', error); }
  };
  client.once('ready', safe(() => sync()));
  client.on('voiceStateUpdate', safe((oldState, newState) => {
    if (newState.guild.id !== allowedGuildId) return;
    checkpoint();
    updateVoice(newState);
    save();
  }));
  client.on('guildCreate', safe(() => sync()));
  const stopGuild = guild => {
    if (guild.id !== allowedGuildId) return;
    checkpoint();
    for (const [key, session] of sessions) if (session.guildId === guild.id) sessions.delete(key);
    save();
  };
  client.on('guildDelete', safe(stopGuild));
  client.on('guildUnavailable', safe(stopGuild));
  client.on('guildAvailable', safe(() => sync()));
  client.on('shardDisconnect', safe((event, shardId) => {
    checkpoint();
    for (const [key, session] of sessions) {
      if (client.guilds.cache.get(session.guildId)?.shardId === shardId) sessions.delete(key);
    }
    save();
  }));
  client.on('shardResume', safe(shardId => sync(shardId)));
  client.on('shardReady', safe(shardId => sync(shardId)));
  setInterval(safe(flush), 30000).unref();
  process.on('exit', safe(flush));
  process.once('SIGTERM', () => process.exit(0));
  process.once('SIGINT', () => process.exit(42));
}


function getUserIds(guildId) {
  return Object.keys(data[guildId] || {});
}

function getHistoryStatus(guildId) {
  return scans.has(guildId) ? 'scanning' : history[guildId]?.completedAt ? 'complete' : 'pending';
}

async function scanMessages(guild, force = false) {
  if (guild.id !== allowedGuildId) return;
  if (scans.has(guild.id)) {
    console.log('[MESSAGES]: scan already running.');
    return;
  }
  if (!force && history[guild.id]?.completedAt) return;
  const scan = { cutoff: ((BigInt(Date.now()) - 1420070400000n) << 22n).toString(), live: {} };
  scans.set(guild.id, scan);
  console.log(`[MESSAGES]: scanning history in ${guild.name}...`);
  const counts = {};
  let total = 0;
  let skipped = 0;
  let progressTimer;
  const targets = new Map();
  const inaccessible = error => [50001, 50013, 10003].includes(Number(error.code));
  const add = channel => targets.set(channel.id, channel.name || channel.id);
  try {
    console.log('[MESSAGES]: discovering channels and threads...');
    const channels = await guild.channels.fetch();
    const me = guild.members.me || await guild.members.fetchMe();
    for (const channel of channels.values()) {
      if (!channel || channel.type === 4) continue;
      if (!channel.permissionsFor(me)?.has(['ViewChannel', 'ReadMessageHistory'])) {
        skipped++;
        console.log(`[MESSAGES]: skipped #${channel.name}: missing access/history permission`);
        continue;
      }
      if (channel.messages) add(channel);
      if (!channel.threads) continue;
      console.log(`[MESSAGES]: discovering archived threads in #${channel.name} (${channel.id})...`);
      const modes = ['public'];
      if (channel.type === 0) modes.push(channel.permissionsFor(me).has('ManageThreads') ? 'private' : 'joined');
      for (const mode of modes) {
        let before;
        while (true) {
          const route = mode === 'joined'
            ? `/channels/${channel.id}/users/@me/threads/archived/private`
            : `/channels/${channel.id}/threads/archived/${mode}`;
          const query = new URLSearchParams({ limit: '100' });
          if (before) query.set('before', before);
          let page;
          try { page = await guild.client.rest.get(route, { query }); }
          catch (error) {
            if (!inaccessible(error)) throw error;
            skipped++;
            console.log(`[MESSAGES]: skipped ${mode} archives in #${channel.name}: ${error.message}`);
            break;
          }
          for (const thread of page.threads) add(thread);
          if (!page.has_more) break;
          const last = page.threads.at(-1);
          const next = mode === 'joined' ? last?.id : last?.thread_metadata?.archive_timestamp;
          if (!next || next === before) throw new Error(`archive pagination stalled in ${channel.id}`);
          before = next;
        }
      }
    }
    const active = await guild.client.rest.get(`/guilds/${guild.id}/threads/active`);
    for (const thread of active.threads) add(thread);
    let finished = 0;
    let current = null;
    const progress = () => {
      const ratio = targets.size ? finished / targets.size : 1;
      const filled = Math.floor(ratio * 20);
      return `[${'█'.repeat(filled)}${'░'.repeat(20 - filled)}] ${(ratio * 100).toFixed(1)}% (${finished}/${targets.size} channels/threads processed)`;
    };
    const logCurrent = () => {
      if (!current) return;
      console.log(`[MESSAGES]: ${progress()} | scanning #${current.name} (${current.id}) | ${current.count.toLocaleString('en-US')} user messages here | ${total.toLocaleString('en-US')} total`);
    };
    console.log(`[MESSAGES]: found ${targets.size} channels/threads. Progress is by channel/thread, not message count.`);
    progressTimer = setInterval(logCurrent, 10000);
    progressTimer.unref();
    for (const [channelId, name] of targets) {
      current = { id: channelId, name, count: 0 };
      let incomplete = false;
      logCurrent();
      let before = scan.cutoff;
      while (true) {
        let messages;
        try {
          messages = await guild.client.rest.get(`/channels/${channelId}/messages`, {
            query: new URLSearchParams({ limit: '100', before })
          });
        } catch (error) {
          if (!inaccessible(error)) throw error;
          skipped++;
          incomplete = true;
          console.log(`[MESSAGES]: skipped remaining history in #${name}: ${error.message}`);
          break;
        }
        if (!messages.length) break;
        for (const message of messages) {
          if (!message.author || message.author.bot || message.webhook_id || ![0, 19].includes(message.type)) continue;
          counts[message.author.id] = (counts[message.author.id] || 0) + 1;
          total++;
          current.count++;
        }
        const next = messages.reduce((min, message) => BigInt(message.id) < BigInt(min) ? message.id : min, before);
        if (BigInt(next) >= BigInt(before)) throw new Error(`message pagination stalled in ${channelId}`);
        before = next;
      }
      finished++;
      console.log(`[MESSAGES]: ${progress()} | ${incomplete ? 'partially scanned' : 'finished'} #${name} (${channelId}) | ${current.count.toLocaleString('en-US')} user messages here | ${total.toLocaleString('en-US')} total`);
      current = null;
    }
    const users = new Set([...Object.keys(data[guild.id] || {}), ...Object.keys(counts), ...Object.keys(scan.live)]);
    const previous = new Map([...users].map(id => [id, data[guild.id]?.[id]?.messages || 0]));
    const previousHistory = history[guild.id];
    for (const id of users) account(guild.id, id).messages = (counts[id] || 0) + (scan.live[id] || 0);
    history[guild.id] = { completedAt: Date.now(), scannedMessages: total, skipped };
    try { save(); }
    catch (error) {
      for (const [id, value] of previous) account(guild.id, id).messages = value;
      if (previousHistory) history[guild.id] = previousHistory;
      else delete history[guild.id];
      throw error;
    }
    console.log(`[MESSAGES]: done! ${total.toLocaleString('en-US')} old messages counted; ${skipped} inaccessible channels/archive lists. New messages kept separately during scan.`);
  } catch (error) {
    console.error('[MESSAGES]: scan failed; existing totals kept. Run check messages to retry:', error);
  } finally {
    clearInterval(progressTimer);
    scans.delete(guild.id);
  }
}

module.exports = { recordMessage, getStats, getUserIds, getHistoryStatus, scanMessages, start };