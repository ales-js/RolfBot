const { ChannelType } = require('discord.js');

const interval = 5 * 60 * 1000;

function getRate(state) {
  const muted = state.selfMute || state.serverMute;
  const deafened = state.selfDeaf || state.serverDeaf;
  if (muted && deafened) return 0;
  if (state.channel?.type === ChannelType.GuildStageVoice && state.suppress === true) return 90;
  if (state.selfVideo) return 300;
  if (state.streaming) return 240;
  if (muted) return 120;
  return 180;
}

function createTracker() {
  const users = new Map();

  function settle(now) {
    for (const user of users.values()) {
      user.credit += Math.max(0, now - user.last) * user.rate;
      user.last = now;
    }
  }

  function refresh(states, now) {
    settle(now);
    for (const user of users.values()) user.rate = 0;
    const humans = [...states].filter(state => state.channelId && state.member && !state.member.user.bot);
    const counts = new Map();
    for (const state of humans) counts.set(state.channelId, (counts.get(state.channelId) || 0) + 1);
    for (const state of humans) {
      let user = users.get(state.id);
      if (!user) {
        user = { credit: 0, last: now, rate: 0, member: state.member };
        users.set(state.id, user);
      }
      user.member = state.member;
      user.rate = counts.get(state.channelId) >= 2 && state.channelId !== state.guild?.afkChannelId ? getRate(state) : 0;
    }
  }

  function take(now) {
    settle(now);
    const payouts = [];
    for (const [id, user] of users) {
      const xp = Math.floor(user.credit / interval);
      if (xp > 0) {
        user.credit -= xp * interval;
        payouts.push({ member: user.member, xp });
      }
      if (!user.rate && !user.credit) users.delete(id);
    }
    return payouts;
  }

  return { refresh, take };
}

function start(client, { guildId, award, onError = console.error }) {
  const tracker = createTracker();
  let busy = false;
  let connected = true;
  const now = () => performance.now();
  const guild = () => client.guilds.cache.get(guildId);
  const refresh = () => {
    const current = guild();
    tracker.refresh(connected && current?.available !== false ? current?.voiceStates.cache.values() || [] : [], now());
  };
  const suspend = shardId => {
    if (guild()?.shardId !== shardId) return;
    connected = false;
    refresh();
  };
  const resume = shardId => {
    if (guild()?.shardId !== shardId) return;
    connected = true;
    refresh();
  };
  const voiceUpdate = (oldState, newState) => {
    if (newState.guild.id === guildId) refresh();
  };
  const guildUpdate = changed => {
    if (changed.id === guildId) refresh();
  };
  client.on('voiceStateUpdate', voiceUpdate);
  client.on('shardDisconnect', (event, shardId) => suspend(shardId));
  client.on('shardReconnecting', suspend);
  client.on('shardResume', resume);
  client.on('shardReady', resume);
  client.on('guildUnavailable', guildUpdate);
  client.on('guildAvailable', guildUpdate);
  client.on('guildDelete', guildUpdate);
  refresh();

  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      refresh();
      const payouts = tracker.take(now());
      for (const { member, xp } of payouts) {
        try {
          await award(member, xp);
        } catch (error) {
          onError(`[VC XP]: failed for ${member.id}:`, error);
        }
      }
    } catch (error) {
      onError('[VC XP]: timer failed:', error);
    } finally {
      busy = false;
    }
  }, interval);
  timer.unref();
  return timer;
}

module.exports = { getRate, createTracker, start };