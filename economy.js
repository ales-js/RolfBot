const fs = require('fs');
const path = require('path');
const { randomInt } = require('crypto');
const xpStore = require('./xp-store');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThumbnailBuilder
} = require('discord.js');
const {
  work_success: workResponses,
  work_cooldown: workCooldownResponses,
  crime_success: crimeSuccessResponses,
  crime_fail: crimeFailResponses,
  crime_cooldown: crimeCooldownResponses,
  beg_success: begResponses,
  beg_cooldown: begCooldownResponses
} = require('./economy_responses.json');

const economyFile = path.join(__dirname, 'economy.json');
const shopItemsFile = path.join(__dirname, 'shop_items.json');
const achievementsFile = path.join(__dirname, 'achievements.json');
const commandPrefix = '?';
const failEmbedColor = '#ff5050';
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const commandRepeatCooldownMilliseconds = 500;
const commandCooldowns = new Map();
const economyCleanupClients = new WeakSet();
const economyCleanupRunning = new Set();
const economyCleanupIntervalMilliseconds = 60 * 60 * 1000;

const workConfig = {
  minimumPay: 250,
  maximumPay: 750,
  cooldownMinutes: 30
};

const crimeConfig = {
  minimumPay: 1750,
  maximumPay: 5000,
  minimumFine: 1000,
  maximumFine: 3000,
  successChance: 30,
  cooldownMinutes: 45
};

const robConfig = {
  minimumWalletPercentage: 40,
  maximumWalletPercentage: 50,
  minimumFine: 800,
  maximumFine: 1300,
  successChance: 50,
  cooldownMinutes: 240
};

const begConfig = {
  minimumPay: 25,
  maximumPay: 150,
  cooldownMinutes: 15
};

const dailyIncomeTimeZone = 'Europe/Berlin';

const dailyIncomeDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: dailyIncomeTimeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

const leaderboardConfig = {
  usersPerPage: 10,
  buttonTimeoutMinutes: 2
};

const helpConfig = {
  commandsPerPage: 5,
  buttonTimeoutMinutes: 2
};

const shopConfig = {
  buttonTimeoutMinutes: 2,
  itemsPerPage: 5,
  maximumCategories: 24
};

const achievementConfig = {
  achievementsPerPage: 7,
  buttonTimeoutMinutes: 2
};

const statsConfig = {
  statisticsPerPage: 10,
  buttonTimeoutMinutes: 2
};

const statisticNames = [
  'work',
  'collect',
  'crime_successes',
  'crime_failures',
  'rob_successes',
  'rob_failures',
  'times_robbed',
  'beg',
  'deposits',
  'withdrawals',
  'gives',
  'transfers_received',
  'slots_plays',
  'slots_wins',
  'slots_losses',
  'slots_bronze_wins',
  'slots_silver_wins',
  'slots_gold_wins',
  'slots_platinum_wins',
  'current_slots_win_streak',
  'current_slots_loss_streak',
  'longest_slots_win_streak',
  'longest_slots_loss_streak',
  'current_platinum_followup_losses',
  'platinum_then_losses_record',
  'roulette_games',
  'roulette_wins',
  'roulette_losses',
  'roulette_draws',
  'roulette_bets',
  'roulette_bets_won',
  'roulette_bets_lost',
  'shop_purchases',
  'money_earned_work',
  'money_earned_collect',
  'money_earned_crime',
  'money_earned_rob',
  'money_earned_beg',
  'money_earned_slots',
  'money_earned_roulette',
  'money_earned_total',
  'money_lost_crime',
  'money_lost_rob_fines',
  'money_lost_robbery',
  'money_lost_slots',
  'money_lost_roulette',
  'money_lost_total',
  'money_lost_to_robbery',
  'money_deposited',
  'money_withdrawn',
  'money_given',
  'money_received',
  'slots_wagered',
  'slots_payouts',
  'roulette_wagered',
  'roulette_payouts',
  'shop_money_spent',
  'largest_work_payout',
  'largest_collect_payout',
  'largest_crime_payout',
  'largest_rob_payout',
  'largest_beg_payout',
  'largest_slots_bet',
  'largest_slots_payout',
  'largest_slots_loss',
  'largest_roulette_bet',
  'largest_roulette_payout',
  'largest_roulette_loss',
  'largest_crime_loss',
  'largest_rob_fines_loss',
  'largest_robbery_loss',
  'largest_deposit',
  'largest_withdrawal',
  'largest_give',
  'largest_transfer_received',
  'most_expensive_shop_purchase'
];

const robbingImmunityItemId = 'robbing_immunity';
const robbingImmunityRoleId = '1536497693550190602';
const staatsfeindItemId = 'staatsfeind';
const staatsfeindRoleId = '1545443722613756004';
const income1000ItemId = 'income_1000';
const income1000RoleId = '1533228759262560256';
const staatsfeindSuccessChanceBoost = 25;

const shopRoleIds = new Map([
  [robbingImmunityItemId, robbingImmunityRoleId],
  [staatsfeindItemId, staatsfeindRoleId],
  [income1000ItemId, income1000RoleId]
]);

const dailyIncomeRoles = new Map([
  [income1000RoleId, 1000],
  ['1533921404037238784', 500]
]);

const slotConfig = {
  outcomes: [
    {
      name: 'Bronze',
      emoji: '<:RolfBot_berliner_bronze:1546195312920760410>',
      multiplier: 1.25,
      chance: 28
    },
    {
      name: 'Silver',
      emoji: '<:RolfBot_berliner_silver:1546194641089724557>',
      multiplier: 1.5,
      chance: 18
    },
    {
      name: 'Gold',
      emoji: '<:RolfBot_berliner_gold:1546194660983181352>',
      multiplier: 2,
      chance: 10
    },
    {
      name: 'Platinum',
      emoji: '<:RolfBot_berliner_platinum:1546195287805005844>',
      multiplier: 3,
      chance: 4
    }
  ]
};

const rouletteConfig = {
  bettingSeconds: 30,
  confirmationColor: '#57F287'
};

const rouletteRedNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36
]);

const rouletteOutsideBets = new Map([
  ['red', { label: 'red', multiplier: 2 }],
  ['black', { label: 'black', multiplier: 2 }],
  ['even', { label: 'even', multiplier: 2 }],
  ['odd', { label: 'odd', multiplier: 2 }],
  ['low', { label: '1-18', multiplier: 2 }],
  ['high', { label: '19-36', multiplier: 2 }],
  ['dozen1', { label: '1st 12', multiplier: 3 }],
  ['dozen2', { label: '2nd 12', multiplier: 3 }],
  ['dozen3', { label: '3rd 12', multiplier: 3 }],
  ['column1', { label: 'column 1', multiplier: 3 }],
  ['column2', { label: 'column 2', multiplier: 3 }],
  ['column3', { label: 'column 3', multiplier: 3 }]
]);

const rouletteSpaceAliases = new Map([
  ['red', 'red'],
  ['black', 'black'],
  ['even', 'even'],
  ['odd', 'odd'],
  ['low', 'low'],
  ['1-18', 'low'],
  ['1to18', 'low'],
  ['firsthalf', 'low'],
  ['high', 'high'],
  ['19-36', 'high'],
  ['19to36', 'high'],
  ['secondhalf', 'high'],
  ['1st12', 'dozen1'],
  ['1st', 'dozen1'],
  ['first', 'dozen1'],
  ['first12', 'dozen1'],
  ['dozen1', 'dozen1'],
  ['1-12', 'dozen1'],
  ['1to12', 'dozen1'],
  ['2nd12', 'dozen2'],
  ['2nd', 'dozen2'],
  ['second', 'dozen2'],
  ['second12', 'dozen2'],
  ['dozen2', 'dozen2'],
  ['13-24', 'dozen2'],
  ['13to24', 'dozen2'],
  ['3rd12', 'dozen3'],
  ['3rd', 'dozen3'],
  ['third', 'dozen3'],
  ['third12', 'dozen3'],
  ['dozen3', 'dozen3'],
  ['25-36', 'dozen3'],
  ['25to36', 'dozen3'],
  ['column1', 'column1'],
  ['col1', 'column1'],
  ['1stcolumn', 'column1'],
  ['firstcolumn', 'column1'],
  ['column2', 'column2'],
  ['col2', 'column2'],
  ['2ndcolumn', 'column2'],
  ['secondcolumn', 'column2'],
  ['column3', 'column3'],
  ['col3', 'column3'],
  ['3rdcolumn', 'column3'],
  ['thirdcolumn', 'column3']
]);

const rouletteGames = new Map();

const colorRoleIds = [
  '1532009498678395000', // Maroon
  '1532009581553913977', // IFA Wartburg Red
  '1532009638923599973', // Orange
  '1532009698453229771', // Light Orange
  '1532009814576857229', // Yellow
  '1532009894394335282', // Banana
  '1532010079363137667', // Lime
  '1532009991714898100', // Green
  '1532010188603789415', // Dark Green
  '1532010561863417906', // FDJ Dark Blue
  '1532010265741099158', // Blue
  '1532010832311877724', // Light Blue
  '1532011923045093397', // Lavender
  '1532011835878936697', // Purple
  '1532011972751790260', // Dark Purple
  '1542606848698617896', // Brown
  '1542605629242482738', // White
  '1542607820569051217', // Gray
  '1542606235549962302' // Black
];

const helpAliases = new Set(['help', 'commands', 'command', 'cmd', 'cmds', 'h']);
const balanceAliases = new Set(['bal', 'balance', 'money', 'cash', 'wallet', 'bank', 'b']);
const depositAliases = new Set(['dep', 'deposit', 'transfer', 'd']);
const withdrawAliases = new Set(['withdraw', 'with', 'w']);
const giveAliases = new Set(['give', 'give-money', 'pay', 'donate']);
const workAliases = new Set(['work', 'job']);
const crimeAliases = new Set(['crime', 'criminal']);
const robAliases = new Set(['rob', 'steal', 'heist', 'mug']);
const begAliases = new Set(['beg', 'slut']);
const collectAliases = new Set(['collect', 'daily', 'claim']);
const slotAliases = new Set(['slot', 'slots', 's']);
const rouletteAliases = new Set(['roulette', 'roulete', 'roul', 'rlt', 'r']);
const leaderboardAliases = new Set(['lb', 'leaderboard', 'lboard', 'top']);
const shopAliases = new Set(['shop', 'store']);
const achievementAliases = new Set(['achievements', 'achievement', 'ach', 'achs', 'advancements', 'badges']);
const statsAliases = new Set(['stats', 'statistics', 'stat']);
const cooldownAliases = new Set(['cooldowns', 'cooldown', 'cd', 'cds']);
const levelAliases = new Set(['level', 'lvl', 'lvls', 'levels', 'xp']);

const adminMoneyAliases = new Map([
  ['add', new Set(['add-money', 'addmoney', 'money-add', 'am'])],
  ['remove', new Set(['remove-money', 'removemoney', 'take-money', 'takemoney', 'money-remove', 'rm'])],
  ['set', new Set(['set-money', 'setmoney', 'money-set', 'sm'])]
]);
const adminHelpAliases = new Set(['adminhelp', 'admin-help', 'admin', 'ownerhelp']);
const resetCooldownAliases = new Set([
  'reset-cooldown', 'reset-cooldowns', 'resetcooldown', 'resetcooldowns', 'rcd'
]);
const adminStatisticActions = new Map([
  ['edit', 'set'], ['set', 'set'], ['modify', 'set'],
  ['add', 'add'], ['increase', 'add'],
  ['remove', 'remove'], ['subtract', 'remove'], ['decrease', 'remove'],
  ['reset', 'reset'], ['clear', 'reset'],
  ['list', 'list'], ['names', 'list'], ['keys', 'list']
]);
const adminAchievementActions = new Map([
  ['grant', 'grant'], ['give', 'grant'], ['unlock', 'grant'],
  ['revoke', 'revoke'], ['remove', 'revoke'], ['take', 'revoke'], ['lock', 'revoke'],
  ['auto', 'auto'], ['restore', 'auto'], ['automatic', 'auto'],
  ['list', 'list'], ['ids', 'list']
]);
const adminStatisticNames = new Set([
  ...statisticNames,
  'last_crime_success_at',
  'last_rob_success_at',
  'platinum_loss_sequence_active'
]);
const adminCooldownFields = new Map([
  ['work', 'lastWorkAt'],
  ['crime', 'lastCrimeAt'],
  ['rob', 'lastRobAt'],
  ['beg', 'lastBegAt'],
  ['collect', 'lastCollectAt']
]);

const leaderboardCategoryAliases = new Map([
  ['total', 'total'],
  ['all', 'total'],
  ['wallet', 'wallet'],
  ['cash', 'wallet'],
  ['bank', 'bank']
]);

const settingsAliases = new Set(['settings', 'setting', 'options', 'option']);
const colorAliases = new Set(['color', 'colour']);

const commandAliasGroups = new Map([
  ['balance', balanceAliases],
  ['leaderboard', leaderboardAliases],
  ['work', workAliases],
  ['collect', collectAliases],
  ['crime', crimeAliases],
  ['rob', robAliases],
  ['beg', begAliases],
  ['slots', slotAliases],
  ['roulette', rouletteAliases],
  ['shop', shopAliases],
  ['achievements', achievementAliases],
  ['stats', statsAliases],
  ['cooldowns', cooldownAliases],
  ['level', levelAliases],
  ['settings', settingsAliases],
  ['color', colorAliases],
  ['deposit', depositAliases],
  ['withdraw', withdrawAliases],
  ['give', giveAliases],
  ['help', helpAliases]
]);

// Customizable responses and embeds

const currencyEmoji = '<:DDR_mark:1532733538565226546>';
const currencyEmojiId = '1532733538565226546';
const stopwatchEmoji = '<:RolfBot_stopwatch:1544698730639261748>';

const commandUsage = {
  balance: '`?balance [ @mention | username | userID ]`',
  deposit: '`?deposit [ amount | all | half | quarter ]`',
  withdraw: '`?withdraw [ amount | all | half | quarter ]`',
  give: '`?give [ @mention | username | userID ] [ amount | all | half | quarter ]`',
  work: '`?work`',
  crime: '`?crime`',
  rob: '`?rob [ @mention | username | userID ]`',
  beg: '`?beg`',
  collect: '`?collect`',
  slots: '`?slots [ amount | all | half | quarter ]`',
  roulette: '`?roulette [ amount | all | half | quarter ] [ space ]`',
  leaderboard: '`?leaderboard [ total | wallet | bank | level ]`',
  shop: '`?shop`',
  achievements: '`?achievements`',
  stats: '`?stats`',
  cooldowns: '`?cooldowns`',
  level: '`?level`',
  settings: '`?settings`',
  color: '`?color [ reset | #HEXHEX ]`',
  colorHex: '`?color #HEXHEX`',
  help: '`?help`'
};

const adminUsage = {
  add: '`?add-money [ user ] [ amount ] [ wallet | bank ]`',
  remove: '`?remove-money [ user ] [ amount ] [ wallet | bank ]`',
  set: '`?set-money [ user ] [ amount ] [ wallet | bank ]`',
  stats: '`?stats [ edit | add | remove ] [ user ] [ statistic ] [ value ]`',
  statsReset: '`?stats reset [ user ] [ statistic | all ]`',
  statsList: '`?stats list`',
  achievements: '`?ach [ grant | give | revoke | remove | auto ] [ user ] [ achievement_id | all ]`',
  achievementList: '`?ach list`',
  cooldown: '`?reset-cooldown [ user ] [ work | crime | rob | beg | collect | all ]`',
  help: '`?adminhelp`'
};

const adminMessages = {
  invalidUsage: 'Incorrect usage!',
  invalidTarget: 'could\'nt find user!',
  invalidAmount: 'invalid amount!',
  invalidBalance: 'prevented creating negative/unsafe balance!',
  invalidStatistic: 'invalid stat!',
  invalidStatisticValue: 'invalid value!',
  invalidAchievement: 'invalid achievement_id! use `?achievements list`',
  noAchievements: 'invalid achievement!',
  invalidCooldown: 'invalid cd!',
  unexpectedError: 'unexpected err! check terminal',
  savedReplyFailed: 'unexpected err! saved, but no confirmation sent',
  statsNote: 'only the selected stat is edited. achievement conditions are checked when the user next uses an economy command.',
  grantNote: 'manual grants change unlock status only! no money or XP is awarded.',
  revokeNote: 'these achievements stay locked until granted manually or restored with `?achievements auto`. rewards are kept.',
  autoNote: 'auto unlocking is allowed again on the target\'s next normal economy command.',
  moneyUpdated(userId, pocket, previous, next) {
    return `<@${userId}> - **${pocket}**\n${currencyEmoji}${formatMoney(previous)} -> ${currencyEmoji}**${formatMoney(next)}**`;
  },

  statisticUpdated(userId, statisticName, previous, next) {
    return `<@${userId}> - \`${statisticName}\`\n${formatStatisticValue(statisticName, previous)} -> ${formatStatisticValue(statisticName, next)}\n\n${this.statsNote}`;
  },

  statisticsReset(userId) {
    return `reset all economy statistics for <@${userId}>, including achievement timestamps and the platinum sequence flag.\n\n${this.statsNote}`;
  },

  achievementsUpdated(userId, action, ids) {
    const labels = { grant: 'Granted', revoke: 'Revoked', auto: 'Restored automatic unlocking for' };
    const notes = { grant: this.grantNote, revoke: this.revokeNote, auto: this.autoNote };
    const selection = ids.length === 1 ? `\`${ids[0]}\`` : `**${ids.length} achievements**`;
    return `${labels[action]} ${selection} for <@${userId}>.\n\n${notes[action]}`;
  },

  cooldownsReset(userId, commands) {
    return `Reset **${commands.join(', ')}** cooldowns for <@${userId}>.`;
  }
};

const helpCommandEntries = [
  {
    usage: commandUsage.level,
    description: 'View your level, total XP, and progress toward the next level.',
    aliases: levelAliases
  },
  {
    usage: commandUsage.balance,
    description: "View your or another user's wallet and bank balance.",
    aliases: balanceAliases
  },
  {
    usage: commandUsage.deposit,
    description: 'Deposit money from your wallet into your bank.',
    aliases: depositAliases
  },
  {
    usage: commandUsage.withdraw,
    description: 'Withdraw money from your bank into your wallet.',
    aliases: withdrawAliases
  },
  {
    usage: commandUsage.give,
    description: "Give another user money from your wallet.",
    aliases: giveAliases
  },
  {
    usage: commandUsage.work,
    description: 'Work to earn Ostmark. pays 250-750',
    aliases: workAliases
  },
  {
    usage: commandUsage.collect,
    description:
      'Collect your daily income. Resets every day at 00:00 Berlin time. ' +
      '(buy income roles in `?shop`)',
    aliases: collectAliases
  },
  {
    usage: commandUsage.crime,
    description:
      `Commit a crime for a chance to earn a lot of Ostmark... or lose a lot. ` +
      `(${crimeConfig.successChance}% base success rate, ` +
      `${crimeConfig.minimumPay}-${crimeConfig.maximumPay} pay, ` +
      `${crimeConfig.minimumFine}-${crimeConfig.maximumFine} fine, ` +
      `Staatsfeind: +${staatsfeindSuccessChanceBoost} percentage points)`,
    aliases: crimeAliases
  },
  {
    usage: commandUsage.rob,
    description:
      `Rob ${robConfig.minimumWalletPercentage}-${robConfig.maximumWalletPercentage}% ` +
      `of another user's wallet. (${robConfig.successChance}% success rate, ` +
      `${robConfig.minimumFine}-${robConfig.maximumFine} fine, ` +
      `${robConfig.cooldownMinutes / 60} hour cooldown, ` +
      `Staatsfeind: +${staatsfeindSuccessChanceBoost} percentage points)`,
    aliases: robAliases
  },
  {
    usage: commandUsage.beg,
    description: 'Beg strangers for a small but guaranteed amount of Ostmark. pays 25-150',
    aliases: begAliases
  },
  {
    usage: commandUsage.slots,
    description:
      'Gamble your wallet balance away. ' +
      '(<:RolfBot_berliner_bronze:1546195312920760410> = x1.25, ' +
      '<:RolfBot_berliner_silver:1546194641089724557> = x1.5, ' +
      '<:RolfBot_berliner_gold:1546194660983181352> = x2.0, ' +
      '<:RolfBot_berliner_platinum:1546195287805005844> = x3.0)',
    aliases: slotAliases
  },
  {
    usage: commandUsage.roulette,
    description:
      'Join the current server-wide roulette game or start a new one. ' +
      'Each accepted bet restarts the 30-second timer.',
    aliases: rouletteAliases
  },
  {
    usage: commandUsage.leaderboard,
    description: 'View the richest users by total, wallet, or bank balance. ' +
      `For the level leaderboard, use: ${[...levelAliases].map(alias => '\`' + alias + '\`').join(', ')}.`,
    aliases: leaderboardAliases
  },
  {
    usage: commandUsage.shop,
    description: 'View the shop and buy items using the buttons.',
    aliases: shopAliases
  },
  {
    usage: commandUsage.achievements,
    description: 'View your locked and unlocked achievements.',
    aliases: achievementAliases
  },
  {
    usage: commandUsage.stats,
    description: 'View all of your economy statistics.',
    aliases: statsAliases
  },
  {
    usage: commandUsage.cooldowns,
    description: 'See when you can next work, commit a crime, rob, beg, and collect income.',
    aliases: cooldownAliases
  },
  {
    usage: commandUsage.settings,
    description: 'View all available RolfBot Economy settings.',
    aliases: settingsAliases
  },
  {
    usage: commandUsage.help,
    description: 'View all available RolfBot Economy commands.',
    aliases: helpAliases
  }
];

const cooldownText = {
  title: '**Your Cooldowns**',
  ready: 'Ready now',
  noIncomeRoles: 'Unavailable - you have no income roles.',
  footer: 'Income resets daily at 00:00 Berlin time.',
  readyIncome(available, total) {
    return `Ready now. ${available}/${total} income roles unclaimed.`;
  },
  availableAt(timestamp) {
    return `<t:${timestamp}:R> • <t:${timestamp}:f>`;
  }
};

const economyMessages = {
  unexpectedError(errorMessage) {
    return (
      `\`${errorMessage}\`\n` + 'Error! Please report this to ales.js ' + '(<@1044985132777480253>)'
    );
  },

  leaderboardWrongUser(userId) {
    return `only <@${userId}> can use these ` + 'leaderboard buttons.';
  },

  helpWrongUser(userId) {
    return `only <@${userId}> can use these help buttons.`;
  },

  shopWrongUser(userId) {
    return `only <@${userId}> can use these shop buttons.`;
  },

  achievementsWrongUser(userId) {
    return `only <@${userId}> can use these achievement buttons.`;
  },

  statsWrongUser(userId) {
    return `only <@${userId}> can use these statistics buttons.`;
  }
};

const leaderboardText = {
  categoryNames: {
    total: 'Total Money',
    wallet: 'Wallet',
    bank: 'Bank'
  },
  emptyLeaderboard: 'err empty db'
};

const leaderboardButtonIds = {
  first: 'economy_leaderboard_first',
  previous: 'economy_leaderboard_previous',
  page: 'economy_leaderboard_page_number',
  next: 'economy_leaderboard_next',
  last: 'economy_leaderboard_last'
};

const helpButtonIds = {
  first: 'economy_help_first',
  previous: 'economy_help_previous',
  page: 'economy_help_page_number',
  next: 'economy_help_next',
  last: 'economy_help_last'
};

const achievementButtonIds = {
  first: 'economy_achievement_first',
  previous: 'economy_achievement_previous',
  page: 'economy_achievement_page_number',
  next: 'economy_achievement_next',
  last: 'economy_achievement_last'
};

const statsButtonIds = {
  first: 'economy_stats_first',
  previous: 'economy_stats_previous',
  page: 'economy_stats_page_number',
  next: 'economy_stats_next',
  last: 'economy_stats_last'
};

const shopButtonIds = {
  first: 'economy_shop_first_page',
  previous: 'economy_shop_previous_page',
  page: 'economy_shop_page_number',
  next: 'economy_shop_next_page',
  last: 'economy_shop_last_page'
};

const rouletteButtonIds = {
  help: 'economy_roulette_help'
};

function formatAliases(aliases) {
  return Array.from(aliases, (alias) => `\`?${alias}\``).join(', ');
}

function getEconomyCommandKey(commandName) {
  for (const [commandKey, aliases] of commandAliasGroups) {
    if (aliases.has(commandName)) {
      return commandKey;
    }
  }
  return null;
}

function useCommandRepeatCooldown(message, commandKey) {
  const cooldownKey = `${message.guild.id}:${message.author.id}:${commandKey}`;
  const now = Date.now();
  const currentCooldownEndsAt = commandCooldowns.get(cooldownKey) || 0;
  if (now < currentCooldownEndsAt) {
    return currentCooldownEndsAt - now;
  }
  const nextCooldownEndsAt = now + commandRepeatCooldownMilliseconds;
  commandCooldowns.set(cooldownKey, nextCooldownEndsAt);
  const cleanupTimeout = setTimeout(() => {
    if (commandCooldowns.get(cooldownKey) === nextCooldownEndsAt) {
      commandCooldowns.delete(cooldownKey);
    }
  }, commandRepeatCooldownMilliseconds);
  cleanupTimeout.unref?.();
  return 0;
}

function createPageModal(customId, totalPages) {
  const pageInput = new TextInputBuilder()
    .setCustomId('page_number')
    .setLabel(`Page`)
    .setPlaceholder(`Enter a number between 1 and ${totalPages}`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle('Go To Page')
    .addComponents(new ActionRowBuilder().addComponents(pageInput));
}

function getPageFromModal(interaction, totalPages) {
  const requestedPage = interaction.fields.getTextInputValue('page_number').trim();
  if (!/^-?\d+$/.test(requestedPage)) {
    return null;
  }
  const pageNumber = BigInt(requestedPage);
  if (pageNumber < 1n) {
    return 0;
  }
  if (pageNumber > BigInt(totalPages)) {
    return totalPages - 1;
  }
  return Number(pageNumber - 1n);
}

async function waitForPageModal(interaction, modalId, totalPages) {
  await interaction.showModal(createPageModal(modalId, totalPages));
  return interaction
    .awaitModalSubmit({
      filter: (modalInteraction) =>
        modalInteraction.customId === modalId &&
        modalInteraction.user.id === interaction.user.id,
      time: 60 * 1000
    })
    .catch(() => null);
}

function createPaginationButtons(buttonIds, currentPage, totalPages, disableAll = false) {
  const previousPage = Math.max(1, currentPage);
  const nextPage = Math.min(totalPages, currentPage + 2);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buttonIds.first)
      .setLabel('≪')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disableAll || currentPage === 0),
    new ButtonBuilder()
      .setCustomId(buttonIds.previous)
      .setLabel(String(previousPage))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disableAll || currentPage === 0),
    new ButtonBuilder()
      .setCustomId(buttonIds.page)
      .setLabel(`${currentPage + 1} (go to)`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disableAll),
    new ButtonBuilder()
      .setCustomId(buttonIds.next)
      .setLabel(String(nextPage))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disableAll || currentPage >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId(buttonIds.last)
      .setLabel('≫')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disableAll || currentPage >= totalPages - 1)
  );
}

function createLeaderboardButtons(currentPage, totalPages, disableAll = false) {
  return createPaginationButtons(
    leaderboardButtonIds,
    currentPage,
    totalPages,
    disableAll
  );
}

function createHelpButtons(currentPage, totalPages, disableAll = false) {
  return createPaginationButtons(helpButtonIds, currentPage, totalPages, disableAll);
}

function createAchievementButtons(currentPage, totalPages, disableAll = false) {
  return createPaginationButtons(
    achievementButtonIds,
    currentPage,
    totalPages,
    disableAll
  );
}

function createStatsButtons(currentPage, totalPages, disableAll = false) {
  return createPaginationButtons(statsButtonIds, currentPage, totalPages, disableAll);
}

function createShopButtons(currentPage, totalPages, disableAll = false) {
  return createPaginationButtons(shopButtonIds, currentPage, totalPages, disableAll);
}

function createRouletteHelpButton(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(rouletteButtonIds.help)
      .setLabel('Help')
      .setEmoji('❔')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );
}

function getShopCategories(shopItems) {
  return [...new Set(shopItems.map((item) => item.category))];
}

function getShopItemsForCategory(shopItems, selectedCategory) {
  return selectedCategory === 'all'
    ? shopItems
    : shopItems.filter((item) => item.category === selectedCategory);
}

function getShopPageCount(shopItems, selectedCategory) {
  const visibleItems = getShopItemsForCategory(shopItems, selectedCategory);
  return Math.max(1, Math.ceil(visibleItems.length / shopConfig.itemsPerPage));
}

function clampShopPage(page, shopItems, selectedCategory) {
  return Math.min(Math.max(page, 0), getShopPageCount(shopItems, selectedCategory) - 1);
}

function createShopCategoryMenu(shopItems, selectedCategory, disableAll = false) {
  const categories = getShopCategories(shopItems);
  const menu = new StringSelectMenuBuilder()
    .setCustomId('economy_shop_category')
    .setPlaceholder(selectedCategory === 'all' ? 'All Categories' : selectedCategory)
    .setDisabled(disableAll)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('All Categories')
        .setValue('all')
        .setDefault(selectedCategory === 'all'),
      ...categories.map((category) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(category)
          .setValue(category)
          .setDefault(selectedCategory === category)
      )
    );
  return new ActionRowBuilder().addComponents(menu);
}

function createShopComponents(
  account,
  shopItems,
  selectedCategory = 'all',
  page = 0,
  disableAll = false
) {
  const visibleItems = getShopItemsForCategory(shopItems, selectedCategory);
  const totalPages = getShopPageCount(shopItems, selectedCategory);
  const currentPage = clampShopPage(page, shopItems, selectedCategory);
  const firstItemIndex = currentPage * shopConfig.itemsPerPage;
  const pageItems = visibleItems.slice(
    firstItemIndex,
    firstItemIndex + shopConfig.itemsPerPage
  );
  const container = new ContainerBuilder()
    .setAccentColor(Number.parseInt(account.settings.embedColor.slice(1), 16))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '## Shop',
          'Click a price button to instantly buy an item.',
          'Use the category menu below to filter the shop.'
        ].join('\n')
      )
    );
  if (visibleItems.length === 0) {
    container
      .addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('There are currently no items in this category.')
      );
  }
  for (const [itemIndex, item] of pageItems.entries()) {
    const owned = account.ownedItems.includes(item.id);
    const priceButton = new ButtonBuilder()
      .setCustomId(`economy_shop_buy:${item.id}`)
      .setLabel(owned ? 'Owned' : formatMoney(item.price))
      .setStyle(owned ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(disableAll || owned);
    if (!owned) {
      priceButton.setEmoji({
        id: currencyEmojiId,
        name: 'DDR_mark'
      });
    }
    const itemText = [
      `${item.emoji ? `${item.emoji} ` : ''}**${item.name}**`,
      item.description || 'No description provided.'
    ].join('\n');
    if (itemIndex > 0) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      );
    }
    container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(itemText))
          .setButtonAccessory(priceButton)
      );
  }
  const components = [
    container,
    createShopCategoryMenu(shopItems, selectedCategory, disableAll)
  ];
  if (totalPages > 1) {
    components.push(createShopButtons(currentPage, totalPages, disableAll));
  }
  return components;
}

function createEconomyEmbed(message, color, author = message.author) {
  return new EmbedBuilder().setColor(color).setAuthor({
    name: author.username,
    iconURL: author.displayAvatarURL()
  });
}

function createBalanceFields(wallet, bank, total) {
  return [
    {
      name: '**Wallet:**',
      value: `${currencyEmoji}${formatMoney(wallet)}`,
      inline: true
    },
    {
      name: '**Bank:**',
      value: `${currencyEmoji}${formatMoney(bank)}`,
      inline: true
    },
    {
      name: '**Total:**',
      value: `${currencyEmoji}${formatMoney(total)}`,
      inline: true
    }
  ];
}

function formatDailyIncomeRoles(incomeRoles) {
  return incomeRoles
    .map(
      ({ roleId, income }, index) =>
        `\`${index + 1}\` - <@&${roleId}> (${currencyEmoji}${formatMoney(income)})`
    )
    .join('\n');
}

function formatStatisticName(statisticName) {
  const words = statisticName.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function isMoneyStatistic(statisticName) {
  return (
    statisticName.startsWith('money_') ||
    statisticName.startsWith('largest_') ||
    statisticName === 'slots_wagered' ||
    statisticName === 'slots_payouts' ||
    statisticName === 'roulette_wagered' ||
    statisticName === 'roulette_payouts' ||
    statisticName === 'shop_money_spent' ||
    statisticName === 'most_expensive_shop_purchase'
  );
}

function formatStatisticValue(statisticName, value) {
  const formattedValue = formatMoney(value);
  return isMoneyStatistic(statisticName)
    ? `${currencyEmoji}**${formattedValue}**`
    : `**${formattedValue}**`;
}

function formatAchievementRewards(achievement) {
  const rewards = [];
  if (achievement.rewards.money > 0) {
    rewards.push(`${currencyEmoji}**${formatMoney(achievement.rewards.money)}**`);
  }
  if (achievement.rewards.xp > 0) {
    rewards.push(`**${formatXp(achievement.rewards.xp)} XP**`);
  }
  return rewards.length > 0 ? rewards.join(' and ') : 'None';
}

function formatAchievementProgress(achievement, account) {
  const current = getAchievementProgress(achievement, account);
  if (achievement.condition.type === 'owns_item') {
    return current >= 1 ? 'Owned' : 'Not owned';
  }
  if (
    achievement.condition.type === 'owns_any_item' ||
    achievement.condition.type === 'any_statistic' ||
    achievement.condition.type === 'any_condition' ||
    achievement.condition.type === 'crime_and_rob_within'
  ) {
    return current >= 1 ? 'Completed' : 'Not completed';
  }
  return `${formatMoney(Math.min(current, achievement.condition.target))}/${formatMoney(
    achievement.condition.target
  )}`;
}

function createAchievementComponents(
  account,
  achievements,
  currentPage,
  totalPages,
  disableAll = false,
  economyUsers = {}
) {
  const users = Object.values(economyUsers);
  const achievementOwners = new Map();
  for (const user of users) {
    for (const id of new Set(Array.isArray(user?.achievements) ? user.achievements : [])) {
      achievementOwners.set(id, (achievementOwners.get(id) || 0) + 1);
    }
  }
  const startIndex = currentPage * achievementConfig.achievementsPerPage;
  const pageAchievements = achievements.slice(
    startIndex,
    startIndex + achievementConfig.achievementsPerPage
  );
  const unlockedIds = new Set(account.achievements);
  const unlockedCount = achievements.filter((achievement) =>
    unlockedIds.has(achievement.id)
  ).length;
  const unlockedPercentage = achievements.length
    ? Math.round((unlockedCount / achievements.length) * 100)
    : 0;
  const container = new ContainerBuilder()
    .setAccentColor(Number.parseInt(account.settings.embedColor.slice(1), 16))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '## RolfBot Achievements',
          `-# ${unlockedCount}/${achievements.length} unlocked (${unlockedPercentage}%)`
        ].join('\n')
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
  if (pageAchievements.length === 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('err achievements.json empty')
    );
  }
  for (const [achievementIndex, achievement] of pageAchievements.entries()) {
    if (achievementIndex > 0) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      );
    }
    const unlocked = unlockedIds.has(achievement.id);
    const hidden = achievement.hidden && !unlocked;
    const status = achievement.showProgress
      ? `${unlocked ? 'Unlocked' : 'Locked'} (${formatAchievementProgress(achievement, account)})`
      : unlocked
        ? 'Unlocked'
        : 'Locked';
    const title = hidden
      ? '🔒 **Hidden Achievement**'
      : `> -# **${unlocked ? '🔓' : '🔒'} ${status}**`;
    const owners = achievementOwners.get(achievement.id) || 0;
    const percentage = users.length > 0 ? (owners / users.length) * 100 : 0;
    const percentageText = percentage > 0 && percentage < 0.1
      ? '<0.1'
      : Number(percentage.toFixed(1)).toString();
    const achievementText = hidden
      ? [title, 'Keep playing to discover it.'].join('\n')
      : [
         `### **${achievement.name}**`,
          `> **${achievement.description}**`,
          title,
          ...(achievement.rewards.money > 0 || achievement.rewards.xp > 0
            ? [`> -# 🎁 ${formatAchievementRewards(achievement)}`]
            : []),
          `> -# 👥 **Achieved by ${percentageText}%**`,
          ...(achievement.difficulty
            ? [`> -# ${achievement.difficultyEmoji ? `${achievement.difficultyEmoji} ` : ''}**${achievement.difficulty}**`]
            : [])
        ].join('\n');
    if (achievement.imageUrl && !hidden) {
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(achievementText))
          .setThumbnailAccessory(new ThumbnailBuilder().setURL(achievement.imageUrl))
      );
    } else {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(achievementText)
      );
    }
  }
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Page ${currentPage + 1}/${totalPages}`)
  );
  const components = [container];
  if (totalPages > 1) {
    components.push(createAchievementButtons(currentPage, totalPages, disableAll));
  }
  return components;
}

const economyEmbeds = {
  level(message, progress) {
    const filled = Math.floor(progress.progressXp / progress.requiredXp * 20);
    const bar = '[' + '#'.repeat(filled) + '-'.repeat(20 - filled) + ']';
    const percentage = (progress.progressXp / progress.requiredXp * 100).toFixed(1);
    return createEconomyEmbed(message, getUserEmbedColor(message.guild.id, message.author.id, message.member))
      .setDescription([
        `**Level:** ${progress.level} (${formatXp(progress.remainingXp)} XP required for Lv. ${progress.level + 1})`,
        `**XP:** ${formatXp(progress.totalXp)} XP`,
        `### \`Lv. ${progress.level} ${bar} Lv. ${progress.level + 1}\``,
      ].join('\n'))
      .setTimestamp();
  },

  levelInvalidUsage(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      ['Incorrect usage!', '**correct usage:**', commandUsage.level].join('\n')
    );
  },

  help(message, account, currentPage, totalPages) {
    const startIndex = currentPage * helpConfig.commandsPerPage;
    const pageEntries = helpCommandEntries.slice(
      startIndex,
      startIndex + helpConfig.commandsPerPage
    );
    const description = pageEntries
      .map((entry) =>
        [entry.usage, entry.description, `Aliases: ${formatAliases(entry.aliases)}`].join('\n')
      )
      .join('\n\n');
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(description)
      .setFooter({
        text: `Page ${currentPage + 1}/${totalPages} • v${config.version}`
      })
      .setTimestamp();
  },

  commandRepeatCooldown(message, commandKey, remainingMilliseconds) {
    const remainingSeconds = Math.ceil(remainingMilliseconds / 100) / 10;
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      `You're using \`?${commandKey}\` too quickly. ` +
        `Please wait **${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}**.`
    );
  },

  balanceInvalidTarget(message, suppliedTarget) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${suppliedTarget}\` isn't a valid user.`,
        '**correct usage:**',
        commandUsage.balance
      ].join('\n')
    );
  },

  balance(message, target, account, total, leaderboardRank) {
    return createEconomyEmbed(message, account.settings.embedColor, target)
      .setDescription(`Leaderboard Rank: ${leaderboardRank}`)
      .addFields(...createBalanceFields(account.wallet, account.bank, total))
      .setTimestamp();
  },

  leaderboardInvalidCategory(message, suppliedCategory) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${suppliedCategory}\` isn't a valid leaderboard category.`,
        '**correct usage:**',
        commandUsage.leaderboard
      ].join('\n')
    );
  },

  leaderboard(message, account, entries, category, currentPage, totalPages) {
    const categoryName = category === 'level' ? 'Level' : leaderboardText.categoryNames[category];
    const startIndex = currentPage * leaderboardConfig.usersPerPage;
    const pageEntries = entries.slice(startIndex, startIndex + leaderboardConfig.usersPerPage);
    const description =
      pageEntries.length > 0
        ? pageEntries
            .map((entry, index) => {
              const rank = startIndex + index + 1;
              const youMarker = entry.userId === message.author.id ? ' <- you!' : '';
              if (category === 'level') {
                return `**${rank}.** <@${entry.userId}> · \`Lv. ${entry.level}\` · \`${formatXp(entry.xp)} XP\`${youMarker}`;
              }
              return (
                `**${rank}.** <@${entry.userId}>` +
                `${currencyEmoji}` +
                `**${formatMoney(entry.value)}** ${youMarker}`
              );
            })
            .join('\n')
        : category === 'level' ? 'No XP data yet.' : leaderboardText.emptyLeaderboard;
    const yourRank = entries.findIndex((entry) => entry.userId === message.author.id) + 1;
    return createEconomyEmbed(message, account.settings.embedColor)
      .setTitle(`${categoryName} Leaderboard`)
      .setDescription(description)
      .setFooter({
        text:
          `Page ${currentPage + 1}/${totalPages} • ` +
          `${entries.length} users • Your rank: ${category === 'level' && yourRank === 0 ? 'Unranked' : yourRank}`
      })
      .setTimestamp();
  },

  workCooldown(message, cooldownResponse) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      `${stopwatchEmoji} ${cooldownResponse}`
    );
  },

  workSuccess(message, account, workResponse) {
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(`${workResponse}\n`)
      .setTimestamp();
  },

  achievementsInvalidUsage(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      ['Incorrect usage!', '**correct usage:**', commandUsage.achievements].join('\n')
    );
  },

  cooldownsInvalidUsage(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      ['Incorrect usage!', '**correct usage:**', commandUsage.cooldowns].join('\n')
    );
  },

  cooldowns(message, account, fields) {
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(cooldownText.title)
      .addFields(fields)
      .setFooter({ text: cooldownText.footer })
      .setTimestamp();
  },

  statsInvalidUsage(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      ['Incorrect usage!', '**correct usage:**', commandUsage.stats].join('\n')
    );
  },

  stats(message, account, currentPage, totalPages) {
    const startIndex = currentPage * statsConfig.statisticsPerPage;
    const pageStatisticNames = statisticNames.slice(
      startIndex,
      startIndex + statsConfig.statisticsPerPage
    );
    const description = pageStatisticNames
      .map((statisticName) => {
        const value = account.achievementStats[statisticName] || 0;
        return `${formatStatisticName(statisticName)}: ${formatStatisticValue(
          statisticName,
          value
        )}`;
      })
      .join('\n');
    return createEconomyEmbed(message, account.settings.embedColor)
      .setTitle('RolfBot Statistics')
      .setDescription(`(counting after <t:1788710400:d>)\n${description}`)
      .setFooter({
        text:
          `Page ${currentPage + 1}/${totalPages} • ` +
          `${statisticNames.length} statistics`
      })
      .setTimestamp();
  },

  achievements(message, account, achievements, currentPage, totalPages) {
    const startIndex = currentPage * achievementConfig.achievementsPerPage;
    const pageAchievements = achievements.slice(
      startIndex,
      startIndex + achievementConfig.achievementsPerPage
    );
    const unlockedIds = new Set(account.achievements);
    const unlockedCount = achievements.filter((achievement) =>
      unlockedIds.has(achievement.id)
    ).length;
    const description = pageAchievements.length
      ? pageAchievements
          .map((achievement) => {
            const unlocked = unlockedIds.has(achievement.id);
            if (achievement.hidden && !unlocked) {
              return '🔒 **Hidden achievement**\n-# Keep playing to discover it.';
            }
            const status = achievement.showProgress
              ? `${unlocked ? 'Unlocked' : 'Locked'} (${formatAchievementProgress(achievement, account)})`
              : unlocked
                ? 'Unlocked'
                : 'Locked';
            return [
              `${unlocked ? '🔓' : '🔒'} **${achievement.name}**`,
              achievement.description,
              `-# ${status} • Rewards: ${formatAchievementRewards(achievement)}`
            ].join('\n');
          })
          .join('\n\n')
      : 'There are currently no enabled achievements.';
    return createEconomyEmbed(message, account.settings.embedColor)
      .setTitle(`Achievements (${unlockedCount}/${achievements.length})`)
      .setDescription(description)
      .setFooter({
        text: `Page ${currentPage + 1}/${totalPages}`
      })
      .setTimestamp();
  },

  achievementUnlocked(message, account, achievement, newLevel) {
    const description = [
      `**${achievement.name}**`,
      achievement.description,
      '',
      `Rewards: ${formatAchievementRewards(achievement)}`
    ];
    if (newLevel) {
      description.push(`You reached **level ${newLevel}**!`);
    }
    return createEconomyEmbed(message, account.settings.embedColor)
      .setTitle('🔓 Achievement Unlocked!')
      .setDescription(description.join('\n'))
      .setTimestamp();
  },

  collectInvalidUsage(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      ['Incorrect usage!', '**correct usage:**', commandUsage.collect].join('\n')
    );
  },

  collectNoIncomeRoles(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      "You don't have any income roles. some special roles have income, or you can buy some in `?shop`"
    );
  },

  collectCooldown(message, nextCollectTimestamp, incomeRoles) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `${stopwatchEmoji} You already collected your daily income today. ` +
          `You can collect it again <t:${nextCollectTimestamp}:R>.`
      ].join('\n')
    );
  },

  collectSuccess(message, account, dailyIncome, incomeRoles) {
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(
        [
          'Daily role income collected.',
          '',
          formatDailyIncomeRoles(incomeRoles)
        ].join('\n')
      )
      .setTimestamp();
  },

  crimeCooldown(message, cooldownResponse) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      `${stopwatchEmoji} ${cooldownResponse}`
    );
  },

  crimeSuccess(message, account, crimeResponse) {
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(crimeResponse)
      .setTimestamp();
  },

  crimeFail(message, crimeResponse) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(crimeResponse).setTimestamp();
  },

  robMissingTarget(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      ['Incorrect usage! missing 1 argument.', '**correct usage:**', commandUsage.rob].join('\n')
    );
  },

  robInvalidTarget(message, suppliedTarget) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${suppliedTarget}\` isn't a valid user.`,
        '**correct usage:**',
        commandUsage.rob
      ].join('\n')
    );
  },

  robSelf(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      "You can't rob yourself."
    );
  },

  robBot(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription("You can't rob a bot.");
  },

  robImmune(message, target) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      `**${target.username}** has Robbing Immunity and can't be robbed. you can buy this aswell using \`?shop\`!`
    );
  },

  robEmptyWallet(message, target) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      `**${target.username}** is too broke and doesn't have any money in their wallet to rob.`
    );
  },

  robCooldown(message, nextRobTimestamp) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      `${stopwatchEmoji} You need to wait before robbing someone again. ` +
        `Try again <t:${nextRobTimestamp}:R>.`
    );
  },

  robSuccess(message, account, target, stolenMoney, stolenPercentage) {
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(
        `You successfully robbed **${target.username}** and stole ` +
          `${currencyEmoji}**${formatMoney(stolenMoney)}**`
      )
      .setTimestamp();
  },

  robFail(message, target, fine) {
    return createEconomyEmbed(message, failEmbedColor)
      .setDescription(
        `You were caught trying to rob **${target.username}** and were fined ` +
          `${currencyEmoji}**${formatMoney(fine)}**.`
      )
      .setTimestamp();
  },

  begCooldown(message, cooldownResponse) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      `${stopwatchEmoji} ${cooldownResponse}`
    );
  },

  begSuccess(message, account, begResponse) {
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(begResponse)
      .setTimestamp();
  },

  depositMissingAmount(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      ['Incorrect usage! missing 1 argument.', '**correct usage:**', commandUsage.deposit].join(
        '\n'
      )
    );
  },

  depositInvalidAmount(message, requestedAmount) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${requestedAmount}\` isn't a valid amount.`,
        '**correct usage:**',
        commandUsage.deposit
      ].join('\n')
    );
  },

  depositInvalidWholeNumber(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        'Incorrect usage! the amount must be a positive whole number.',
        '**correct usage:**',
        commandUsage.deposit
      ].join('\n')
    );
  },

  depositInsufficientFunds(message, wallet) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        'you seriously overestimated your wealth. ' +
          "you don't have enough money for that transaction.",
        `**Wallet:** ${currencyEmoji}${formatMoney(wallet)}`
      ].join('\n')
    );
  },

  depositNoFunds(message, wallet) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        "you're broke. you don't have any money in your wallet to deposit.",
        `**Wallet:** ${currencyEmoji}${formatMoney(wallet)}`
      ].join('\n')
    );
  },

  depositSuccess(message, account, amount, total) {
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(
        'The Staatsbank der DDR accepted your deposit of ' +
          `${currencyEmoji}**${formatMoney(amount)}**.`
      )
      .addFields(...createBalanceFields(account.wallet, account.bank, total))
      .setTimestamp();
  },

  withdrawMissingAmount(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      ['Incorrect usage! missing 1 argument.', '**correct usage:**', commandUsage.withdraw].join(
        '\n'
      )
    );
  },

  withdrawInvalidAmount(message, requestedAmount) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${requestedAmount}\` isn't a valid amount.`,
        '**correct usage:**',
        commandUsage.withdraw
      ].join('\n')
    );
  },

  withdrawInvalidWholeNumber(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        'Incorrect usage! the amount must be a positive whole number.',
        '**correct usage:**',
        commandUsage.withdraw
      ].join('\n')
    );
  },

  withdrawInsufficientFunds(message, bank) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        'you seriously overestimated your wealth. ' +
          "you don't have enough money for that transaction.",
        `**Bank:** ${currencyEmoji}${formatMoney(bank)}`
      ].join('\n')
    );
  },

  withdrawNoFunds(message, bank) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        "you're broke. you don't have any money in your bank to withdraw.",
        `**Bank:** ${currencyEmoji}${formatMoney(bank)}`
      ].join('\n')
    );
  },

  withdrawSuccess(message, account, amount, total) {
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(
        'The Staatsbank der DDR accepted your withdrawal of ' +
          `${currencyEmoji}**${formatMoney(amount)}**.`
      )
      .addFields(...createBalanceFields(account.wallet, account.bank, total))
      .setTimestamp();
  },

  giveMissingArguments(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      ['Incorrect usage! missing arguments.', '**correct usage:**', commandUsage.give].join('\n')
    );
  },

  giveInvalidTarget(message, suppliedTarget) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! couldn't find exactly one user for \`${suppliedTarget}\`.`,
        '**correct usage:**',
        commandUsage.give
      ].join('\n')
    );
  },

  giveSelf(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      "You can't give money to yourself."
    );
  },

  giveBot(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      "You can't give money to a bot."
    );
  },

  giveInvalidAmount(message, requestedAmount) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${requestedAmount}\` isn't a valid amount.`,
        '**correct usage:**',
        commandUsage.give
      ].join('\n')
    );
  },

  giveInvalidWholeNumber(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        'Incorrect usage! the amount must be a positive whole number.',
        '**correct usage:**',
        commandUsage.give
      ].join('\n')
    );
  },

  giveNoFunds(message, wallet) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        "you're broke. you don't have any money in your wallet to give.",
        `**Wallet:** ${currencyEmoji}${formatMoney(wallet)}`
      ].join('\n')
    );
  },

  giveInsufficientFunds(message, wallet) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        "you don't have enough money in your wallet for that transaction.",
        `**Wallet:** ${currencyEmoji}${formatMoney(wallet)}`
      ].join('\n')
    );
  },

  giveSuccess(message, account, target, amount) {
    const total = account.wallet + account.bank;
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(`you gave **${target.username}** ${currencyEmoji}**${formatMoney(amount)}**.`)
      .setTimestamp();
  },

  slotInvalidArguments(message, missingArgument) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        missingArgument
          ? 'Incorrect usage! missing 1 argument.'
          : 'Incorrect usage! too many arguments.',
        '**correct usage:**',
        commandUsage.slots
      ].join('\n')
    );
  },

  slotInvalidAmount(message, requestedAmount) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${requestedAmount}\` isn't a valid amount.`,
        '**correct usage:**',
        commandUsage.slots
      ].join('\n')
    );
  },

  slotInvalidWholeNumber(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        'Incorrect usage! the amount must be a positive whole number.',
        '**correct usage:**',
        commandUsage.slots
      ].join('\n')
    );
  },

  slotInsufficientFunds(message, wallet) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        'you seriously overestimated your wealth. ' + "you don't have enough money for that bet.",
        `**Wallet:** ${currencyEmoji}${formatMoney(wallet)}`
      ].join('\n')
    );
  },

  slotResult(message, account, won, outcome, amount, payout, topReels, reels, bottomReels) {
    const slotDisplay = [
      topReels.join(' **│** '),
      reels.join(' **│** '),
      bottomReels.join(' **│** ')
    ].join('\n');
    const resultText = won
      ? [
          `${currencyEmoji}**${formatMoney(amount)}**`,
          'x',
          `**${outcome.multiplier}**`,
          '=',
          `${currencyEmoji}**${formatMoney(payout)}**`
        ].join(' ')
      : '';
    return createEconomyEmbed(message, won ? account.settings.embedColor : failEmbedColor)
      .setDescription(
        [
          won
            ? `You won ${currencyEmoji}**${formatMoney(payout)}**!`
            : `You lost ${currencyEmoji}**${formatMoney(amount)}**.`,
          '',
          slotDisplay,
          '',
          resultText
        ].join('\n')
      )
      .setTimestamp();
  },

  rouletteInvalidArguments(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        'Incorrect usage! roulette needs an amount and a betting space.',
        '**correct usage:**',
        commandUsage.roulette,
        '**example:** `?roulette 250 red`'
      ].join('\n')
    );
  },

  rouletteInvalidAmount(message, requestedAmount) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${requestedAmount}\` isn't a valid amount.`,
        '**correct usage:**',
        commandUsage.roulette
      ].join('\n')
    );
  },

  rouletteInvalidWholeNumber(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        'Incorrect usage! the amount must be a positive whole number.',
        '**correct usage:**',
        commandUsage.roulette
      ].join('\n')
    );
  },

  rouletteInvalidSpace(message, requestedSpace) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${requestedSpace}\` isn't a valid roulette space.`,
        'you can bet on:',
        '- numbers: `0` to `36`',
        '- colors: `red` and `black`',
        '- halves: `even`, `odd`, `high`, `low`',
        '- dozens: `1st`, `2nd`, `3rd`',
        '**correct usage:**',
        commandUsage.roulette
      ].join('\n')
    );
  },

  rouletteInsufficientFunds(message, wallet) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        "you don't have enough money in your wallet for that bet.",
        `**Wallet:** ${currencyEmoji}${formatMoney(wallet)}`
      ].join('\n')
    );
  },

  rouletteBetPlaced(message, bet, isNewGame) {
    return createEconomyEmbed(message, rouletteConfig.confirmationColor)
      .setTitle(isNewGame ? 'New roulette game started!' : 'Roulette bet added!')
      .setDescription(
        [
          `you placed a bet of ${currencyEmoji}**${formatMoney(bet.amount)}** on ` +
            `\`${bet.label}\`.`,
          '',
          `-# time remaining: ${rouletteConfig.bettingSeconds} seconds after each bet`
        ].join('\n')
      );
  },

  rouletteHelp() {
    return new EmbedBuilder()
      .setColor(rouletteConfig.confirmationColor)
      .setTitle('Roulette Help')
      .setDescription(
        [
          `**Usage:** ${commandUsage.roulette}`,
          '**Example:** `?roulette 30 red`',
          '',
          '**Outside bets**',
          '`red`, `black`, `even`, `odd`, `low`/`1-18`, `high`/`19-36` - x2',
          '`1st12`, `2nd12`, `3rd12`, `column1`, `column2`, `column3` - x3',
          '',
          '**Inside bets**',
          '`17` straight number - x36',
          '`1-2` split - x18',
          '`1-2-3` street or `0-1-2` zero trio - x12',
          '`1-2-4-5` corner or `0-1-2-3` first four - x9',
          '`1-2-3-4-5-6` six line - x6',
          '',
          'Inside combinations must touch on a real European roulette table. ' +
            'Payout multipliers include your returned stake.'
        ].join('\n')
      );
  },

  rouletteResult(number, summaries) {
    const numberColor = getRouletteNumberColor(number);
    const winners = summaries.filter((summary) => summary.net > 0);
    const losers = summaries.filter((summary) => summary.net < 0);
    const breakEven = summaries.filter((summary) => summary.net === 0);
    const resultEmoji = winners.length > 0 ? '' : losers.length > 0 ? '' : '';
    const embed = new EmbedBuilder()
      .setColor(winners.length > 0 ? rouletteConfig.confirmationColor : failEmbedColor)
      .setTitle('Roulette Result')
      .setDescription(
        `${resultEmoji} The ball landed on **${numberColor} ${number}**`
      )
      .setFooter({
        text: 'Values show net gain/loss'
      })
      .setTimestamp();
    if (winners.length > 0) {
      embed.addFields({
        name: 'Winners',
        value: formatRouletteSummaries(winners, 'won')
      });
    }
    if (losers.length > 0) {
      embed.addFields({
        name: 'Losers',
        value: formatRouletteSummaries(losers, 'lost')
      });
    }
    if (breakEven.length > 0) {
      embed.addFields({
        name: 'No net change',
        value: formatRouletteSummaries(breakEven, 'broke even')
      });
    }
    return embed;
  },

  rouletteCancelled() {
    return new EmbedBuilder()
      .setColor(failEmbedColor)
      .setTitle('Roulette game cancelled')
      .setDescription('The roulette game could not finish, so every bet was refunded.');
  },

  shopInvalidUsage(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      ['Incorrect usage!', '**correct usage:**', commandUsage.shop].join('\n')
    );
  },

  shopAlreadyOwned(message, item) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      `You already own **${item.name}**.`
    );
  },

  shopInsufficientFunds(message, account, item) {
    const moneyNeeded = item.price - account.wallet;
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `You don't have enough money in your wallet to buy **${item.name}** for ${currencyEmoji}${formatMoney(item.price)}.`,
        `You currently only have ${currencyEmoji}${formatMoney(account.wallet)}, so you need ${currencyEmoji}${formatMoney(moneyNeeded)} more.`
      ].join('\n')
    );
  },

  shopPurchaseSuccess(message, account, item) {
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(
        [
          `You bought **${item.name}** for ${currencyEmoji}**${formatMoney(item.price)}**!`
        ].join('\n')
      )
      .setTimestamp();
  },

  settingsMenu(message, account) {
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription(
        `**Available RolfBot Settings:**\n` +
          `\n` +
          `\`?color [ reset | #HEXHEX ]\`\n` +
          `change your RolfBot Embed color.\n` +
          `Aliases: \`?color\`, \`?colour\`, \`?[ any setting alias ] color\`, \`?[ any setting alias ] colour\`` +
          `` // space for future settings
      )
      .setTimestamp();
  },

  settingsInvalidSetting(message, settingName) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${settingName}\` isn't a setting.`,
        '**available settings:**',
        commandUsage.color
      ].join('\n')
    );
  },

  settingsMissingColor(message) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      ['Incorrect usage! missing 1 argument.', '**correct usage:**', commandUsage.color].join('\n')
    );
  },

  settingsInvalidColor(message, requestedColor) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${requestedColor}\` isn't a valid HEX color.`,
        '**correct usage:**',
        commandUsage.colorHex
      ].join('\n')
    );
  },

  settingsColorUpdated(message, account) {
    return createEconomyEmbed(message, account.settings.embedColor)
      .setDescription('Your embed color was changed to ' + `\`${account.settings.embedColor}\`.`)
      .setTimestamp();
  }
};

// Economy helpers and commands

const jsonFileCache = new Map();
const definitionCache = new Map();
const moneyFormatter = new Intl.NumberFormat('en-US');
const xpFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1
});

function getJsonFileStamp(file) {
  const stat = fs.statSync(file, { bigint: true });
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
}

function readJsonText(file) {
  const stamp = getJsonFileStamp(file);
  const cached = jsonFileCache.get(file);
  if (cached?.stamp === stamp) {
    return cached.text;
  }
  const text = fs.readFileSync(file, 'utf8');
  jsonFileCache.set(file, { stamp, text });
  return text;
}

function loadCachedDefinitions(file, loader) {
  const text = readJsonText(file);
  const cached = definitionCache.get(file);
  if (cached?.text === text) {
    return cached.value;
  }
  const value = loader();
  definitionCache.set(file, { text, value });
  return value;
}

function saveJsonFile(file, data) {
  const text = JSON.stringify(data, null, 2);
  if (fs.existsSync(file) && readJsonText(file) === text) {
    return;
  }
  const temporaryFile = `${file}.tmp`;
  fs.writeFileSync(temporaryFile, text);
  fs.renameSync(temporaryFile, file);
  // The save has already succeeded; cache maintenance must not turn it into an error.
  jsonFileCache.delete(file);
}

function loadEconomy() {
  if (!fs.existsSync(economyFile)) {
    return {
      guilds: {}
    };
  }
  try {
    const rawData = readJsonText(economyFile);
    const data = rawData.trim() ? JSON.parse(rawData) : {};
    if (!data.guilds || typeof data.guilds !== 'object') {
      data.guilds = {};
    }
    return data;
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to read economy.json:', error);
    throw error;
  }
}

function loadShopItems() {
  if (!fs.existsSync(shopItemsFile)) {
    throw new Error('shop_items.json was not found.');
  }
  return loadCachedDefinitions(shopItemsFile, readShopItems);
}

function readShopItems() {
  if (!fs.existsSync(shopItemsFile)) {
    throw new Error('shop_items.json was not found.');
  }
  const rawData = readJsonText(shopItemsFile);
  const data = rawData.trim() ? JSON.parse(rawData) : {};
  if (!Array.isArray(data.items)) {
    throw new Error('shop_items.json must contain an "items" array.');
  }
  const itemIds = new Set();
  const categoryNames = new Map();
  const shopItems = data.items
    .filter((item) => item?.enabled !== false)
    .map((item) => {
      if (!item || typeof item !== 'object') {
        throw new Error('Every shop item must be an object.');
      }
      if (
        typeof item.id !== 'string' ||
        !/^[a-zA-Z0-9_-]+$/.test(item.id) ||
        item.id.length > 80
      ) {
        throw new Error(
          'Every shop item needs an ID of 80 characters or fewer using letters, numbers, - or _.'
        );
      }
      const normalizedId = item.id.toLowerCase();
      if (itemIds.has(normalizedId)) {
        throw new Error(`Duplicate shop item ID: ${item.id}`);
      }
      itemIds.add(normalizedId);
      if (typeof item.name !== 'string' || !item.name.trim()) {
        throw new Error(`Shop item ${item.id} needs a name.`);
      }
      if (!Number.isSafeInteger(item.price) || item.price < 0) {
        throw new Error(`Shop item ${item.id} needs a non-negative whole-number price.`);
      }
      if (
        typeof item.category !== 'string' ||
        !item.category.trim() ||
        item.category.trim().length > 100
      ) {
        throw new Error(`Shop item ${item.id} needs a category of 100 characters or fewer.`);
      }
      const categoryKey = item.category.trim().toLowerCase();
      if (categoryKey === 'all') {
        throw new Error(`Shop item ${item.id} cannot use "All" as its category.`);
      }
      if (!categoryNames.has(categoryKey)) {
        categoryNames.set(categoryKey, item.category.trim());
      }
      return {
        id: item.id,
        name: item.name.trim(),
        description: typeof item.description === 'string' ? item.description.trim() : '',
        price: item.price,
        emoji: typeof item.emoji === 'string' ? item.emoji.trim() : '',
        category: categoryNames.get(categoryKey)
      };
    });
  const categories = getShopCategories(shopItems);
  if (categories.length > shopConfig.maximumCategories) {
    throw new Error(
      `shop_items.json can contain at most ${shopConfig.maximumCategories} categories.`
    );
  }
  return shopItems;
}

function loadAchievements() {
  if (!fs.existsSync(achievementsFile)) {
    throw new Error('achievements.json was not found.');
  }
  return loadCachedDefinitions(achievementsFile, readAchievements);
}

function readAchievements() {
  if (!fs.existsSync(achievementsFile)) {
    throw new Error('achievements.json was not found.');
  }
  const rawData = readJsonText(achievementsFile);
  const data = rawData.trim() ? JSON.parse(rawData) : {};
  if (!Array.isArray(data.achievements)) {
    throw new Error('achievements.json must contain an "achievements" array.');
  }
  const difficultyEmojis = new Map();
  const difficultyMappings = Array.isArray(data.difficulties)
    ? data.difficulties
    : [data.difficulties];
  for (const mapping of difficultyMappings) {
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) continue;
    for (const [emoji, difficulty] of Object.entries(mapping)) {
      if (typeof difficulty === 'string' && difficulty.trim()) {
        difficultyEmojis.set(difficulty.trim().toLowerCase(), emoji.trim());
      }
    }
  }
  const achievementIds = new Set();
  const conditionTypes = new Set([
    'wallet',
    'bank',
    'total_money',
    'owned_items',
    'owns_item',
    'owns_all_items',
    'owns_any_item',
    'statistic',
    'statistics_sum',
    'all_statistics',
    'any_statistic',
    'all_conditions',
    'any_condition',
    'crime_and_rob_within',
    'slots_platinum_then_losses'
  ]);
  function normalizeCondition(condition, achievementId, depth = 0) {
    if (
      !condition ||
      typeof condition !== 'object' ||
      !conditionTypes.has(condition.type) ||
      depth > 5
    ) {
      throw new Error(`${achievementId} invalid condition type`);
    }
    const normalizedCondition = { type: condition.type };
    const validateTarget = () => {
      if (!Number.isSafeInteger(condition.target) || condition.target <= 0) {
        throw new Error(`${achievementId} invalid number for target`);
      }
      normalizedCondition.target = condition.target;
    };
    const validateStatisticName = (name) => {
      if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(name)) {
        throw new Error(`${achievementId} invalid statistic name`);
      }
      return name;
    };
    if (condition.type === 'owns_item') {
      if (typeof condition.item_id !== 'string' || !condition.item_id.trim()) {
        throw new Error(`${achievementId} needs condition.item_id`);
      }
      normalizedCondition.itemId = condition.item_id.trim();
      normalizedCondition.target = 1;
    } else if (condition.type === 'owns_all_items' || condition.type === 'owns_any_item') {
      if (
        !Array.isArray(condition.item_ids) ||
        condition.item_ids.length === 0 ||
        condition.item_ids.some((itemId) => typeof itemId !== 'string' || !itemId.trim())
      ) {
        throw new Error(`${achievementId} needs condition.item_ids`);
      }
      normalizedCondition.itemIds = [...new Set(condition.item_ids.map((itemId) => itemId.trim()))];
      normalizedCondition.target =
        condition.type === 'owns_all_items' ? normalizedCondition.itemIds.length : 1;
    } else if (condition.type === 'crime_and_rob_within') {
      if (!Number.isSafeInteger(condition.seconds) || condition.seconds <= 0) {
        throw new Error(`${achievementId} invalid number for seconds`);
      }
      normalizedCondition.seconds = condition.seconds;
      normalizedCondition.target = 1;
    } else if (condition.type === 'slots_platinum_then_losses') {
      const losses = condition.losses ?? condition.target;
      if (!Number.isSafeInteger(losses) || losses <= 0) {
        throw new Error(`${achievementId} invalid number for losses`);
      }
      normalizedCondition.losses = losses;
      normalizedCondition.target = losses;
    } else if (condition.type === 'statistic') {
      validateTarget();
      normalizedCondition.name = validateStatisticName(condition.name);
    } else if (condition.type === 'statistics_sum') {
      validateTarget();
      if (!Array.isArray(condition.names) || condition.names.length === 0) {
        throw new Error(`${achievementId} needs condition.names`);
      }
      normalizedCondition.names = [
        ...new Set(condition.names.map((name) => validateStatisticName(name)))
      ];
    } else if (condition.type === 'all_statistics' || condition.type === 'any_statistic') {
      if (!Array.isArray(condition.statistics) || condition.statistics.length === 0) {
        throw new Error(`${achievementId} needs condition.statistics`);
      }
      normalizedCondition.statistics = condition.statistics.map((statistic) => {
        if (!statistic || typeof statistic !== 'object') {
          throw new Error(`${achievementId} has an invalid statistic condition`);
        }
        if (!Number.isSafeInteger(statistic.target) || statistic.target <= 0) {
          throw new Error(`${achievementId} has an invalid statistic target`);
        }
        return {
          name: validateStatisticName(statistic.name),
          target: statistic.target
        };
      });
      normalizedCondition.target =
        condition.type === 'all_statistics' ? normalizedCondition.statistics.length : 1;
    } else if (condition.type === 'all_conditions' || condition.type === 'any_condition') {
      if (!Array.isArray(condition.conditions) || condition.conditions.length === 0) {
        throw new Error(`${achievementId} needs condition.conditions`);
      }
      normalizedCondition.conditions = condition.conditions.map((nestedCondition) =>
        normalizeCondition(nestedCondition, achievementId, depth + 1)
      );
      normalizedCondition.target =
        condition.type === 'all_conditions' ? normalizedCondition.conditions.length : 1;
    } else {
      validateTarget();
    }
    return normalizedCondition;
  }
  return data.achievements
    .filter((achievement) => achievement?.enabled !== false)
    .map((achievement) => {
      if (!achievement || typeof achievement !== 'object') {
        throw new Error('ach not object');
      }
      if (
        typeof achievement.id !== 'string' ||
        !/^[a-zA-Z0-9_-]+$/.test(achievement.id) ||
        achievement.id.length > 80
      ) {
        throw new Error(
          'invalid id for ach'
        );
      }
      const normalizedId = achievement.id.toLowerCase();
      if (achievementIds.has(normalizedId)) {
        throw new Error(`duplicate ids ${achievement.id}`);
      }
      achievementIds.add(normalizedId);
      if (
        typeof achievement.name !== 'string' ||
        !achievement.name.trim() ||
        achievement.name.trim().length > 100
      ) {
        throw new Error(`${achievement.id} name too long`);
      }
      if (
        typeof achievement.description !== 'string' ||
        !achievement.description.trim() ||
        achievement.description.trim().length > 500
      ) {
        throw new Error(
          `${achievement.id} desc too long`
        );
      }
      const normalizedCondition = normalizeCondition(achievement.condition, achievement.id);
      const rewards = achievement.rewards || {};
      const moneyReward = rewards.money ?? 0;
      const xpReward = rewards.xp ?? 0;
      if (!Number.isSafeInteger(moneyReward) || moneyReward < 0) {
        throw new Error(`${achievement.id} invalid money reward`);
      }
      if (!Number.isSafeInteger(xpReward) || xpReward < 0) {
        throw new Error(`${achievement.id} invalid XP reward`);
      }
      const imageUrl =
        typeof achievement.image_url === 'string' ? achievement.image_url.trim() : '';
      if (imageUrl && !/^https?:\/\/\S+$/i.test(imageUrl)) {
        throw new Error(`${achievement.id} invalid image_url`);
      }
      return {
        id: achievement.id,
        name: achievement.name.trim(),
        description: achievement.description.trim(),
        imageUrl,
        hidden: achievement.hidden === true,
        showProgress: achievement.show_progress === true,
        difficulty: typeof achievement.difficulty === 'string' ? achievement.difficulty.trim() : '',
        difficultyEmoji: typeof achievement.difficulty === 'string'
          ? difficultyEmojis.get(achievement.difficulty.trim().toLowerCase()) || ''
          : '',
        condition: normalizedCondition,
        rewards: {
          money: moneyReward,
          xp: xpReward
        }
      };
    });
}

function loadXp() {
  return xpStore.loadXp();
}

function saveEconomy(data) {
  saveJsonFile(economyFile, data);
}

function saveXp(data) {
  xpStore.saveXp(data);
}

async function grantShopItemRole(message, item) {
  const roleId = shopRoleIds.get(item.id);
  if (!roleId) {
    return;
  }
  const role = message.guild.roles.cache.get(roleId);
  if (!role) {
    throw new Error(`${item.id} role config invalid`);
  }
  if (!role.editable) {
    throw new Error(`${item.id} role no perms`);
  }
  if (!message.member.roles.cache.has(role.id)) {
    await message.member.roles.add(role, `Purchased ${item.name} from the Economy Shop`);
  }
}

function defaultEmbedColor(member) {
  const memberRoles = member?.roles?.cache;
  if (!memberRoles) {
    return '#FF0000';
  }
  const colorRole = memberRoles
    .filter((role) => colorRoleIds.includes(role.id))
    .sort((roleA, roleB) => roleB.position - roleA.position)
    .first();
  return colorRole?.hexColor || '#FF0000';
}

function getAccount(data, guildId, userId, member) {
  const memberDefaultEmbedColor = defaultEmbedColor(member);
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      users: {}
    };
  }
  if (!data.guilds[guildId].users || typeof data.guilds[guildId].users !== 'object') {
    data.guilds[guildId].users = {};
  }
  if (!data.guilds[guildId].users[userId]) {
    data.guilds[guildId].users[userId] = {
      wallet: 0,
      bank: 0,
      lastWorkAt: 0,
      lastCollectAt: 0,
      incomeRoleClaimsDate: '',
      collectedIncomeRoleIds: [],
      lastCrimeAt: 0,
      lastRobAt: 0,
      lastBegAt: 0,
      ownedItems: [],
      achievements: [],
      achievementStats: {},
      settings: {
        embedColor: memberDefaultEmbedColor
      }
    };
  }
  const account = data.guilds[guildId].users[userId];
  if (typeof account.wallet !== 'number') {
    account.wallet = 0;
  }
  if (typeof account.bank !== 'number') {
    account.bank = 0;
  }
  if (typeof account.lastWorkAt !== 'number' || !Number.isFinite(account.lastWorkAt)) {
    account.lastWorkAt = 0;
  }
  if (typeof account.lastCollectAt !== 'number' || !Number.isFinite(account.lastCollectAt)) {
    account.lastCollectAt = 0;
  }
  if (typeof account.incomeRoleClaimsDate !== 'string') {
    account.incomeRoleClaimsDate = '';
  }
  if (!Array.isArray(account.collectedIncomeRoleIds)) {
    account.collectedIncomeRoleIds = [];
  }
  account.collectedIncomeRoleIds = [
    ...new Set(account.collectedIncomeRoleIds.filter((roleId) => typeof roleId === 'string'))
  ];
  if (
    !account.incomeRoleClaimsDate &&
    account.lastCollectAt > 0 &&
    member?.roles?.cache &&
    getDailyIncomeDateKey(account.lastCollectAt) === getDailyIncomeDateKey(Date.now())
  ) {
    account.incomeRoleClaimsDate = getDailyIncomeDateKey(account.lastCollectAt);
    account.collectedIncomeRoleIds = [...dailyIncomeRoles.keys()].filter((roleId) =>
      member.roles.cache.has(roleId)
    );
  }
  if (typeof account.lastCrimeAt !== 'number' || !Number.isFinite(account.lastCrimeAt)) {
    account.lastCrimeAt = 0;
  }
  if (typeof account.lastRobAt !== 'number' || !Number.isFinite(account.lastRobAt)) {
    account.lastRobAt = 0;
  }
  if (typeof account.lastBegAt !== 'number' || !Number.isFinite(account.lastBegAt)) {
    account.lastBegAt = 0;
  }
  if (!Array.isArray(account.ownedItems)) {
    account.ownedItems = [];
  }
  account.ownedItems = [...new Set(account.ownedItems.filter((itemId) => typeof itemId === 'string'))];
  if (!Array.isArray(account.achievements)) {
    account.achievements = [];
  }
  account.achievements = [
    ...new Set(account.achievements.filter((achievementId) => typeof achievementId === 'string'))
  ];
  if (!Array.isArray(account.revokedAchievements)) {
    account.revokedAchievements = [];
  }
  account.revokedAchievements = [
    ...new Set(account.revokedAchievements.filter((id) => typeof id === 'string'))
  ];
  // Existing unlocked achievements have already received their normal rewards.
  if (!Array.isArray(account.achievementRewardClaims)) {
    account.achievementRewardClaims = [...account.achievements];
  }
  account.achievementRewardClaims = [
    ...new Set(account.achievementRewardClaims.filter((id) => typeof id === 'string'))
  ];
  if (!account.achievementStats || typeof account.achievementStats !== 'object') {
    account.achievementStats = {};
  }
  for (const [statisticName, value] of Object.entries(account.achievementStats)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      delete account.achievementStats[statisticName];
    }
  }
  if (!account.settings || typeof account.settings !== 'object') {
    account.settings = {};
  }
  if (typeof account.settings.embedColor !== 'string') {
    account.settings.embedColor = memberDefaultEmbedColor;
  }
  return account;
}

function incrementAchievementStatistic(account, statisticName, amount = 1) {
  const currentValue = Number.isSafeInteger(account.achievementStats[statisticName])
    ? account.achievementStats[statisticName]
    : 0;
  account.achievementStats[statisticName] = currentValue + amount;
}

function setMaximumAchievementStatistic(account, statisticName, value) {
  const currentValue = Number.isSafeInteger(account.achievementStats[statisticName])
    ? account.achievementStats[statisticName]
    : 0;
  account.achievementStats[statisticName] = Math.max(currentValue, value);
}

function recordMoneyEarned(account, source, amount) {
  incrementAchievementStatistic(account, `money_earned_${source}`, amount);
  incrementAchievementStatistic(account, 'money_earned_total', amount);
  setMaximumAchievementStatistic(account, `largest_${source}_payout`, amount);
}

function recordMoneyLost(account, source, amount) {
  incrementAchievementStatistic(account, `money_lost_${source}`, amount);
  incrementAchievementStatistic(account, 'money_lost_total', amount);
  setMaximumAchievementStatistic(account, `largest_${source}_loss`, amount);
}

function recordSlotResult(account, won, outcome, amount, payout) {
  incrementAchievementStatistic(account, 'slots_plays');
  incrementAchievementStatistic(account, 'slots_wagered', amount);
  setMaximumAchievementStatistic(account, 'largest_slots_bet', amount);
  if (won) {
    const outcomeName = outcome.name.toLowerCase();
    incrementAchievementStatistic(account, 'slots_wins');
    incrementAchievementStatistic(account, `slots_${outcomeName}_wins`);
    incrementAchievementStatistic(account, 'slots_payouts', payout);
    setMaximumAchievementStatistic(account, 'largest_slots_payout', payout);
    recordMoneyEarned(account, 'slots', Math.max(0, payout - amount));
    const winStreak = (account.achievementStats.current_slots_win_streak || 0) + 1;
    account.achievementStats.current_slots_win_streak = winStreak;
    account.achievementStats.current_slots_loss_streak = 0;
    setMaximumAchievementStatistic(account, 'longest_slots_win_streak', winStreak);
    if (outcomeName === 'platinum') {
      account.achievementStats.platinum_loss_sequence_active = 1;
      account.achievementStats.current_platinum_followup_losses = 0;
    } else {
      account.achievementStats.platinum_loss_sequence_active = 0;
      account.achievementStats.current_platinum_followup_losses = 0;
    }
    return;
  }
  incrementAchievementStatistic(account, 'slots_losses');
  recordMoneyLost(account, 'slots', amount);
  const lossStreak = (account.achievementStats.current_slots_loss_streak || 0) + 1;
  account.achievementStats.current_slots_loss_streak = lossStreak;
  account.achievementStats.current_slots_win_streak = 0;
  setMaximumAchievementStatistic(account, 'longest_slots_loss_streak', lossStreak);
  if (account.achievementStats.platinum_loss_sequence_active === 1) {
    const followupLosses =
      (account.achievementStats.current_platinum_followup_losses || 0) + 1;
    account.achievementStats.current_platinum_followup_losses = followupLosses;
    setMaximumAchievementStatistic(
      account,
      'platinum_then_losses_record',
      followupLosses
    );
  }
}

function setAchievementTimestamp(account, timestampName, timestamp) {
  account.achievementStats[timestampName] = timestamp;
}

function getAchievementProgress(achievement, account) {
  switch (achievement.condition.type) {
    case 'wallet':
      return Math.max(0, Math.floor(account.wallet));
    case 'bank':
      return Math.max(0, Math.floor(account.bank));
    case 'total_money':
      return Math.max(0, Math.floor(account.wallet + account.bank));
    case 'owned_items':
      return account.ownedItems.length;
    case 'owns_item':
      return account.ownedItems.includes(achievement.condition.itemId) ? 1 : 0;
    case 'owns_all_items':
      return achievement.condition.itemIds.filter((itemId) => account.ownedItems.includes(itemId))
        .length;
    case 'owns_any_item':
      return achievement.condition.itemIds.some((itemId) => account.ownedItems.includes(itemId))
        ? 1
        : 0;
    case 'statistic':
      return account.achievementStats[achievement.condition.name] || 0;
    case 'statistics_sum':
      return achievement.condition.names.reduce(
        (total, name) => total + (account.achievementStats[name] || 0),
        0
      );
    case 'all_statistics':
    case 'any_statistic':
      return achievement.condition.statistics.filter(
        (statistic) => (account.achievementStats[statistic.name] || 0) >= statistic.target
      ).length;
    case 'all_conditions':
    case 'any_condition':
      return achievement.condition.conditions.filter(
        (condition) => getAchievementProgress({ condition }, account) >= condition.target
      ).length;
    case 'crime_and_rob_within': {
      const crimeTimestamp = account.achievementStats.last_crime_success_at || 0;
      const robTimestamp = account.achievementStats.last_rob_success_at || 0;
      if (crimeTimestamp <= 0 || robTimestamp <= 0) {
        return 0;
      }
      return Math.abs(crimeTimestamp - robTimestamp) <= achievement.condition.seconds * 1000
        ? 1
        : 0;
    }
    case 'slots_platinum_then_losses':
      return account.achievementStats.platinum_then_losses_record || 0;
    default:
      return 0;
  }
}

function addAchievementXp(xpData, userId, amount) {
  const result = xpStore.addXpToData(xpData, userId, amount);
  return result.leveledUp ? result.level : null;
}

function unlockAchievements(achievements, account) {
  const unlockedIds = new Set(account.achievements);
  const revokedIds = new Set(account.revokedAchievements);
  const rewardedIds = new Set(account.achievementRewardClaims);
  const newlyUnlocked = [];
  let foundAchievement = true;
  while (foundAchievement) {
    foundAchievement = false;
    for (const achievement of achievements) {
      if (
        unlockedIds.has(achievement.id) ||
        revokedIds.has(achievement.id) ||
        getAchievementProgress(achievement, account) < achievement.condition.target
      ) {
        continue;
      }
      unlockedIds.add(achievement.id);
      account.achievements.push(achievement.id);
      if (rewardedIds.has(achievement.id)) {
        newlyUnlocked.push({ ...achievement, rewards: { money: 0, xp: 0 } });
      } else {
        account.wallet += achievement.rewards.money;
        account.achievementRewardClaims.push(achievement.id);
        rewardedIds.add(achievement.id);
        newlyUnlocked.push(achievement);
      }
      foundAchievement = true;
    }
  }
  return newlyUnlocked;
}

async function checkAndAnnounceAchievements(message) {
  try {
    const achievements = loadAchievements();
    const economyData = loadEconomy();
    const account = getAccount(
      economyData,
      message.guild.id,
      message.author.id,
      message.member
    );
    const newlyUnlocked = unlockAchievements(achievements, account);
    if (newlyUnlocked.length === 0) {
      return [];
    }
    const totalXpReward = newlyUnlocked.reduce(
      (total, achievement) => total + achievement.rewards.xp,
      0
    );
    let newLevel = null;
    if (totalXpReward > 0) {
      const xpData = loadXp();
      newLevel = addAchievementXp(xpData, message.author.id, totalXpReward);
      saveXp(xpData);
    }
    saveEconomy(economyData);
    const embeds = newlyUnlocked.map((achievement, index) =>
      economyEmbeds.achievementUnlocked(
        message,
        account,
        achievement,
        index === newlyUnlocked.length - 1 ? newLevel : null
      )
    );
    for (let index = 0; index < embeds.length; index += 10) {
      await message.reply({
        embeds: embeds.slice(index, index + 10),
        allowedMentions: {
          repliedUser: false
        }
      });
    }
    return newlyUnlocked;
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to check achievements:', error);
    return [];
  }
}

function getLeaderboardValue(account, category) {
  const wallet = Number.isFinite(account?.wallet) ? account.wallet : 0;
  const bank = Number.isFinite(account?.bank) ? account.bank : 0;
  if (category === 'wallet') {
    return wallet;
  }
  if (category === 'bank') {
    return bank;
  }
  return wallet + bank;
}

function getLeaderboardEntries(data, guildId, category) {
  const users = data.guilds[guildId]?.users || {};
  return Object.entries(users)
    .map(([userId, account]) => ({
      userId,
      value: getLeaderboardValue(account, category)
    }))
    .sort(
      (entryA, entryB) => entryB.value - entryA.value || entryA.userId.localeCompare(entryB.userId)
    );
}

function formatMoney(amount) {
  return moneyFormatter.format(Math.floor(amount));
}

function formatXp(amount) {
  return xpFormatter.format(Math.floor(amount)).toLowerCase();
}

function randomWholeNumber(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function randomResponse(responses) {
  return responses[Math.floor(Math.random() * responses.length)];
}

async function resolveTargetMember(message, args) {
  if (args.length === 0) {
    return null;
  }
  if (message.mentions.members.size > 0) {
    if (message.mentions.members.size !== 1 || args.length !== 1) {
      return null;
    }
    return message.mentions.members.first();
  }
  const suppliedTarget = args.join(' ').trim();
  const userId = suppliedTarget.match(/^<@!?(\d{17,20})>$/)?.[1] ||
    (/^\d{17,20}$/.test(suppliedTarget) ? suppliedTarget : null);
  if (userId) {
    return (
      message.guild.members.cache.get(userId) ||
      (await message.guild.members.fetch(userId).catch(() => null))
    );
  }
  const normalizedTarget = suppliedTarget.toLowerCase();
  const usernameMatches = message.guild.members.cache.filter(
    (member) =>
      member.user.username.toLowerCase() === normalizedTarget ||
      member.user.tag.toLowerCase() === normalizedTarget
  );
  if (usernameMatches.size === 1) {
    return usernameMatches.first();
  }
  const displayNameMatches = message.guild.members.cache.filter(
    (member) => member.displayName.toLowerCase() === normalizedTarget
  );
  return displayNameMatches.size === 1 ? displayNameMatches.first() : null;
}

function hasRobbingImmunity(member, account) {
  return (
    member.roles.cache.has(robbingImmunityRoleId) ||
    account.ownedItems.includes(robbingImmunityItemId)
  );
}

function hasStaatsfeind(member, account) {
  return (
    member.roles.cache.has(staatsfeindRoleId) ||
    account.ownedItems.includes(staatsfeindItemId)
  );
}

function getBoostedSuccessChance(baseSuccessChance, member, account) {
  const successChanceBoost = hasStaatsfeind(member, account)
    ? staatsfeindSuccessChanceBoost
    : 0;
  return Math.min(100, baseSuccessChance + successChanceBoost);
}

function getDailyIncomeRoles(member) {
  const incomeRoles = [];
  for (const [roleId, income] of dailyIncomeRoles) {
    if (!member.roles.cache.has(roleId)) {
      continue;
    }
    if (!Number.isSafeInteger(income) || income <= 0) {
      throw new Error(`err income value for ${roleId} must be positive`);
    }
    incomeRoles.push({
      roleId,
      income
    });
  }
  return incomeRoles;
}

function getDailyIncomeDateTimeParts(timestamp) {
  const dateTimeParts = {};
  for (const part of dailyIncomeDateTimeFormatter.formatToParts(new Date(timestamp))) {
    if (part.type !== 'literal') {
      dateTimeParts[part.type] = Number(part.value);
    }
  }
  return dateTimeParts;
}

function getDailyIncomeDateKey(timestamp) {
  const { year, month, day } = getDailyIncomeDateTimeParts(timestamp);
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
}

function getNextDailyIncomeReset(timestamp) {
  const { year, month, day } = getDailyIncomeDateTimeParts(timestamp);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const berlinMidnightAsUtc = Date.UTC(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth(),
    tomorrow.getUTCDate()
  );
  let resetTimestamp = berlinMidnightAsUtc;
  for (let correction = 0; correction < 2; correction += 1) {
    const resetParts = getDailyIncomeDateTimeParts(resetTimestamp);
    const displayedAsUtc = Date.UTC(
      resetParts.year,
      resetParts.month - 1,
      resetParts.day,
      resetParts.hour,
      resetParts.minute,
      resetParts.second
    );
    const berlinOffset = displayedAsUtc - resetTimestamp;
    resetTimestamp = berlinMidnightAsUtc - berlinOffset;
  }
  return resetTimestamp;
}

function formatError(error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return economyMessages.unexpectedError(errorMessage);
}

function normalizeHexColor(input) {
  if (!input) {
    return null;
  }
  const hex = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((character) => character + character)
      .join('')
      .toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`;
  }
  return null;
}

function getSlotOutcome() {
  const roll = Math.random() * 100;
  let totalChance = 0;
  for (const outcome of slotConfig.outcomes) {
    totalChance += outcome.chance;
    if (roll < totalChance) {
      return outcome;
    }
  }
  return null;
}

function getRandomSlotRow() {
  const slotEmojis = slotConfig.outcomes.map((outcome) => outcome.emoji);
  return Array.from({ length: 3 }, () => slotEmojis[Math.floor(Math.random() * slotEmojis.length)]);
}

function getLosingSlotReels() {
  const slotEmojis = slotConfig.outcomes.map((outcome) => outcome.emoji);
  const reels = getRandomSlotRow();
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    const currentIndex = slotEmojis.indexOf(reels[2]);
    reels[2] = slotEmojis[(currentIndex + 1) % slotEmojis.length];
  }
  return reels;
}

function isValidRouletteSplit(numbers) {
  const [first, second] = numbers;
  if (first === 0) {
    return second >= 1 && second <= 3;
  }
  const sameStreet =
    Math.floor((first - 1) / 3) === Math.floor((second - 1) / 3);
  return (sameStreet && second - first === 1) || second - first === 3;
}

function isValidRouletteStreet(numbers) {
  if (
    numbers.join('-') === '0-1-2' ||
    numbers.join('-') === '0-2-3'
  ) {
    return true;
  }
  const [first, second, third] = numbers;
  return first % 3 === 1 && second === first + 1 && third === first + 2;
}

function isValidRouletteCorner(numbers) {
  if (numbers.join('-') === '0-1-2-3') {
    return true;
  }
  const [first, second, third, fourth] = numbers;
  return (
    first >= 1 &&
    first % 3 !== 0 &&
    second === first + 1 &&
    third === first + 3 &&
    fourth === first + 4
  );
}

function isValidRouletteSixLine(numbers) {
  if (numbers.length !== 6 || numbers[0] < 1 || numbers[0] > 31) {
    return false;
  }
  if (numbers[0] % 3 !== 1) {
    return false;
  }
  return numbers.every((number, index) => number === numbers[0] + index);
}

function normalizeRouletteSpace(input) {
  const normalizedInput = input
    .toLowerCase()
    .trim()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, '');
  const outsideBetKey = rouletteSpaceAliases.get(normalizedInput);
  if (outsideBetKey) {
    const outsideBet = rouletteOutsideBets.get(outsideBetKey);
    return {
      key: outsideBetKey,
      label: outsideBet.label,
      multiplier: outsideBet.multiplier
    };
  }
  if (/^(?:0|[1-9]\d?)$/.test(normalizedInput)) {
    const number = Number(normalizedInput);
    if (number >= 0 && number <= 36) {
      return {
        key: 'inside',
        label: String(number),
        multiplier: 36,
        numbers: [number]
      };
    }
    return null;
  }
  if (!/^(?:0|[1-9]\d?)(?:[-,/](?:0|[1-9]\d?))+$/.test(normalizedInput)) {
    return null;
  }
  const numbers = normalizedInput
    .split(/[-,/]/)
    .map(Number)
    .sort((first, second) => first - second);
  if (
    numbers.some((number) => number < 0 || number > 36) ||
    new Set(numbers).size !== numbers.length
  ) {
    return null;
  }
  const validCombination =
    (numbers.length === 2 && isValidRouletteSplit(numbers)) ||
    (numbers.length === 3 && isValidRouletteStreet(numbers)) ||
    (numbers.length === 4 && isValidRouletteCorner(numbers)) ||
    isValidRouletteSixLine(numbers);
  if (!validCombination) {
    return null;
  }
  return {
    key: 'inside',
    label: numbers.join('-'),
    multiplier: 36 / numbers.length,
    numbers
  };
}

function getRouletteNumberColor(number) {
  if (number === 0) {
    return 'green';
  }
  return rouletteRedNumbers.has(number) ? 'red' : 'black';
}

function rouletteBetWins(bet, number) {
  if (bet.key === 'inside') {
    return bet.numbers.includes(number);
  }
  if (number === 0) {
    return false;
  }
  if (bet.key === 'red' || bet.key === 'black') {
    return getRouletteNumberColor(number) === bet.key;
  }
  if (bet.key === 'even') {
    return number % 2 === 0;
  }
  if (bet.key === 'odd') {
    return number % 2 === 1;
  }
  if (bet.key === 'low') {
    return number <= 18;
  }
  if (bet.key === 'high') {
    return number >= 19;
  }
  if (bet.key === 'dozen1') {
    return number <= 12;
  }
  if (bet.key === 'dozen2') {
    return number >= 13 && number <= 24;
  }
  if (bet.key === 'dozen3') {
    return number >= 25;
  }
  if (bet.key === 'column1') {
    return number % 3 === 1;
  }
  if (bet.key === 'column2') {
    return number % 3 === 2;
  }
  return bet.key === 'column3' && number % 3 === 0;
}

function formatRouletteSummaries(summaries, resultWord) {
  const maximumDisplayedUsers = 15;
  const lines = summaries.slice(0, maximumDisplayedUsers).map((summary) => {
    if (summary.net === 0) {
      return `<@${summary.userId}> ${resultWord}`;
    }
    return (
      `<@${summary.userId}> ${resultWord} ` +
      `${currencyEmoji}**${formatMoney(Math.abs(summary.net))}**`
    );
  });
  if (summaries.length > maximumDisplayedUsers) {
    lines.push(`...and ${summaries.length - maximumDisplayedUsers} more`);
  }
  return lines.join('\n');
}

function scheduleRouletteGame(game) {
  clearTimeout(game.timer);
  game.endsAt = Date.now() + rouletteConfig.bettingSeconds * 1000;
  game.timer = setTimeout(() => {
    settleRouletteGame(game).catch((error) => {
      console.error('[ECONOMY ERROR]: Failed to settle roulette:', error);
    });
  }, rouletteConfig.bettingSeconds * 1000);
  game.timer.unref?.();
}

function createRouletteSummaries(game, number, economyData) {
  const summariesByUser = new Map();
  for (const bet of game.bets) {
    const account = getAccount(economyData, game.guildId, bet.userId);
    const betWon = rouletteBetWins(bet, number);
    const payout = betWon ? Math.floor(bet.amount * bet.multiplier) : 0;
    account.wallet += payout;
    incrementAchievementStatistic(account, 'roulette_bets');
    incrementAchievementStatistic(account, 'roulette_wagered', bet.amount);
    setMaximumAchievementStatistic(account, 'largest_roulette_bet', bet.amount);
    incrementAchievementStatistic(account, betWon ? 'roulette_bets_won' : 'roulette_bets_lost');
    if (payout > 0) {
      incrementAchievementStatistic(account, 'roulette_payouts', payout);
      setMaximumAchievementStatistic(account, 'largest_roulette_payout', payout);
    }
    const summary = summariesByUser.get(bet.userId) || {
      userId: bet.userId,
      amountBet: 0,
      payout: 0,
      net: 0
    };
    summary.amountBet += bet.amount;
    summary.payout += payout;
    summary.net += payout - bet.amount;
    summariesByUser.set(bet.userId, summary);
  }
  for (const summary of summariesByUser.values()) {
    const account = getAccount(economyData, game.guildId, summary.userId);
    incrementAchievementStatistic(account, 'roulette_games');
    if (summary.net > 0) {
      incrementAchievementStatistic(account, 'roulette_wins');
      recordMoneyEarned(account, 'roulette', summary.net);
    } else if (summary.net < 0) {
      incrementAchievementStatistic(account, 'roulette_losses');
      recordMoneyLost(account, 'roulette', Math.abs(summary.net));
    } else {
      incrementAchievementStatistic(account, 'roulette_draws');
    }
  }
  return [...summariesByUser.values()];
}

async function sendRouletteEmbed(game, embed) {
  const sends = [...game.channels.values()].map((channel) =>
    channel
      .send({
        embeds: [embed],
        allowedMentions: {
          parse: []
        }
      })
      .catch((error) => {
        console.error('[ECONOMY ERROR]: Failed to send roulette result:', error);
      })
  );
  await Promise.all(sends);
}

async function cancelRouletteGame(game) {
  if (rouletteGames.get(game.guildId) !== game) {
    return;
  }
  clearTimeout(game.timer);
  rouletteGames.delete(game.guildId);
  let refunded = false;
  try {
    const economyData = loadEconomy();
    for (const bet of game.bets) {
      const account = getAccount(economyData, game.guildId, bet.userId);
      account.wallet += bet.amount;
    }
    saveEconomy(economyData);
    refunded = true;
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to refund roulette bets:', error);
  }
  game.helpCollector?.stop('roulette_finished');
  const embed = refunded
    ? economyEmbeds.rouletteCancelled()
    : new EmbedBuilder()
        .setColor(failEmbedColor)
        .setTitle('Roulette error')
        .setDescription('The game could not finish or refund its bets. Please report this to ales.js.');
  await sendRouletteEmbed(game, embed);
}

async function settleRouletteGame(game) {
  if (rouletteGames.get(game.guildId) !== game || game.settling) {
    return;
  }
  if (Date.now() < game.endsAt) {
    clearTimeout(game.timer);
    game.timer = setTimeout(() => {
      settleRouletteGame(game).catch((error) => {
        console.error('[ECONOMY ERROR]: Failed to settle roulette:', error);
      });
    }, game.endsAt - Date.now());
    game.timer.unref?.();
    return;
  }
  game.settling = true;
  let number;
  let summaries;
  try {
    const economyData = loadEconomy();
    number = randomInt(0, 37);
    summaries = createRouletteSummaries(game, number, economyData);
    saveEconomy(economyData);
  } catch (error) {
    game.settling = false;
    console.error('[ECONOMY ERROR]: Failed to finish roulette game:', error);
    await cancelRouletteGame(game);
    return;
  }
  clearTimeout(game.timer);
  rouletteGames.delete(game.guildId);
  game.helpCollector?.stop('roulette_finished');
  const embed = economyEmbeds.rouletteResult(number, summaries);
  await sendRouletteEmbed(game, embed);
  for (const achievementMessage of game.achievementMessages?.values() || []) {
    await checkAndAnnounceAchievements(achievementMessage);
  }
}

function startRouletteHelpCollector(game, rouletteMessage) {
  const collector = rouletteMessage.createMessageComponentCollector({
    componentType: ComponentType.Button
  });
  game.helpCollector = collector;
  collector.on('collect', async (interaction) => {
    if (interaction.customId !== rouletteButtonIds.help) {
      return;
    }
    await interaction
      .reply({
        embeds: [economyEmbeds.rouletteHelp()],
        flags: MessageFlags.Ephemeral
      })
      .catch(() => {});
  });
  collector.on('end', async () => {
    await rouletteMessage
      .edit({
        components: [createRouletteHelpButton(true)]
      })
      .catch(() => {});
  });
}

async function showHelp(message) {
  try {
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    saveEconomy(economyData);
    const totalPages = Math.max(
      1,
      Math.ceil(helpCommandEntries.length / helpConfig.commandsPerPage)
    );
    let currentPage = 0;
    const embed = economyEmbeds.help(message, account, currentPage, totalPages);
    const components = totalPages > 1 ? [createHelpButtons(currentPage, totalPages)] : [];
    const helpMessage = await message.reply({
      embeds: [embed],
      components
    });
    if (totalPages <= 1) {
      return helpMessage;
    }
    const collector = helpMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: helpConfig.buttonTimeoutMinutes * 60 * 1000
    });
    collector.on('collect', async (interaction) => {
      try {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({
            content: economyMessages.helpWrongUser(message.author.id),
            flags: MessageFlags.Ephemeral,
            allowedMentions: {
              parse: []
            }
          });
          return;
        }
        let pageInteraction = interaction;
        if (interaction.customId === helpButtonIds.first) {
          currentPage = 0;
        } else if (interaction.customId === helpButtonIds.previous) {
          currentPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === helpButtonIds.next) {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        } else if (interaction.customId === helpButtonIds.last) {
          currentPage = totalPages - 1;
        } else if (interaction.customId === helpButtonIds.page) {
          collector.resetTimer();
          const modalId = `economy_help_page_modal:${interaction.id}`;
          const modalInteraction = await waitForPageModal(interaction, modalId, totalPages);
          if (!modalInteraction) {
            return;
          }
          const requestedPage = getPageFromModal(modalInteraction, totalPages);
          if (requestedPage === null) {
            await modalInteraction.reply({
              content: 'Please enter a whole page number.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          currentPage = requestedPage;
          pageInteraction = modalInteraction;
        } else {
          return;
        }
        const updatedEmbed = economyEmbeds.help(
          message,
          account,
          currentPage,
          totalPages
        );
        await pageInteraction.update({
          embeds: [updatedEmbed],
          components: [createHelpButtons(currentPage, totalPages)]
        });
      } catch (error) {
        console.error('[ECONOMY ERROR]: Failed to change help page:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              content: formatError(error),
              flags: MessageFlags.Ephemeral
            })
            .catch(() => {});
        }
      }
    });
    collector.on('end', async () => {
      await helpMessage
        .edit({
          components: [createHelpButtons(currentPage, totalPages, true)]
        })
        .catch(() => {});
    });
    return helpMessage;
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to show help:', error);
    return message.reply(formatError(error));
  }
}

function getLevelEmbed(guildId, user, member) {
  return economyEmbeds.level(
    { guild: { id: guildId }, author: user, member },
    xpStore.getUserProgress(user.id)
  );
}

async function showLevel(message, args = []) {
  try {
    const embed = args.length > 0
      ? economyEmbeds.levelInvalidUsage(message)
      : getLevelEmbed(message.guild.id, message.author, message.member);
    return message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('[XP ERROR]: Failed to show level:', error);
    return message.reply(formatError(error));
  }
}

async function showBalance(message, args = []) {
  try {
    const mentionedUser = message.mentions.users.first();
    const mentionedMember = message.mentions.members.first();
    if (args.length > 1 || (args.length === 1 && (!mentionedUser || !mentionedMember))) {
      const suppliedTarget = args.join(' ');
      const embed = economyEmbeds.balanceInvalidTarget(message, suppliedTarget);
      return message.reply({
        embeds: [embed]
      });
    }
    const economyData = loadEconomy();
    const target = mentionedUser || message.author;
    const targetMember = mentionedMember || message.member;
    const account = getAccount(economyData, message.guild.id, target.id, targetMember);
    saveEconomy(economyData);
    const total = account.wallet + account.bank;
    const totalLeaderboardEntries = getLeaderboardEntries(economyData, message.guild.id, 'total');
    const leaderboardRank =
      totalLeaderboardEntries.findIndex((entry) => entry.userId === target.id) + 1;
    const embed = economyEmbeds.balance(message, target, account, total, leaderboardRank);
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to show balance:', error);
    return message.reply(formatError(error));
  }
}

function getCooldownFields(account, member, now = Date.now()) {
  const fields = [
    ['work', account.lastWorkAt, workConfig.cooldownMinutes],
    ['crime', account.lastCrimeAt, crimeConfig.cooldownMinutes],
    ['rob', account.lastRobAt, robConfig.cooldownMinutes],
    ['beg', account.lastBegAt, begConfig.cooldownMinutes]
  ].map(([command, lastUsedAt, minutes]) => {
    const nextUseAt = lastUsedAt + minutes * 60 * 1000;
    return {
      name: `?${command}`,
      value: nextUseAt <= now
        ? cooldownText.ready
        : cooldownText.availableAt(Math.ceil(nextUseAt / 1000)),
      inline: false
    };
  });
  const incomeRoles = getDailyIncomeRoles(member);
  const claimedToday = account.incomeRoleClaimsDate === getDailyIncomeDateKey(now);
  const availableRoles = incomeRoles.filter(({ roleId }) =>
    !claimedToday || !account.collectedIncomeRoleIds.includes(roleId)
  );
  const collectStatus = incomeRoles.length === 0
    ? cooldownText.noIncomeRoles
    : availableRoles.length > 0
      ? cooldownText.readyIncome(availableRoles.length, incomeRoles.length)
      : cooldownText.availableAt(Math.ceil(getNextDailyIncomeReset(now) / 1000));
  fields.push({ name: '?collect', value: collectStatus, inline: false });
  return fields;
}

async function showCooldowns(message, args = []) {
  try {
    if (args.length > 0) {
      return message.reply({ embeds: [economyEmbeds.cooldownsInvalidUsage(message)] });
    }
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const fields = getCooldownFields(account, message.member);
    saveEconomy(economyData);
    return message.reply({ embeds: [economyEmbeds.cooldowns(message, account, fields)] });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to show cooldowns:', error);
    return message.reply(formatError(error));
  }
}

async function showStats(message, args = []) {
  try {
    if (args.length > 0) {
      const embed = economyEmbeds.statsInvalidUsage(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    saveEconomy(economyData);
    const totalPages = Math.max(
      1,
      Math.ceil(statisticNames.length / statsConfig.statisticsPerPage)
    );
    let currentPage = 0;
    const embed = economyEmbeds.stats(message, account, currentPage, totalPages);
    const components = totalPages > 1 ? [createStatsButtons(currentPage, totalPages)] : [];
    const statsMessage = await message.reply({
      embeds: [embed],
      components
    });
    if (totalPages <= 1) {
      return statsMessage;
    }
    const collector = statsMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: statsConfig.buttonTimeoutMinutes * 60 * 1000
    });
    collector.on('collect', async (interaction) => {
      try {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({
            content: economyMessages.statsWrongUser(message.author.id),
            flags: MessageFlags.Ephemeral,
            allowedMentions: {
              parse: []
            }
          });
          return;
        }
        let pageInteraction = interaction;
        if (interaction.customId === statsButtonIds.first) {
          currentPage = 0;
        } else if (interaction.customId === statsButtonIds.previous) {
          currentPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === statsButtonIds.next) {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        } else if (interaction.customId === statsButtonIds.last) {
          currentPage = totalPages - 1;
        } else if (interaction.customId === statsButtonIds.page) {
          collector.resetTimer();
          const modalId = `economy_stats_page_modal:${interaction.id}`;
          const modalInteraction = await waitForPageModal(interaction, modalId, totalPages);
          if (!modalInteraction) {
            return;
          }
          const requestedPage = getPageFromModal(modalInteraction, totalPages);
          if (requestedPage === null) {
            await modalInteraction.reply({
              content: 'Please enter a whole page number.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          currentPage = requestedPage;
          pageInteraction = modalInteraction;
        } else {
          return;
        }
        const updatedEconomyData = loadEconomy();
        const updatedAccount = getAccount(
          updatedEconomyData,
          message.guild.id,
          message.author.id,
          message.member
        );
        saveEconomy(updatedEconomyData);
        const updatedEmbed = economyEmbeds.stats(
          message,
          updatedAccount,
          currentPage,
          totalPages
        );
        await pageInteraction.update({
          embeds: [updatedEmbed],
          components: [createStatsButtons(currentPage, totalPages)]
        });
      } catch (error) {
        console.error('[ECONOMY ERROR]: Failed to change statistics page:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              content: formatError(error),
              flags: MessageFlags.Ephemeral
            })
            .catch(() => {});
        }
      }
    });
    collector.on('end', async () => {
      await statsMessage
        .edit({
          components: [createStatsButtons(currentPage, totalPages, true)]
        })
        .catch(() => {});
    });
    return statsMessage;
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to show statistics:', error);
    return message.reply(formatError(error));
  }
}

function getLevelLeaderboardEntries() {
  return Object.entries(xpStore.loadXp())
    .map(([userId, account]) => ({ userId, level: account.level, xp: account.xp }))
    .sort((a, b) => b.level - a.level || b.xp - a.xp);
}

async function showLevelLeaderboard(interaction) {
  if (!interaction.guildId) {
    return interaction.reply({ content: 'Use this command in a server.', flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply();
  return showLeaderboard({
    guild: interaction.guild,
    author: interaction.user,
    member: interaction.member,
    reply: payload => interaction.editReply(payload)
  }, ['level']);
}

async function showLeaderboard(message, args = []) {
  try {
    const requestedCategory = args[0]?.toLowerCase();
    const category = requestedCategory
      ? (levelAliases.has(requestedCategory) ? 'level' : leaderboardCategoryAliases.get(requestedCategory))
      : 'total';
    if (args.length > 1 || !category) {
      const suppliedCategory = args.join(' ');
      const embed = economyEmbeds.leaderboardInvalidCategory(message, suppliedCategory);
      return message.reply({
        embeds: [embed]
      });
    }
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    saveEconomy(economyData);
    const entries = category === 'level'
      ? getLevelLeaderboardEntries()
      : getLeaderboardEntries(economyData, message.guild.id, category);
    const totalPages = Math.max(1, Math.ceil(entries.length / leaderboardConfig.usersPerPage));
    let currentPage = 0;
    const embed = economyEmbeds.leaderboard(
      message,
      account,
      entries,
      category,
      currentPage,
      totalPages
    );
    const components = totalPages > 1 ? [createLeaderboardButtons(currentPage, totalPages)] : [];
    const leaderboardMessage = await message.reply({
      embeds: [embed],
      components,
      allowedMentions: {
        parse: [],
        repliedUser: false
      }
    });
    if (totalPages <= 1) {
      return leaderboardMessage;
    }
    const collector = leaderboardMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: leaderboardConfig.buttonTimeoutMinutes * 60 * 1000
    });
    collector.on('collect', async (interaction) => {
      try {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({
            content: economyMessages.leaderboardWrongUser(message.author.id),
            flags: MessageFlags.Ephemeral,
            allowedMentions: {
              parse: []
            }
          });
          return;
        }
        let pageInteraction = interaction;
        if (interaction.customId === leaderboardButtonIds.first) {
          currentPage = 0;
        } else if (interaction.customId === leaderboardButtonIds.previous) {
          currentPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === leaderboardButtonIds.next) {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        } else if (interaction.customId === leaderboardButtonIds.last) {
          currentPage = totalPages - 1;
        } else if (interaction.customId === leaderboardButtonIds.page) {
          collector.resetTimer();
          const modalId = `economy_leaderboard_page_modal:${interaction.id}`;
          const modalInteraction = await waitForPageModal(interaction, modalId, totalPages);
          if (!modalInteraction) {
            return;
          }
          const requestedPage = getPageFromModal(modalInteraction, totalPages);
          if (requestedPage === null) {
            await modalInteraction.reply({
              content: 'Please enter a whole page number.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          currentPage = requestedPage;
          pageInteraction = modalInteraction;
        } else {
          return;
        }
        const updatedEmbed = economyEmbeds.leaderboard(
          message,
          account,
          entries,
          category,
          currentPage,
          totalPages
        );
        await pageInteraction.update({
          embeds: [updatedEmbed],
          components: [createLeaderboardButtons(currentPage, totalPages)],
          allowedMentions: {
            parse: [],
            repliedUser: false
          }
        });
      } catch (error) {
        console.error('[ECONOMY ERROR]: Failed to change leaderboard page:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              content: formatError(error),
              flags: MessageFlags.Ephemeral
            })
            .catch(() => {});
        }
      }
    });
    collector.on('end', async () => {
      const disabledComponents = [createLeaderboardButtons(currentPage, totalPages, true)];
      await leaderboardMessage
        .edit({
          components: disabledComponents
        })
        .catch(() => {});
    });
    return leaderboardMessage;
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to show leaderboard:', error);
    return message.reply(formatError(error));
  }
}

async function showAchievements(message, args = []) {
  try {
    if (args.length > 0) {
      const embed = economyEmbeds.achievementsInvalidUsage(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const achievements = loadAchievements();
    saveEconomy(economyData);
    const totalPages = Math.max(
      1,
      Math.ceil(achievements.length / achievementConfig.achievementsPerPage)
    );
    let currentPage = 0;
    const components = createAchievementComponents(
      account,
      achievements,
      currentPage,
      totalPages,
      false,
      economyData.guilds[message.guild.id]?.users || {}
    );
    const achievementMessage = await message.reply({
      components,
      flags: MessageFlags.IsComponentsV2
    });
    if (totalPages <= 1) {
      return achievementMessage;
    }
    const collector = achievementMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: achievementConfig.buttonTimeoutMinutes * 60 * 1000
    });
    collector.on('collect', async (interaction) => {
      try {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({
            content: economyMessages.achievementsWrongUser(message.author.id),
            flags: MessageFlags.Ephemeral,
            allowedMentions: {
              parse: []
            }
          });
          return;
        }
        let pageInteraction = interaction;
        if (interaction.customId === achievementButtonIds.first) {
          currentPage = 0;
        } else if (interaction.customId === achievementButtonIds.previous) {
          currentPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === achievementButtonIds.next) {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        } else if (interaction.customId === achievementButtonIds.last) {
          currentPage = totalPages - 1;
        } else if (interaction.customId === achievementButtonIds.page) {
          collector.resetTimer();
          const modalId = `economy_achievement_page_modal:${interaction.id}`;
          const modalInteraction = await waitForPageModal(interaction, modalId, totalPages);
          if (!modalInteraction) {
            return;
          }
          const requestedPage = getPageFromModal(modalInteraction, totalPages);
          if (requestedPage === null) {
            await modalInteraction.reply({
              content: 'Please enter a whole page number.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          currentPage = requestedPage;
          pageInteraction = modalInteraction;
        } else {
          return;
        }
        const updatedEconomyData = loadEconomy();
        const updatedAccount = getAccount(
          updatedEconomyData,
          message.guild.id,
          message.author.id,
          message.member
        );
        saveEconomy(updatedEconomyData);
        const updatedComponents = createAchievementComponents(
          updatedAccount,
          achievements,
          currentPage,
          totalPages,
          false,
          updatedEconomyData.guilds[message.guild.id]?.users || {}
        );
        await pageInteraction.update({
          components: updatedComponents
        });
      } catch (error) {
        console.error('[ECONOMY ERROR]: Failed to change achievement page:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              content: formatError(error),
              flags: MessageFlags.Ephemeral
            })
            .catch(() => {});
        }
      }
    });
    collector.on('end', async () => {
      await achievementMessage
        .edit({
          components: createAchievementComponents(
            account,
            achievements,
            currentPage,
            totalPages,
            true,
            loadEconomy().guilds[message.guild.id]?.users || {}
          )
        })
        .catch(() => {});
    });
    return achievementMessage;
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to show achievements:', error);
    return message.reply(formatError(error));
  }
}

async function work(message) {
  try {
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const now = Date.now();
    const cooldownMilliseconds = workConfig.cooldownMinutes * 60 * 1000;
    const nextWorkAt = account.lastWorkAt + cooldownMilliseconds;
    if (now < nextWorkAt) {
      saveEconomy(economyData);
      const nextWorkTimestamp = Math.ceil(nextWorkAt / 1000);
      const cooldownResponse = workCooldownResponses[
        Math.floor(Math.random() * workCooldownResponses.length)
      ].replace('{time}', `<t:${nextWorkTimestamp}:R>`);
      const embed = economyEmbeds.workCooldown(message, cooldownResponse);
      return message.reply({
        embeds: [embed]
      });
    }
    const earnedMoney =
      Math.floor(Math.random() * (workConfig.maximumPay - workConfig.minimumPay + 1)) +
      workConfig.minimumPay;
    // transfer from earnedMoney to wallet \\
    account.wallet += earnedMoney;
    account.lastWorkAt = now;
    incrementAchievementStatistic(account, 'work');
    recordMoneyEarned(account, 'work', earnedMoney);
    saveEconomy(economyData);
    const formattedEarnings = `${currencyEmoji}**${formatMoney(earnedMoney)}**`;
    const workResponse = workResponses[Math.floor(Math.random() * workResponses.length)].replace(
      '{amount}',
      formattedEarnings
    );
    const embed = economyEmbeds.workSuccess(message, account, workResponse);
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to work:', error);
    return message.reply(formatError(error));
  }
}

async function collectDailyIncome(message, args = []) {
  try {
    if (args.length > 0) {
      const embed = economyEmbeds.collectInvalidUsage(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const incomeRoles = getDailyIncomeRoles(message.member);
    if (incomeRoles.length === 0) {
      saveEconomy(economyData);
      const embed = economyEmbeds.collectNoIncomeRoles(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const now = Date.now();
    const today = getDailyIncomeDateKey(now);
    if (!account.incomeRoleClaimsDate) {
      account.incomeRoleClaimsDate = today;
      account.collectedIncomeRoleIds = [];
    } else if (account.incomeRoleClaimsDate !== today) {
      account.incomeRoleClaimsDate = today;
      account.collectedIncomeRoleIds = [];
    }
    const unclaimedIncomeRoles = incomeRoles.filter(
      (role) => !account.collectedIncomeRoleIds.includes(role.roleId)
    );
    if (unclaimedIncomeRoles.length === 0) {
      saveEconomy(economyData);
      const nextCollectAt = getNextDailyIncomeReset(now);
      const nextCollectTimestamp = Math.ceil(nextCollectAt / 1000);
      const embed = economyEmbeds.collectCooldown(
        message,
        nextCollectTimestamp,
        incomeRoles
      );
      return message.reply({
        embeds: [embed]
      });
    }
    const dailyIncome = unclaimedIncomeRoles.reduce(
      (total, role) => total + role.income,
      0
    );
    account.wallet += dailyIncome;
    account.lastCollectAt = now;
    account.collectedIncomeRoleIds.push(
      ...unclaimedIncomeRoles.map((role) => role.roleId)
    );
    incrementAchievementStatistic(account, 'collect');
    recordMoneyEarned(account, 'collect', dailyIncome);
    saveEconomy(economyData);
    const embed = economyEmbeds.collectSuccess(
      message,
      account,
      dailyIncome,
      unclaimedIncomeRoles
    );
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to collect daily income:', error);
    return message.reply(formatError(error));
  }
}

async function crime(message) {
  try {
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const now = Date.now();
    const cooldownMilliseconds = crimeConfig.cooldownMinutes * 60 * 1000;
    const nextCrimeAt = account.lastCrimeAt + cooldownMilliseconds;
    if (now < nextCrimeAt) {
      saveEconomy(economyData);
      const nextCrimeTimestamp = Math.ceil(nextCrimeAt / 1000);
      const cooldownResponse = randomResponse(crimeCooldownResponses).replace(
        '{time}',
        `<t:${nextCrimeTimestamp}:R>`
      );
      const embed = economyEmbeds.crimeCooldown(message, cooldownResponse);
      return message.reply({
        embeds: [embed]
      });
    }
    const successChance = getBoostedSuccessChance(
      crimeConfig.successChance,
      message.member,
      account
    );
    const succeeded = Math.random() * 100 < successChance;
    account.lastCrimeAt = now;
    let embed;
    if (succeeded) {
      const earnedMoney = randomWholeNumber(crimeConfig.minimumPay, crimeConfig.maximumPay);
      account.wallet += earnedMoney;
      const formattedEarnings = `${currencyEmoji}**${formatMoney(earnedMoney)}**`;
      const crimeResponse = randomResponse(crimeSuccessResponses).replace(
        '{amount}',
        formattedEarnings
      );
      embed = economyEmbeds.crimeSuccess(message, account, crimeResponse);
      incrementAchievementStatistic(account, 'crime_successes');
      recordMoneyEarned(account, 'crime', earnedMoney);
      setAchievementTimestamp(account, 'last_crime_success_at', now);
    } else {
      const possibleFine = randomWholeNumber(crimeConfig.minimumFine, crimeConfig.maximumFine);
      const lostMoney = possibleFine;
      account.wallet -= lostMoney;
      const formattedLoss = `${currencyEmoji}**${formatMoney(lostMoney)}**`;
      const crimeResponse = randomResponse(crimeFailResponses).replace('{amount}', formattedLoss);
      embed = economyEmbeds.crimeFail(message, crimeResponse);
      incrementAchievementStatistic(account, 'crime_failures');
      recordMoneyLost(account, 'crime', lostMoney);
    }
    saveEconomy(economyData);
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to commit crime:', error);
    return message.reply(formatError(error));
  }
}

async function rob(message, args = []) {
  try {
    if (args.length === 0) {
      const embed = economyEmbeds.robMissingTarget(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const targetMember = await resolveTargetMember(message, args);
    if (!targetMember) {
      const embed = economyEmbeds.robInvalidTarget(message, args.join(' '));
      return message.reply({
        embeds: [embed]
      });
    }
    if (targetMember.id === message.author.id) {
      const embed = economyEmbeds.robSelf(message);
      return message.reply({
        embeds: [embed]
      });
    }
    if (targetMember.user.bot) {
      const embed = economyEmbeds.robBot(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const economyData = loadEconomy();
    const account = getAccount(
      economyData,
      message.guild.id,
      message.author.id,
      message.member
    );
    const targetAccount = getAccount(
      economyData,
      message.guild.id,
      targetMember.id,
      targetMember
    );
    if (hasRobbingImmunity(targetMember, targetAccount)) {
      saveEconomy(economyData);
      const embed = economyEmbeds.robImmune(message, targetMember.user);
      return message.reply({
        embeds: [embed]
      });
    }
    if (targetAccount.wallet <= 0) {
      saveEconomy(economyData);
      const embed = economyEmbeds.robEmptyWallet(message, targetMember.user);
      return message.reply({
        embeds: [embed]
      });
    }
    const now = Date.now();
    const cooldownMilliseconds = robConfig.cooldownMinutes * 60 * 1000;
    const nextRobAt = account.lastRobAt + cooldownMilliseconds;
    if (now < nextRobAt) {
      saveEconomy(economyData);
      const nextRobTimestamp = Math.ceil(nextRobAt / 1000);
      const embed = economyEmbeds.robCooldown(message, nextRobTimestamp);
      return message.reply({
        embeds: [embed]
      });
    }
    const successChance = getBoostedSuccessChance(
      robConfig.successChance,
      message.member,
      account
    );
    const succeeded = Math.random() * 100 < successChance;
    account.lastRobAt = now;
    let embed;
    if (succeeded) {
      const stolenPercentage = randomWholeNumber(
        robConfig.minimumWalletPercentage,
        robConfig.maximumWalletPercentage
      );
      const stolenMoney = Math.min(
        targetAccount.wallet,
        Math.max(1, Math.floor((targetAccount.wallet * stolenPercentage) / 100))
      );
      targetAccount.wallet -= stolenMoney;
      account.wallet += stolenMoney;
      embed = economyEmbeds.robSuccess(
        message,
        account,
        targetMember.user,
        stolenMoney,
        stolenPercentage
      );
      incrementAchievementStatistic(account, 'rob_successes');
      recordMoneyEarned(account, 'rob', stolenMoney);
      incrementAchievementStatistic(targetAccount, 'times_robbed');
      incrementAchievementStatistic(targetAccount, 'money_lost_to_robbery', stolenMoney);
      recordMoneyLost(targetAccount, 'robbery', stolenMoney);
      setAchievementTimestamp(account, 'last_rob_success_at', now);
    } else {
      const fine = randomWholeNumber(robConfig.minimumFine, robConfig.maximumFine);
      account.wallet -= fine;
      embed = economyEmbeds.robFail(message, targetMember.user, fine);
      incrementAchievementStatistic(account, 'rob_failures');
      recordMoneyLost(account, 'rob_fines', fine);
    }
    saveEconomy(economyData);
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to rob user:', error);
    return message.reply(formatError(error));
  }
}

async function beg(message) {
  try {
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const now = Date.now();
    const cooldownMilliseconds = begConfig.cooldownMinutes * 60 * 1000;
    const nextBegAt = account.lastBegAt + cooldownMilliseconds;
    if (now < nextBegAt) {
      saveEconomy(economyData);
      const nextBegTimestamp = Math.ceil(nextBegAt / 1000);
      const cooldownResponse = randomResponse(begCooldownResponses).replace(
        '{time}',
        `<t:${nextBegTimestamp}:R>`
      );
      const embed = economyEmbeds.begCooldown(message, cooldownResponse);
      return message.reply({
        embeds: [embed]
      });
    }
    const earnedMoney = randomWholeNumber(begConfig.minimumPay, begConfig.maximumPay);
    account.wallet += earnedMoney;
    account.lastBegAt = now;
    incrementAchievementStatistic(account, 'beg');
    recordMoneyEarned(account, 'beg', earnedMoney);
    saveEconomy(economyData);
    const formattedEarnings = `${currencyEmoji}**${formatMoney(earnedMoney)}**`;
    const begResponse = randomResponse(begResponses).replace('{amount}', formattedEarnings);
    const embed = economyEmbeds.begSuccess(message, account, begResponse);
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to beg:', error);
    return message.reply(formatError(error));
  }
}

async function deposit(message, args) {
  try {
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const requestedAmount = args[0]?.toLowerCase();
    if (!requestedAmount) {
      const embed = economyEmbeds.depositMissingAmount(message);
      return message.reply({
        embeds: [embed]
      });
    }
    let amount;
    if (requestedAmount === 'all') {
      amount = account.wallet;
    } else if (requestedAmount === 'half') {
      amount = Math.floor(account.wallet / 2);
    } else if (requestedAmount === 'quarter') {
      amount = Math.floor(account.wallet / 4);
    } else {
      if (!/^\d+$/.test(requestedAmount)) {
        const embed = economyEmbeds.depositInvalidAmount(message, requestedAmount);
        return message.reply({
          embeds: [embed]
        });
      }
      amount = Number(requestedAmount);
    }
    if (!Number.isSafeInteger(amount)) {
      const embed = economyEmbeds.depositInvalidWholeNumber(message);
      return message.reply({
        embeds: [embed]
      });
    }
    if (account.wallet <= 0) {
      const embed = economyEmbeds.depositNoFunds(message, account.wallet);
      return message.reply({
        embeds: [embed]
      });
    }
    if (amount <= 0) {
      const embed = economyEmbeds.depositInvalidWholeNumber(message);
      return message.reply({
        embeds: [embed]
      });
    }
    if (amount > account.wallet) {
      const embed = economyEmbeds.depositInsufficientFunds(message, account.wallet);
      return message.reply({
        embeds: [embed]
      });
    }
    // transfer from wallet to bank \\
    account.wallet -= amount;
    account.bank += amount;
    incrementAchievementStatistic(account, 'deposits');
    incrementAchievementStatistic(account, 'money_deposited', amount);
    setMaximumAchievementStatistic(account, 'largest_deposit', amount);
    const total = account.wallet + account.bank;
    saveEconomy(economyData);
    const embed = economyEmbeds.depositSuccess(message, account, amount, total);
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to deposit:', error);
    return message.reply(formatError(error));
  }
}

async function withdraw(message, args) {
  try {
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const requestedAmount = args[0]?.toLowerCase();
    if (!requestedAmount) {
      const embed = economyEmbeds.withdrawMissingAmount(message);
      return message.reply({
        embeds: [embed]
      });
    }
    let amount;
    if (requestedAmount === 'all') {
      amount = account.bank;
    } else if (requestedAmount === 'half') {
      amount = Math.floor(account.bank / 2);
    } else if (requestedAmount === 'quarter') {
      amount = Math.floor(account.bank / 4);
    } else {
      if (!/^\d+$/.test(requestedAmount)) {
        const embed = economyEmbeds.withdrawInvalidAmount(message, requestedAmount);
        return message.reply({
          embeds: [embed]
        });
      }
      amount = Number(requestedAmount);
    }
    if (!Number.isSafeInteger(amount)) {
      const embed = economyEmbeds.withdrawInvalidWholeNumber(message);
      return message.reply({
        embeds: [embed]
      });
    }
    if (account.bank <= 0) {
      const embed = economyEmbeds.withdrawNoFunds(message, account.bank);
      return message.reply({
        embeds: [embed]
      });
    }
    if (amount <= 0) {
      const embed = economyEmbeds.withdrawInvalidWholeNumber(message);
      return message.reply({
        embeds: [embed]
      });
    }
    if (amount > account.bank) {
      const embed = economyEmbeds.withdrawInsufficientFunds(message, account.bank);
      return message.reply({
        embeds: [embed]
      });
    }
    // transfer from bank to wallet \\
    account.bank -= amount;
    account.wallet += amount;
    incrementAchievementStatistic(account, 'withdrawals');
    incrementAchievementStatistic(account, 'money_withdrawn', amount);
    setMaximumAchievementStatistic(account, 'largest_withdrawal', amount);
    const total = account.bank + account.wallet;
    saveEconomy(economyData);
    const embed = economyEmbeds.withdrawSuccess(message, account, amount, total);
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to withdraw:', error);
    return message.reply(formatError(error));
  }
}

async function giveMoney(message, args) {
  try {
    if (args.length < 2) {
      const embed = economyEmbeds.giveMissingArguments(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const requestedAmount = args.at(-1).toLowerCase();
    const targetArguments = args.slice(0, -1);
    const namedAmounts = new Set(['all', 'half', 'quarter']);
    if (!namedAmounts.has(requestedAmount) && !/^\d+$/.test(requestedAmount)) {
      const embed = economyEmbeds.giveInvalidAmount(message, requestedAmount);
      return message.reply({
        embeds: [embed]
      });
    }
    const targetMember = await resolveTargetMember(message, targetArguments);
    if (!targetMember) {
      const embed = economyEmbeds.giveInvalidTarget(message, targetArguments.join(' '));
      return message.reply({
        embeds: [embed]
      });
    }
    if (targetMember.id === message.author.id) {
      const embed = economyEmbeds.giveSelf(message);
      return message.reply({
        embeds: [embed]
      });
    }
    if (targetMember.user.bot) {
      const embed = economyEmbeds.giveBot(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const economyData = loadEconomy();
    const account = getAccount(
      economyData,
      message.guild.id,
      message.author.id,
      message.member
    );
    const targetAccount = getAccount(
      economyData,
      message.guild.id,
      targetMember.id,
      targetMember
    );
    let amount;
    if (requestedAmount === 'all') {
      amount = account.wallet;
    } else if (requestedAmount === 'half') {
      amount = Math.floor(account.wallet / 2);
    } else if (requestedAmount === 'quarter') {
      amount = Math.floor(account.wallet / 4);
    } else {
      amount = Number(requestedAmount);
    }
    if (!Number.isSafeInteger(amount)) {
      const embed = economyEmbeds.giveInvalidWholeNumber(message);
      return message.reply({
        embeds: [embed]
      });
    }
    if (account.wallet <= 0) {
      const embed = economyEmbeds.giveNoFunds(message, account.wallet);
      return message.reply({
        embeds: [embed]
      });
    }
    if (amount <= 0) {
      const embed = economyEmbeds.giveInvalidWholeNumber(message);
      return message.reply({
        embeds: [embed]
      });
    }
    if (amount > account.wallet) {
      const embed = economyEmbeds.giveInsufficientFunds(message, account.wallet);
      return message.reply({
        embeds: [embed]
      });
    }
    account.wallet -= amount;
    targetAccount.wallet += amount;
    incrementAchievementStatistic(account, 'gives');
    incrementAchievementStatistic(account, 'money_given', amount);
    setMaximumAchievementStatistic(account, 'largest_give', amount);
    incrementAchievementStatistic(targetAccount, 'transfers_received');
    incrementAchievementStatistic(targetAccount, 'money_received', amount);
    setMaximumAchievementStatistic(targetAccount, 'largest_transfer_received', amount);
    saveEconomy(economyData);
    const embed = economyEmbeds.giveSuccess(message, account, targetMember.user, amount);
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to give money:', error);
    return message.reply(formatError(error));
  }
}

async function slot(message, args) {
  try {
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const requestedAmount = args[0]?.toLowerCase();
    if (!requestedAmount || args.length !== 1) {
      const embed = economyEmbeds.slotInvalidArguments(message, !requestedAmount);
      return message.reply({
        embeds: [embed]
      });
    }
    let amount;
    if (requestedAmount === 'all') {
      amount = account.wallet;
    } else if (requestedAmount === 'half') {
      amount = Math.floor(account.wallet / 2);
    } else if (requestedAmount === 'quarter') {
      amount = Math.floor(account.wallet / 4);
    } else {
      const amountWithoutCommas = requestedAmount.replace(/,/g, '');
      if (!/^\d+$/.test(amountWithoutCommas)) {
        const embed = economyEmbeds.slotInvalidAmount(message, requestedAmount);
        return message.reply({
          embeds: [embed]
        });
      }
      amount = Number(amountWithoutCommas);
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      const embed = economyEmbeds.slotInvalidWholeNumber(message);
      return message.reply({
        embeds: [embed]
      });
    }
    if (amount > account.wallet) {
      const embed = economyEmbeds.slotInsufficientFunds(message, account.wallet);
      return message.reply({
        embeds: [embed]
      });
    }
    const outcome = getSlotOutcome();
    const won = outcome !== null;
    const payout = won ? Math.floor(amount * outcome.multiplier) : 0;
    const reels = won ? [outcome.emoji, outcome.emoji, outcome.emoji] : getLosingSlotReels();
    const topReels = getRandomSlotRow();
    const bottomReels = getRandomSlotRow();
    // take the bet and return the payout on a win \\
    account.wallet -= amount;
    account.wallet += payout;
    recordSlotResult(account, won, outcome, amount, payout);
    saveEconomy(economyData);
    const embed = economyEmbeds.slotResult(
      message,
      account,
      won,
      outcome,
      amount,
      payout,
      topReels,
      reels,
      bottomReels
    );
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to use slots:', error);
    return message.reply(formatError(error));
  }
}

async function roulette(message, args) {
  try {
    const currentGame = rouletteGames.get(message.guild.id);
    if (currentGame && Date.now() >= currentGame.endsAt) {
      await settleRouletteGame(currentGame);
    }
    if (args.length < 2) {
      const embed = economyEmbeds.rouletteInvalidArguments(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const requestedAmount = args[0].toLowerCase();
    const requestedSpace = args
      .slice(1)
      .filter((argument, index) => index !== 0 || argument.toLowerCase() !== 'on')
      .join(' ');
    let amount;
    if (requestedAmount === 'all') {
      amount = account.wallet;
    } else if (requestedAmount === 'half') {
      amount = Math.floor(account.wallet / 2);
    } else if (requestedAmount === 'quarter') {
      amount = Math.floor(account.wallet / 4);
    } else {
      const amountWithoutCommas = requestedAmount.replace(/,/g, '');
      if (!/^\d+$/.test(amountWithoutCommas)) {
        const embed = economyEmbeds.rouletteInvalidAmount(message, requestedAmount);
        return message.reply({
          embeds: [embed]
        });
      }
      amount = Number(amountWithoutCommas);
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      const embed = economyEmbeds.rouletteInvalidWholeNumber(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const rouletteSpace = normalizeRouletteSpace(requestedSpace);
    if (!rouletteSpace) {
      const embed = economyEmbeds.rouletteInvalidSpace(message, requestedSpace);
      return message.reply({
        embeds: [embed]
      });
    }
    if (amount > account.wallet) {
      const embed = economyEmbeds.rouletteInsufficientFunds(message, account.wallet);
      return message.reply({
        embeds: [embed]
      });
    }
    if (!Number.isSafeInteger(amount * rouletteSpace.multiplier)) {
      const embed = economyEmbeds.rouletteInvalidWholeNumber(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const bet = {
      ...rouletteSpace,
      userId: message.author.id,
      amount
    };
    account.wallet -= amount;
    saveEconomy(economyData);
    let game = rouletteGames.get(message.guild.id);
    const isNewGame = !game;
    if (!game) {
      game = {
        guildId: message.guild.id,
        bets: [],
        channels: new Map(),
        endsAt: 0,
        timer: null,
        helpCollector: null,
        achievementMessages: new Map(),
        settling: false
      };
      rouletteGames.set(message.guild.id, game);
    }
    if (!game.achievementMessages) {
      game.achievementMessages = new Map();
    }
    game.achievementMessages.set(message.author.id, message);
    game.bets.push(bet);
    game.channels.set(message.channel.id, message.channel);
    scheduleRouletteGame(game);
    const embed = economyEmbeds.rouletteBetPlaced(message, bet, isNewGame);
    const rouletteMessage = await message.reply({
      embeds: [embed],
      components: isNewGame ? [createRouletteHelpButton()] : []
    });
    if (isNewGame) {
      startRouletteHelpCollector(game, rouletteMessage);
    }
    return rouletteMessage;
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to place roulette bet:', error);
    return message.reply(formatError(error));
  }
}

async function showShop(message, args) {
  try {
    if (args.length > 0) {
      const embed = economyEmbeds.shopInvalidUsage(message);
      return message.reply({
        embeds: [embed]
      });
    }
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const shopItems = loadShopItems();
    let selectedCategory = 'all';
    let selectedPage = 0;
    saveEconomy(economyData);
    const components = createShopComponents(account, shopItems, selectedCategory, selectedPage);
    const shopMessage = await message.reply({
      components,
      flags: MessageFlags.IsComponentsV2
    });
    const collector = shopMessage.createMessageComponentCollector({
      time: shopConfig.buttonTimeoutMinutes * 60 * 1000
    });
    collector.on('collect', async (interaction) => {
      try {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({
            content: economyMessages.shopWrongUser(message.author.id),
            flags: MessageFlags.Ephemeral,
            allowedMentions: {
              parse: []
            }
          });
          return;
        }
        if (interaction.customId === 'economy_shop_category') {
          selectedCategory = interaction.values[0];
          selectedPage = 0;
          const categoryEconomyData = loadEconomy();
          const categoryAccount = getAccount(
            categoryEconomyData,
            message.guild.id,
            message.author.id,
            message.member
          );
          const categoryShopItems = loadShopItems();
          const categories = getShopCategories(categoryShopItems);
          if (selectedCategory !== 'all' && !categories.includes(selectedCategory)) {
            selectedCategory = 'all';
          }
          saveEconomy(categoryEconomyData);
          account.wallet = categoryAccount.wallet;
          account.ownedItems = [...categoryAccount.ownedItems];
          await interaction.update({
            components: createShopComponents(
              categoryAccount,
              categoryShopItems,
              selectedCategory,
              selectedPage
            )
          });
          return;
        }
        if (interaction.customId === shopButtonIds.page) {
          collector.resetTimer();
          const modalShopItems = loadShopItems();
          const modalTotalPages = getShopPageCount(modalShopItems, selectedCategory);
          const modalId = `economy_shop_page_modal:${interaction.id}`;
          const modalInteraction = await waitForPageModal(
            interaction,
            modalId,
            modalTotalPages
          );
          if (!modalInteraction) {
            return;
          }
          const pageEconomyData = loadEconomy();
          const pageAccount = getAccount(
            pageEconomyData,
            message.guild.id,
            message.author.id,
            message.member
          );
          const pageShopItems = loadShopItems();
          const categories = getShopCategories(pageShopItems);
          if (selectedCategory !== 'all' && !categories.includes(selectedCategory)) {
            selectedCategory = 'all';
          }
          const totalPages = getShopPageCount(pageShopItems, selectedCategory);
          const requestedPage = getPageFromModal(modalInteraction, totalPages);
          if (requestedPage === null) {
            await modalInteraction.reply({
              content: 'Please enter a whole page number.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          selectedPage = requestedPage;
          saveEconomy(pageEconomyData);
          account.wallet = pageAccount.wallet;
          account.ownedItems = [...pageAccount.ownedItems];
          await modalInteraction.update({
            components: createShopComponents(
              pageAccount,
              pageShopItems,
              selectedCategory,
              selectedPage
            )
          });
          return;
        }
        if (
          interaction.customId === shopButtonIds.first ||
          interaction.customId === shopButtonIds.previous ||
          interaction.customId === shopButtonIds.next ||
          interaction.customId === shopButtonIds.last
        ) {
          const pageEconomyData = loadEconomy();
          const pageAccount = getAccount(
            pageEconomyData,
            message.guild.id,
            message.author.id,
            message.member
          );
          const pageShopItems = loadShopItems();
          if (interaction.customId === shopButtonIds.first) {
            selectedPage = 0;
          } else if (interaction.customId === shopButtonIds.previous) {
            selectedPage -= 1;
          } else if (interaction.customId === shopButtonIds.next) {
            selectedPage += 1;
          } else {
            selectedPage = getShopPageCount(pageShopItems, selectedCategory) - 1;
          }
          selectedPage = clampShopPage(selectedPage, pageShopItems, selectedCategory);
          saveEconomy(pageEconomyData);
          account.wallet = pageAccount.wallet;
          account.ownedItems = [...pageAccount.ownedItems];
          await interaction.update({
            components: createShopComponents(
              pageAccount,
              pageShopItems,
              selectedCategory,
              selectedPage
            )
          });
          return;
        }
        if (!interaction.customId.startsWith('economy_shop_buy:')) {
          return;
        }
        const requestedItemId = interaction.customId.slice('economy_shop_buy:'.length);
        const updatedEconomyData = loadEconomy();
        const updatedAccount = getAccount(
          updatedEconomyData,
          message.guild.id,
          message.author.id,
          message.member
        );
        const updatedShopItems = loadShopItems();
        const item = updatedShopItems.find((shopItem) => shopItem.id === requestedItemId);
        if (!item) {
          await interaction.reply({
            content: 'That shop item is no longer available.',
            flags: MessageFlags.Ephemeral
          });
          return;
        }
        if (updatedAccount.ownedItems.includes(item.id)) {
          const alreadyOwnedEmbed = economyEmbeds.shopAlreadyOwned(message, item);
          await interaction.reply({
            embeds: [alreadyOwnedEmbed]
          });
          return;
        }
        if (updatedAccount.wallet < item.price) {
          const insufficientFundsEmbed = economyEmbeds.shopInsufficientFunds(
            message,
            updatedAccount,
            item
          );
          await interaction.reply({
            embeds: [insufficientFundsEmbed],
            flags: MessageFlags.Ephemeral
          });
          return;
        }
        await grantShopItemRole(message, item);
        updatedAccount.wallet -= item.price;
        updatedAccount.ownedItems.push(item.id);
        incrementAchievementStatistic(updatedAccount, 'shop_purchases');
        incrementAchievementStatistic(updatedAccount, 'shop_money_spent', item.price);
        setMaximumAchievementStatistic(updatedAccount, 'most_expensive_shop_purchase', item.price);
        saveEconomy(updatedEconomyData);
        account.wallet = updatedAccount.wallet;
        account.ownedItems = [...updatedAccount.ownedItems];
        await interaction.update({
          components: createShopComponents(
            updatedAccount,
            updatedShopItems,
            selectedCategory,
            selectedPage
          )
        });
        const purchaseEmbed = economyEmbeds.shopPurchaseSuccess(message, updatedAccount, item);
        await interaction.followUp({
          embeds: [purchaseEmbed]
        });
        await checkAndAnnounceAchievements(message);
      } catch (error) {
        console.error('[ECONOMY ERROR]: Failed to buy shop item:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              content: formatError(error),
              flags: MessageFlags.Ephemeral
            })
            .catch(() => {});
        }
      }
    });
    collector.on('end', async () => {
      await shopMessage
        .edit({
          components: createShopComponents(
            account,
            shopItems,
            selectedCategory,
            selectedPage,
            true
          )
        })
        .catch(() => {});
    });
    return shopMessage;
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to show shop:', error);
    return message.reply(formatError(error));
  }
}

async function showSettings(message, args) {
  try {
    const economyData = loadEconomy();
    const account = getAccount(economyData, message.guild.id, message.author.id, message.member);
    const settingName = args[0]?.toLowerCase();
    if (!settingName) {
      saveEconomy(economyData);
      const embed = economyEmbeds.settingsMenu(message, account);
      return message.reply({
        embeds: [embed]
      });
    }
    if (settingName !== 'color' && settingName !== 'colour') {
      const embed = economyEmbeds.settingsInvalidSetting(message, settingName);
      return message.reply({
        embeds: [embed]
      });
    }
    const requestedColor = args[1];
    if (!requestedColor) {
      const embed = economyEmbeds.settingsMissingColor(message);
      return message.reply({
        embeds: [embed]
      });
    }
    if (requestedColor.toLowerCase() === 'reset' || requestedColor.toLowerCase() === 'default') {
      account.settings.embedColor = defaultEmbedColor(message.member);
    } else {
      const normalizedColor = normalizeHexColor(requestedColor);
      if (!normalizedColor) {
        const embed = economyEmbeds.settingsInvalidColor(message, requestedColor);
        return message.reply({
          embeds: [embed]
        });
      }
      account.settings.embedColor = normalizedColor;
    }
    saveEconomy(economyData);
    const embed = economyEmbeds.settingsColorUpdated(message, account);
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to update settings:', error);
    return message.reply(formatError(error));
  }
}

function getAdminCommand(commandName, args) {
  for (const [action, aliases] of adminMoneyAliases) {
    if (aliases.has(commandName)) {
      return { type: 'money', action, args };
    }
  }
  const subcommand = args[0]?.toLowerCase();
  if (statsAliases.has(commandName) && adminStatisticActions.has(subcommand)) {
    return { type: 'stats', action: adminStatisticActions.get(subcommand), args: args.slice(1) };
  }
  if (achievementAliases.has(commandName) && adminAchievementActions.has(subcommand)) {
    return { type: 'achievements', action: adminAchievementActions.get(subcommand), args: args.slice(1) };
  }
  if (resetCooldownAliases.has(commandName)) {
    return { type: 'cooldown', args };
  }
  if (adminHelpAliases.has(commandName)) {
    return { type: 'help', args };
  }
  return null;
}

function logAdminCommand(message, status, details = {}) {
  const entry = {
    time: new Date().toISOString(),
    userId: message.author.id,
    username: message.author.username,
    guildId: message.guild.id,
    channelId: message.channelId || message.channel?.id,
    command: message.content,
    ...details
  };
  // JSON keeps user-supplied newlines and terminal control characters escaped.
  const line = `[ECONOMY ADMIN ${status}]: ${JSON.stringify(entry)}`;
  if (status === 'DENIED' || status === 'ERROR') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

async function replyAdmin(message, description, failed = false, title = 'RolfBot Admin') {
  let color = defaultEmbedColor(message.member);
  if (!failed) {
    const economyData = loadEconomy();
    const savedColor = economyData.guilds[message.guild.id]?.users?.[message.author.id]?.settings?.embedColor;
    color = normalizeHexColor(savedColor) || color;
  }
  const embed = createEconomyEmbed(message, failed ? failEmbedColor : color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
  return message.reply({
    embeds: [embed],
    allowedMentions: { parse: [], repliedUser: false }
  });
}

async function replyAdminList(message, title, lines) {
  const pages = [];
  let page = '';
  for (const line of lines) {
    if (page && page.length + line.length + 1 > 3800) {
      pages.push(page);
      page = '';
    }
    page += `${page ? '\n' : ''}${line}`;
  }
  pages.push(page || 'No entries found.');
  for (let index = 0; index < pages.length; index += 1) {
    const pageTitle = pages.length > 1 ? `${title} (${index + 1}/${pages.length})` : title;
    await replyAdmin(message, pages[index], false, pageTitle);
  }
}

function adminInvalidUsage(message, usage) {
  return replyAdmin(message, `${adminMessages.invalidUsage}\n${usage}`, true);
}

async function resolveAdminMember(message, args, usage) {
  const member = await resolveTargetMember(message, args);
  if (!member) {
    await replyAdmin(message, `${adminMessages.invalidTarget}\n${usage}`, true);
  }
  return member;
}

function parseAdminNumber(input) {
  if (typeof input !== 'string' || !/^\d+$/.test(input)) {
    return null;
  }
  const value = Number(input);
  return Number.isSafeInteger(value) ? value : null;
}

async function saveAdminChange(message, economyData, description, details) {
  saveEconomy(economyData);
  logAdminCommand(message, 'UPDATED', details);
  try {
    await replyAdmin(message, description);
  } catch (error) {
    logAdminCommand(message, 'ERROR', {
      ...details,
      saved: true,
      note: adminMessages.savedReplyFailed,
      error: String(error?.message || error)
    });
  }
}

async function editAdminMoney(message, action, args) {
  const usage = adminUsage[action];
  if (args.length < 3) {
    return adminInvalidUsage(message, usage);
  }
  const requestedPocket = args.at(-1).toLowerCase();
  const pocket = requestedPocket === 'cash' ? 'wallet' : requestedPocket;
  if (pocket !== 'wallet' && pocket !== 'bank') {
    return adminInvalidUsage(message, usage);
  }
  const amount = parseAdminNumber(args.at(-2));
  if (amount === null || (action !== 'set' && amount === 0)) {
    return replyAdmin(message, `${adminMessages.invalidAmount}\n${usage}`, true);
  }
  const target = await resolveAdminMember(message, args.slice(0, -2), usage);
  if (!target) {
    return;
  }
  // Read after member lookup, so a pending fetch cannot overwrite newer balances.
  const economyData = loadEconomy();
  const account = getAccount(economyData, message.guild.id, target.id, target);
  const previous = account[pocket];
  const next = action === 'set' ? amount : action === 'add' ? previous + amount : previous - amount;
  const otherBalance = account[pocket === 'wallet' ? 'bank' : 'wallet'];
  if (
    (action !== 'set' && !Number.isSafeInteger(previous)) ||
    !Number.isSafeInteger(next) || next < 0 ||
    !Number.isSafeInteger(otherBalance) ||
    !Number.isSafeInteger(next + otherBalance)
  ) {
    return replyAdmin(message, adminMessages.invalidBalance, true);
  }
  account[pocket] = next;
  return saveAdminChange(message, economyData, adminMessages.moneyUpdated(target.id, pocket, previous, next), {
    targetId: target.id, action, pocket, amount, before: previous, after: next
  });
}

async function editAdminStatistics(message, action, args) {
  if (action === 'list') {
    if (args.length > 0) {
      return adminInvalidUsage(message, adminUsage.statsList);
    }
    return replyAdminList(message, 'Statistic names', [
      ...Array.from(adminStatisticNames, (name) => `\`${name}\``),
      '',
      'The two success timestamps use Unix time in milliseconds. `platinum_loss_sequence_active` accepts 0 or 1.'
    ]);
  }
  const resetting = action === 'reset';
  const usage = resetting ? adminUsage.statsReset : adminUsage.stats;
  const trailingArguments = resetting ? 1 : 2;
  if (args.length < trailingArguments + 1) {
    return adminInvalidUsage(message, usage);
  }
  const statisticName = args.at(-trailingArguments).toLowerCase();
  const resetAll = resetting && statisticName === 'all';
  if (!resetAll && !adminStatisticNames.has(statisticName)) {
    return replyAdmin(message, adminMessages.invalidStatistic, true);
  }
  const amount = resetting ? 0 : parseAdminNumber(args.at(-1));
  if (amount === null || ((action === 'add' || action === 'remove') && amount === 0)) {
    return replyAdmin(message, `${adminMessages.invalidAmount}\n${usage}`, true);
  }
  const target = await resolveAdminMember(message, args.slice(0, -trailingArguments), usage);
  if (!target) {
    return;
  }
  const economyData = loadEconomy();
  const account = getAccount(economyData, message.guild.id, target.id, target);
  if (resetAll) {
    const previous = { ...account.achievementStats };
    account.achievementStats = {};
    return saveAdminChange(message, economyData, adminMessages.statisticsReset(target.id), {
      targetId: target.id, action: 'stats-reset', statistic: 'all', before: previous, after: {}
    });
  }
  const previous = account.achievementStats[statisticName] || 0;
  const next = action === 'add' ? previous + amount : action === 'remove' ? previous - amount : amount;
  if (!Number.isSafeInteger(next) || next < 0 || (statisticName === 'platinum_loss_sequence_active' && next > 1)) {
    return replyAdmin(message, adminMessages.invalidStatisticValue, true);
  }
  account.achievementStats[statisticName] = next;
  return saveAdminChange(message, economyData, adminMessages.statisticUpdated(target.id, statisticName, previous, next), {
    targetId: target.id, action: `stats-${action}`, statistic: statisticName, before: previous, after: next
  });
}

async function editAdminAchievements(message, action, args) {
  if (action === 'list') {
    if (args.length > 0) {
      return adminInvalidUsage(message, adminUsage.achievementList);
    }
    return replyAdminList(message, 'Achievement IDs', loadAchievements().map((achievement) =>
      `\`${achievement.id}\` - ${achievement.name}${achievement.hidden ? ' (hidden)' : ''}`
    ));
  }
  if (args.length < 2) {
    return adminInvalidUsage(message, adminUsage.achievements);
  }
  const target = await resolveAdminMember(message, args.slice(0, -1), adminUsage.achievements);
  if (!target) {
    return;
  }
  const achievements = loadAchievements();
  const economyData = loadEconomy();
  const account = getAccount(economyData, message.guild.id, target.id, target);
  const knownIds = new Set(achievements.map((achievement) => achievement.id));
  if (action !== 'grant') {
    for (const id of [...account.achievements, ...account.revokedAchievements]) {
      knownIds.add(id);
    }
  }
  const requestedId = args.at(-1).toLowerCase();
  const matchedId = [...knownIds].find((id) => id.toLowerCase() === requestedId);
  if (requestedId !== 'all' && !matchedId) {
    return replyAdmin(message, adminMessages.invalidAchievement, true);
  }
  const selectedIds = requestedId === 'all' ? [...knownIds] : [matchedId];
  if (selectedIds.length === 0) {
    return replyAdmin(message, adminMessages.noAchievements, true);
  }
  const before = {
    unlocked: [...account.achievements],
    revoked: [...account.revokedAchievements]
  };
  const unlockedIds = new Set(account.achievements);
  const revokedIds = new Set(account.revokedAchievements);
  for (const id of selectedIds) {
    if (action === 'grant') {
      unlockedIds.add(id);
      revokedIds.delete(id);
    } else if (action === 'revoke') {
      unlockedIds.delete(id);
      revokedIds.add(id);
    } else {
      revokedIds.delete(id);
    }
  }
  account.achievements = [...unlockedIds];
  account.revokedAchievements = [...revokedIds];
  return saveAdminChange(message, economyData, adminMessages.achievementsUpdated(target.id, action, selectedIds), {
    targetId: target.id,
    action: `achievements-${action}`,
    achievementIds: selectedIds,
    before,
    after: { unlocked: account.achievements, revoked: account.revokedAchievements }
  });
}

async function resetAdminCooldowns(message, args) {
  if (args.length < 2) {
    return adminInvalidUsage(message, adminUsage.cooldown);
  }
  const requestedCommand = args.at(-1).toLowerCase();
  const commandKey = getEconomyCommandKey(requestedCommand);
  if (requestedCommand !== 'all' && !adminCooldownFields.has(commandKey)) {
    return replyAdmin(message, adminMessages.invalidCooldown, true);
  }
  const target = await resolveAdminMember(message, args.slice(0, -1), adminUsage.cooldown);
  if (!target) {
    return;
  }
  const economyData = loadEconomy();
  const account = getAccount(economyData, message.guild.id, target.id, target);
  const commands = requestedCommand === 'all' ? [...adminCooldownFields.keys()] : [commandKey];
  const before = {};
  for (const command of commands) {
    const field = adminCooldownFields.get(command);
    before[field] = account[field];
    account[field] = 0;
  }
  if (commands.includes('collect')) {
    before.incomeRoleClaimsDate = account.incomeRoleClaimsDate;
    before.collectedIncomeRoleIds = [...account.collectedIncomeRoleIds];
    account.incomeRoleClaimsDate = '';
    account.collectedIncomeRoleIds = [];
  }
  await saveAdminChange(message, economyData, adminMessages.cooldownsReset(target.id, commands), {
    targetId: target.id, action: 'reset-cooldown', commands, before
  });
  const prefix = `${message.guild.id}:${target.id}:`;
  for (const key of commandCooldowns.keys()) {
    if (key.startsWith(prefix) && (requestedCommand === 'all' || key === `${prefix}${commandKey}`)) {
      commandCooldowns.delete(key);
    }
  }
}

async function showAdminHelp(message, args) {
  if (args.length > 0) {
    return adminInvalidUsage(message, adminUsage.help);
  }
  return replyAdminList(message, 'RolfBot Admin Commands', [
    '**Money**',
    ...['add', 'remove', 'set'].map((action) => `${adminUsage[action]}\nAliases: ${formatAliases(adminMoneyAliases.get(action))}`),
    'wallet | bank. use only whole numbers. only `set-money` accepts `0`',
    '',
    '**Statistics**',
    adminUsage.stats,
    '`edit`/`set` replaces a value. `add` and `remove` change it by the given amount.',
    adminUsage.statsReset,
    `${adminUsage.statsList} - show every supported statistic name.`,
    'the usual stats aliases all work.',
    adminMessages.statsNote,
    '',
    '**Achievements**',
    adminUsage.achievements,
    `${adminUsage.achievementList} - show enabled achievement_ids, including hidden achievements.`,
    '`grant`/`give` unlocks; `revoke`/`remove` keeps it locked; `auto` allows normal unlocking again.',
    'use an id or `all`. normal achievement command aliases also work.',
    `${adminMessages.grantNote} revoking keeps existing rewards. previously paid rewards are not paid twice`,
    '',
    '**Cooldowns**',
    adminUsage.cooldown,
    `Aliases: ${formatAliases(resetCooldownAliases)}`,
    'resetting collect also clears today\'s income-role claims. all also clears repeated command cooldowns',
    '',
    'targets can be an @mention, a userID, or an exact username / display name.',
    'only the userID stored as a string in config.json ownerId can use these commands. denied attempts and saved changes are logged in the terminal'
  ]);
}

async function runAdminCommand(message, command) {
  switch (command.type) {
    case 'money':
      return editAdminMoney(message, command.action, command.args);
    case 'stats':
      return editAdminStatistics(message, command.action, command.args);
    case 'achievements':
      return editAdminAchievements(message, command.action, command.args);
    case 'cooldown':
      return resetAdminCooldowns(message, command.args);
    case 'help':
      return showAdminHelp(message, command.args);
  }
}

async function completeEconomyCommand(message, action) {
  await action();
  await checkAndAnnounceAchievements(message);
  return true;
}

async function removeDepartedEconomyUser(guild, userId) {
  if (guild.available === false || !guild.client.isReady()) return;
  // Let active roulette bets finish before removing their accounts.
  if (rouletteGames.get(guild.id)?.bets.some((bet) => bet.userId === userId)) return;
  try {
    await guild.members.fetch({ user: userId, force: true, cache: false });
    return;
  } catch (error) {
    // Missing permissions, timeouts and connection errors are not proof of departure.
    if (Number(error.code) !== 10007) throw error;
  }
  if (guild.available === false || !guild.client.isReady()) return;
  if (rouletteGames.get(guild.id)?.bets.some((bet) => bet.userId === userId)) return;
  // Reload after the network request so concurrent commands' changes are preserved.
  const data = loadEconomy();
  const users = data.guilds[guild.id]?.users;
  if (!users || !Object.prototype.hasOwnProperty.call(users, userId)) return;
  const backup = JSON.stringify({
    removedAt: new Date().toISOString(), guildId: guild.id, userId, account: users[userId]
  });
  // A failed backup aborts deletion. Entries can be restored manually if needed.
  fs.appendFileSync(path.join(__dirname, 'economy_removed_users.jsonl'), backup + '\n');
  delete users[userId];
  saveEconomy(data);
  console.log(`[ECONOMY CLEANUP]: Removed ${userId} from guild ${guild.id}; account backed up.`);
}

async function cleanupDepartedEconomyUsers(client) {
  if (!client.isReady()) return;
  for (const guild of client.guilds.cache.values()) {
    if (guild.available === false || economyCleanupRunning.has(guild.id)) continue;
    economyCleanupRunning.add(guild.id);
    try {
      const userIds = Object.keys(loadEconomy().guilds[guild.id]?.users || {});
      if (userIds.length === 0) continue;
      const members = await guild.members.fetch();
      for (const userId of userIds) {
        if (!members.has(userId)) await removeDepartedEconomyUser(guild, userId);
      }
    } catch (error) {
      console.error(`[ECONOMY CLEANUP]: Skipped guild ${guild.id}:`, error);
    } finally {
      economyCleanupRunning.delete(guild.id);
    }
  }
}

function initializeEconomyCleanup(client) {
  if (!client || economyCleanupClients.has(client)) return;
  economyCleanupClients.add(client);
  const run = () => {
    cleanupDepartedEconomyUsers(client).catch((error) => {
      console.error('[ECONOMY CLEANUP]: Cleanup failed:', error);
    });
  };
  client.on('guildMemberRemove', (member) => {
    removeDepartedEconomyUser(member.guild, member.id).catch((error) => {
      console.error('[ECONOMY CLEANUP]: Could not check departed member:', error);
    });
  });
  const timer = setInterval(run, economyCleanupIntervalMilliseconds);
  timer.unref?.();
  // This module receives the client on its first message; no index.js changes needed.
  setImmediate(run);
}

async function handleEconomyCommand(message) {
  initializeEconomyCleanup(message.client);
  if (message.author.bot || !message.guild || !message.content.startsWith(commandPrefix)) {
    return false;
  }
  const commandParts = message.content.slice(commandPrefix.length).trim().split(/\s+/);
  const commandName = commandParts.shift()?.toLowerCase();
  const adminCommand = getAdminCommand(commandName, commandParts);
  if (adminCommand) {
    // Check ownership before any cooldown reply, account write, or achievement check.
    if (typeof config.ownerId !== 'string' || message.author.id !== config.ownerId) {
      logAdminCommand(message, 'DENIED');
      return true;
    }
    try {
      await runAdminCommand(message, adminCommand);
    } catch (error) {
      logAdminCommand(message, 'ERROR', { error: String(error?.stack || error) });
      await replyAdmin(message, adminMessages.unexpectedError, true).catch(() => {});
    }
    return true;
  }
  const commandKey = getEconomyCommandKey(commandName);
  if (!commandKey) {
    return false;
  }
  const remainingCooldown = useCommandRepeatCooldown(message, commandKey);
  if (remainingCooldown > 0) {
    const embed = economyEmbeds.commandRepeatCooldown(
      message,
      commandKey,
      remainingCooldown
    );
    await message.reply({
      embeds: [embed]
    });
    return true;
  }
  if (balanceAliases.has(commandName)) {
    return completeEconomyCommand(message, () => showBalance(message));
  }
  if (levelAliases.has(commandName)) {
    return completeEconomyCommand(message, () => showLevel(message, commandParts));
  }
  if (leaderboardAliases.has(commandName)) {
    return completeEconomyCommand(message, () => showLeaderboard(message, commandParts));
  }
  if (workAliases.has(commandName)) {
    return completeEconomyCommand(message, () => work(message));
  }
  if (collectAliases.has(commandName)) {
    return completeEconomyCommand(message, () => collectDailyIncome(message, commandParts));
  }
  if (crimeAliases.has(commandName)) {
    return completeEconomyCommand(message, () => crime(message));
  }
  if (robAliases.has(commandName)) {
    return completeEconomyCommand(message, () => rob(message, commandParts));
  }
  if (begAliases.has(commandName)) {
    return completeEconomyCommand(message, () => beg(message));
  }
  if (slotAliases.has(commandName)) {
    return completeEconomyCommand(message, () => slot(message, commandParts));
  }
  if (rouletteAliases.has(commandName)) {
    return completeEconomyCommand(message, () => roulette(message, commandParts));
  }
  if (shopAliases.has(commandName)) {
    return completeEconomyCommand(message, () => showShop(message, commandParts));
  }
  if (achievementAliases.has(commandName)) {
    await checkAndAnnounceAchievements(message);
    await showAchievements(message, commandParts);
    return true;
  }
  if (cooldownAliases.has(commandName)) {
    return completeEconomyCommand(message, () => showCooldowns(message, commandParts));
  }
  if (statsAliases.has(commandName)) {
    return completeEconomyCommand(message, () => showStats(message, commandParts));
  }
  if (settingsAliases.has(commandName)) {
    return completeEconomyCommand(message, () => showSettings(message, commandParts));
  }
  if (colorAliases.has(commandName)) {
    return completeEconomyCommand(message, () =>
      showSettings(message, ['color', ...commandParts])
    );
  }
  if (giveAliases.has(commandName)) {
    return completeEconomyCommand(message, () => giveMoney(message, commandParts));
  }
  if (depositAliases.has(commandName)) {
    return completeEconomyCommand(message, () => deposit(message, commandParts));
  }
  if (withdrawAliases.has(commandName)) {
    return completeEconomyCommand(message, () => withdraw(message, commandParts));
  }
  if (helpAliases.has(commandName)) {
    return completeEconomyCommand(message, () => showHelp(message));
  }
  return false;
}

function getUserEmbedColor(guildId, userId, member) {
  try {
    const economyData = loadEconomy();
    const account = getAccount(economyData, guildId, userId, member);
    saveEconomy(economyData);
    return account.settings.embedColor;
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to get user embed color:', error);
    return defaultEmbedColor(member);
  }
}

module.exports = {
  handleEconomyCommand,
  getUserEmbedColor,
  getLevelEmbed,
  formatXp,
  showLevelLeaderboard
};