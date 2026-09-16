const rewards = [
  {
    "level": 1,
    "money": 250
  },
  {
    "level": 2,
    "work": 2
  },
  {
    "level": 3,
    "beg": 2
  },
  {
    "level": 4,
    "money": 750
  },
  {
    "level": 5,
    "roleConfig": "lvlRole1Id"
  },
  {
    "level": 6,
    "money": 800
  },
  {
    "level": 7,
    "money": 900
  },
  {
    "level": 8,
    "money": 1000
  },
  {
    "level": 9,
    "beg": 5
  },
  {
    "level": 10,
    "money": 2000,
    "roleConfig": "lvlRole3Id"
  },
  {
    "level": 11,
    "money": 1250
  },
  {
    "level": 12,
    "shop": 2
  },
  {
    "level": 13,
    "money": 1500
  },
  {
    "level": 14,
    "money": 1600
  },
  {
    "level": 15,
    "roleConfig": "lvlRole2Id"
  },
  {
    "level": 16,
    "work": 5
  },
  {
    "level": 17,
    "money": 1750
  },
  {
    "level": 18,
    "money": 2000
  },
  {
    "level": 19,
    "money": 2250
  },
  {
    "level": 20,
    "money": 3000,
    "shop": 5
  },
  {
    "level": 21,
    "money": 2500
  },
  {
    "level": 22,
    "beg": 10
  },
  {
    "level": 23,
    "money": 2750
  },
  {
    "level": 24,
    "money": 3000
  },
  {
    "level": 25,
    "badge": true
  },
  {
    "level": 26,
    "work": 7
  },
  {
    "level": 27,
    "money": 3250
  },
  {
    "level": 28,
    "money": 3500
  },
  {
    "level": 29,
    "money": 3750
  },
  {
    "level": 30,
    "money": 5000
  },
  {
    "level": 31,
    "money": 4000
  },
  {
    "level": 32,
    "shop": 6
  },
  {
    "level": 33,
    "money": 4250
  },
  {
    "level": 34,
    "money": 4500
  },
  {
    "level": 35,
    "money": 6000
  },
  {
    "level": 36,
    "work": 10
  },
  {
    "level": 37,
    "money": 4750
  },
  {
    "level": 38,
    "money": 5000
  },
  {
    "level": 39,
    "money": 5250
  },
  {
    "level": 40,
    "money": 7500,
    "shop": 8
  },
  {
    "level": 41,
    "money": 5500
  },
  {
    "level": 42,
    "beg": 15
  },
  {
    "level": 43,
    "money": 5750
  },
  {
    "level": 44,
    "money": 6000
  },
  {
    "level": 45,
    "money": 8000
  },
  {
    "level": 46,
    "money": 6250
  },
  {
    "level": 47,
    "money": 6500
  },
  {
    "level": 48,
    "money": 7000
  },
  {
    "level": 49,
    "work": 15
  },
  {
    "level": 50,
    "money": 10000,
    "shop": 10
  }
];
const badge = {
  id: 'level_25_kosmosnaut', name: 'Kosmosnaut', badge: '🚀',
  description: 'Reach level 25.'
};

function bonuses(level) {
  const result = { work: 0, beg: 0, shop: 0 };
  for (const reward of rewards) {
    if (reward.level > level) break;
    for (const key of Object.keys(result)) {
      if (reward[key] !== undefined) result[key] = reward[key];
    }
  }
  return result;
}

function apply(data, account, guildId, userId, level) {
  if (!Number.isSafeInteger(level) || level < 1) return;
  data.levelRewardClaims ||= {};
  data.levelRewardClaims[guildId] ||= {};
  const claims = new Set(data.levelRewardClaims[guildId][userId] || []);
  for (const reward of rewards) {
    if (reward.level > level) break;
    if (claims.has(reward.level)) continue;
    account.wallet += reward.money || 0;
    claims.add(reward.level);
  }
  data.levelRewardClaims[guildId][userId] = [...claims];
  const highestLevel = Math.max(level, ...claims);
  account.levelRewardLevel = highestLevel;
  account.levelBonuses = bonuses(highestLevel);
  account.levelBadges = highestLevel >= 25 ? [badge.id] : [];
}

function price(account, item) {
  return Math.ceil(item.price * (100 - (account.levelBonuses?.shop || 0)) / 100);
}

function earnings(account, type, base) {
  return Math.floor(base * (100 + (account.levelBonuses?.[type] || 0)) / 100);
}

function describe(reward, config) {
  const parts = [];
  if (reward.money) parts.push(`${reward.money.toLocaleString('en-US')} Ostmark`);
  if (reward.work) parts.push(`total work earnings bonus: +${reward.work}%`);
  if (reward.beg) parts.push(`total beg earnings bonus: +${reward.beg}%`);
  if (reward.shop) parts.push(`total shop discount: ${reward.shop}%`);
  if (reward.roleConfig) {
    const role = config[reward.roleConfig];
    let text = role ? `<@&${role}>` : `level ${reward.level} role`;
    if (reward.level === 5) text += ' (Ballsdex channel access)';
    if (reward.level === 10) text += ' (Moderator applications access)';
    if (reward.level === 15) text += ' (create emojis, stickers and sounds permission)';
    parts.push(text);
  }
  if (reward.badge) parts.push('🚀 Kosmosnaut badge');
  return parts.join(' + ');
}

module.exports = { rewards, badge, bonuses, apply, price, earnings, describe };