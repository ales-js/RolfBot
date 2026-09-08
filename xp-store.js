const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const xpFile = path.join(__dirname, 'xp.json');
const xpFormat = 'rolfbot-total-xp-v1';

function requireWholeNumber(value, minimum, name) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe whole number of at least ${minimum}.`);
  }
}

function xpAtLevel(level) {
  requireWholeNumber(level, 1, 'Level');
  const total = 50 * level * (level - 1);
  requireWholeNumber(total, 0, 'Total XP');
  return total;
}

function levelFromXp(totalXp) {
  requireWholeNumber(totalXp, 0, 'Total XP');
  let level = Math.floor((1 + Math.sqrt(1 + totalXp / 12.5)) / 2);
  // Correct any floating-point rounding at an exact level boundary.
  while (50 * level * (level - 1) > totalXp) level--;
  while (50 * level * (level + 1) <= totalXp) level++;
  return level;
}

function validateUsers(users, legacy = false) {
  if (!users || typeof users !== 'object' || Array.isArray(users)) {
    throw new Error('xp.json must contain a user object. No XP was changed.');
  }
  for (const [userId, account] of Object.entries(users)) {
    if (!/^\d{17,20}$/.test(userId) || !account || typeof account !== 'object' || Array.isArray(account)) {
      throw new Error(`Invalid XP account: ${userId}. No XP was changed.`);
    }
    requireWholeNumber(account.xp, 0, `XP for ${userId}`);
    requireWholeNumber(account.level, 1, `Level for ${userId}`);
    if (legacy) {
      if (account.xp >= account.level * 100) {
        throw new Error(`XP for ${userId} exceeds its current level requirement. Migration stopped to preserve progress.`);
      }
      requireWholeNumber(xpAtLevel(account.level) + account.xp, 0, `Total XP for ${userId}`);
    } else if (levelFromXp(account.xp) !== account.level) {
      throw new Error(`Level and total XP disagree for ${userId}. Use /setxp or /setlevel instead of editing only one field.`);
    }
  }
}

function saveXp(users) {
  validateUsers(users);
  const temporaryFile = `${xpFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify({ format: xpFormat, users }, null, 2));
  fs.renameSync(temporaryFile, xpFile);
}

function loadXp() {
  if (!fs.existsSync(xpFile)) {
    saveXp({});
    return {};
  }
  const raw = fs.readFileSync(xpFile, 'utf8');
  if (!raw.trim()) throw new Error('xp.json is empty. Restore its contents before starting the bot.');
  const stored = JSON.parse(raw);
  if (stored?.format === xpFormat) {
    validateUsers(stored.users);
    return stored.users;
  }
  if (stored && Object.prototype.hasOwnProperty.call(stored, 'format')) {
    throw new Error('Unrecognized xp.json format. No XP was changed.');
  }
  validateUsers(stored, true);
  const converted = {};
  for (const [userId, account] of Object.entries(stored)) {
    converted[userId] = { ...account, xp: xpAtLevel(account.level) + account.xp };
  }
  validateUsers(converted);
  const backupFile = path.join(__dirname, `xp.before-total-xp-${Date.now()}-${randomUUID()}.json`);
  // The original file must be backed up successfully before replacing it.
  fs.writeFileSync(backupFile, raw, { flag: 'wx' });
  saveXp(converted);
  console.log(`[XP MIGRATION]: Converted ${Object.keys(converted).length} accounts. Backup: ${path.basename(backupFile)}`);
  return converted;
}

function getAccount(users, userId) {
  if (!/^\d{17,20}$/.test(userId)) throw new Error('Invalid XP user ID.');
  return users[userId] || { xp: 0, level: 1 };
}

function getProgress(account) {
  const level = levelFromXp(account.xp);
  const progressXp = account.xp - xpAtLevel(level);
  const requiredXp = level * 100;
  return { level, totalXp: account.xp, progressXp, requiredXp, remainingXp: requiredXp - progressXp };
}

function getUserProgress(userId) {
  return getProgress(getAccount(loadXp(), userId));
}

function addXpToData(users, userId, amount) {
  requireWholeNumber(amount, 0, 'XP amount');
  const previous = getAccount(users, userId);
  const totalXp = previous.xp + amount;
  requireWholeNumber(totalXp, 0, 'Total XP');
  const level = levelFromXp(totalXp);
  users[userId] = { ...previous, xp: totalXp, level };
  return { ...getProgress(users[userId]), previousLevel: previous.level, leveledUp: level > previous.level };
}

function addXp(userId, amount) {
  const users = loadXp();
  const result = addXpToData(users, userId, amount);
  saveXp(users);
  return result;
}

function setTotalXp(userId, amount) {
  requireWholeNumber(amount, 0, 'Total XP');
  const users = loadXp();
  users[userId] = { ...getAccount(users, userId), xp: amount, level: levelFromXp(amount) };
  saveXp(users);
  return getProgress(users[userId]);
}

function setLevel(userId, level) {
  const baseXp = xpAtLevel(level);
  const users = loadXp();
  const account = getAccount(users, userId);
  const { progressXp } = getProgress(account);
  if (progressXp >= level * 100) {
    throw new Error(`Cannot keep ${progressXp} progress XP at level ${level} (requires less than ${level * 100}). Set a lower total XP first or choose a higher level.`);
  }
  const totalXp = baseXp + progressXp;
  requireWholeNumber(totalXp, 0, 'Total XP');
  users[userId] = { ...account, xp: totalXp, level };
  saveXp(users);
  return getProgress(users[userId]);
}

function resetLevel(userId) {
  const users = loadXp();
  getAccount(users, userId);
  users[userId] = { xp: 0, level: 1 };
  saveXp(users);
}

module.exports = {
  loadXp, saveXp, xpAtLevel, levelFromXp, getProgress, getUserProgress,
  addXpToData, addXp, setTotalXp, setLevel, resetLevel
};