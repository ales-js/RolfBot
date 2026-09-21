const hour = 60 * 60 * 1000;

function definition(item) {
  if (item.powerup === undefined) return null;
  const p = item.powerup;
  if (!p || p.type !== 'xp' || ![2, 3].includes(p.multiplier) ||
      !Number.isFinite(p.durationHours) || p.durationHours <= 0 ||
      !Number.isSafeInteger(p.durationHours * hour) ||
      !Number.isFinite(p.purchaseCooldownHours) || p.purchaseCooldownHours <= 0 ||
      !Number.isSafeInteger(p.purchaseCooldownHours * hour) ||
      !Number.isSafeInteger((p.durationHours + p.purchaseCooldownHours) * hour)) {
    throw new Error(`err shop_item ${item.id} has invalid xp powerup properties`);
  }
  return { type: 'xp', multiplier: p.multiplier, durationHours: p.durationHours,
    purchaseCooldownHours: p.purchaseCooldownHours };
}

function active(account, now = Date.now()) {
  const p = account.xpPowerup;
  return p && p.startedAt <= now && p.expiresAt > now ? p : null;
}

function blockedUntil(account, now = Date.now()) {
  return Math.max(active(account, now)?.expiresAt || 0, account.xpPowerupAvailableAt || 0);
}

function blockedMessage(account, now = Date.now()) {
  const until = blockedUntil(account, now);
  if (until <= now) return null;
  return `You can buy another XP powerup <t:${Math.ceil(until / 1000)}:R>.`;
}

function activate(account, item, now = Date.now()) {
  const p = definition(item);
  if (!p) throw new Error('err this item is not an xp powerup');
  const blocked = blockedMessage(account, now);
  if (blocked) throw new Error(blocked);
  const expiresAt = now + p.durationHours * hour;
  account.xpPowerup = { itemId: item.id, name: item.name, multiplier: p.multiplier,
    startedAt: now, expiresAt };
  account.xpPowerupAvailableAt = expiresAt + p.purchaseCooldownHours * hour;
  return account.xpPowerup;
}

function description(item) {
  const p = item.powerup;
  return `-# ${p.multiplier}x message and VC XP for ${p.durationHours}h. Used immediately.\n` +
    `-# All XP powerups are locked until ${p.purchaseCooldownHours}h after this one expires. XP Powerups don't stack.`;
}

function fields(account, now = Date.now()) {
  const p = active(account, now);
  const until = blockedUntil(account, now);
  return [
    { name: 'XP Powerup', value: p
      ? `${p.name}\nExpires <t:${Math.ceil(p.expiresAt / 1000)}:R> (<t:${Math.ceil(p.expiresAt / 1000)}:f>)`
      : 'None', inline: false },
    { name: 'Next XP Powerup Purchase:', value: until > now
      ? `<t:${Math.ceil(until / 1000)}:R> (<t:${Math.ceil(until / 1000)}:f>)`
      : 'Ready now', inline: false }
  ];
}

module.exports = { definition, active, blockedUntil, blockedMessage, activate, description, fields };