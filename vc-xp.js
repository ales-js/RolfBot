const { ChannelType } = require('discord.js');

const interval = 5 * 60 * 1000;
const minimumHumans = 2;

const rates = {
  mutedAndDeafened: 0,
  stageAudience: 90,
  camera: 300,
  streaming: 240,
  muted: 120,
  normal: 180
};

function getRate(state) {
  const muted = state.selfMute || state.serverMute;
  const deafened = state.selfDeaf || state.serverDeaf;
  if (muted && deafened) return rates.mutedAndDeafened;
  if (state.channel?.type === ChannelType.GuildStageVoice && state.suppress === true) {
    return rates.stageAudience;
  }
  if (state.selfVideo) return rates.camera;
  if (state.streaming) return rates.streaming;
  if (muted) return rates.muted;
  return rates.normal;
}

function createTracker(getPowerup = () => null) {
  const users = new Map();

  function settle(now) {
    for (const user of users.values()) {
      const elapsed = Math.max(0, now - user.last);
      const powerup = getPowerup(user.member);
      const boostedMs = powerup ? Math.max(0,
        Math.min(now, powerup.expiresAt) - Math.max(user.last, powerup.startedAt)) : 0;
      user.credit += (elapsed + boostedMs * ((powerup?.multiplier || 1) - 1)) * user.rate;
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
      user.rate = counts.get(state.channelId) >= minimumHumans
        && state.channelId !== state.guild?.afkChannelId
        ? getRate(state)
        : 0;
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

function start(client, { guildId, award, getPowerup = () => null, onError = console.error }) {
  const tracker = createTracker(getPowerup);
  let busy = false;
  let connected = true;
  const now = () => Date.now();
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

module.exports = { interval, minimumHumans, rates, getRate, createTracker, start };