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
  work_cooldown: workCdResponses,
  crime_success: crimeWinResponses,
  crime_fail: crimeFailResponses,
  crime_cooldown: crimeCdResponses,
  beg_success: begResponses,
  beg_cooldown: begCdResponses
} = require('./economy_responses.json');

const economyFile = path.join(__dirname, 'economy.json');
const shopItemsFile = path.join(__dirname, 'shop_items.json');
const achievementsFile = path.join(__dirname, 'achievements.json');
const commandPrefix = '?';
const failEmbedColor = '#ff5050';
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const repeatCdMs = 500;
const cmdCooldowns = new Map();
const cleanupClients = new WeakSet();
const cleanupRunning = new Set();
const cleanupIntervalMs = 60 * 60 * 1000;

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

const incomeTz = 'Europe/Berlin';

const incomeDateFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: incomeTz,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

const lbConfig = {
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

const achConfig = {
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

const robImmunityItemId = 'robbing_immunity';
const robImmunityRoleId = '1536497693550190602';
const staatsfeindItemId = 'staatsfeind';
const staatsfeindRoleId = '1545443722613756004';
const income1000ItemId = 'income_1000';
const income1000RoleId = '1533228759262560256';
const staatsfeindSuccessChanceBoost = 25;

const shopRoleIds = new Map([
  [robImmunityItemId, robImmunityRoleId],
  [staatsfeindItemId, staatsfeindRoleId],
  [income1000ItemId, income1000RoleId],
]);

const dailyIncomeRoles = new Map([
  [income1000RoleId, 1000],
  ['1533921404037238784', 500], // early member
  ['1532385051898155138', 2500] // booster
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
const begAliases = new Set(['beg']);
const collectAliases = new Set(['collect', 'daily', 'claim']);
const slotAliases = new Set(['slot', 'slots', 's']);
const rouletteAliases = new Set(['roulette', 'roulete', 'roul', 'rlt', 'r']);
const leaderboardAliases = new Set(['lb', 'leaderboard', 'lboard', 'top']);
const shopAliases = new Set(['shop', 'store']);
const achievementAliases = new Set(['achievements', 'achievement', 'ach', 'achs', 'advancements']);
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
  ['bank', 'bank'],
  ['debt', 'debt'],
  ['debts', 'debt'],
  ...statisticNames.map(name => [name, name])
]);

const settingsAliases = new Set(['settings', 'setting', 'options', 'option']);
const badgeAliases = new Set(['badges']);
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
  ['badges', badgeAliases],
  ['color', colorAliases],
  ['deposit', depositAliases],
  ['withdraw', withdrawAliases],
  ['give', giveAliases],
  ['help', helpAliases]
]);

const currencyEmoji = '<:DDR_mark:1532733538565226546>';
const currencyEmojiId = '1532733538565226546';
const stopwatchEmoji = '<:RolfBot_stopwatch:1544698730639261748>';

const commandUsage = {
  balance: '`?balance [ @mention | username | userID ]`',
  deposit: '`?deposit [ amount | all | half | quarter | debt ]`',
  withdraw: '`?withdraw [ amount | all | half | quarter | debt ]`',
  give: '`?give [ @mention | username | userID ] [ amount | all | half | quarter ]`',
  work: '`?work`',
  crime: '`?crime`',
  rob: '`?rob [ @mention | username | userID ]`',
  beg: '`?beg`',
  collect: '`?collect`',
  slots: '`?slots [ amount | all | half | quarter ]`',
  roulette: '`?roulette [ amount | all | half | quarter ] [ space ]`',
  leaderboard: '`?leaderboard [ total | wallet | bank | debt | level | stat | list ]`',
  shop: '`?shop`',
  achievements: '`?achievements`',
  stats: '`?stats`',
  cooldowns: '`?cooldowns`',
  level: '`?level`',
  settings: '`?settings [ badges | color ]`',
  color: '`?color [ reset | #HEXHEX ]`',
  colorHex: '`?color #HEXHEX`',
  badges: '?badges',
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

  statisticUpdated(userId, statName, previous, next) {
    return `<@${userId}> - \`${statName}\`\n${formatStatisticValue(statName, previous)} -> ${formatStatisticValue(statName, next)}\n\n${this.statsNote}`;
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
    'Join the current roulette game or start a new one.',
    aliases: rouletteAliases
  },
  {
    usage: commandUsage.leaderboard,
    description: 'View users by total, wallet, bank, debt, or any tracked statistic.',
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
  unexpectedError(errorMessage, message) {
    return (
      `\`${errorMessage}\`\n` + 'Error! Please report this to ales.js ' + `(${message ? userMention(message, '1044985132777480253') : '<@1044985132777480253>'})`
    );
  },

  leaderboardWrongUser(userId, message) {
    return `only ${userMention(message, userId)} can use these ` + 'leaderboard buttons.';
  },

  helpWrongUser(userId, message) {
    return `only ${userMention(message, userId)} can use these help buttons.`;
  },

  shopWrongUser(userId, message) {
    return `only ${userMention(message, userId)} can use these shop buttons.`;
  },

  achievementsWrongUser(userId, message) {
    return `only ${userMention(message, userId)} can use these achievement buttons.`;
  },

  statsWrongUser(userId, message) {
    return `only ${userMention(message, userId)} can use these statistics buttons.`;
  }
};

const lbText = {
  categoryNames: {
    total: 'Total Money',
    wallet: 'Wallet',
    bank: 'Bank',
    debt: 'Debt'
  },
  emptyLeaderboard: 'err empty db'
};

const lbButtonIds = {
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

const achButtonIds = {
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

function getEconomyCommandKey(cmdName) {
  for (const [cmdKey, aliases] of commandAliasGroups) {
    if (aliases.has(cmdName)) {
      return cmdKey;
    }
  }
  return null;
}

function useCommandRepeatCooldown(message, cmdKey) {
  const cooldownKey = `${message.guild.id}:${message.author.id}:${cmdKey}`;
  const now = Date.now();
  const cdEndsAt = cmdCooldowns.get(cooldownKey) || 0;
  if (now < cdEndsAt) {
    return cdEndsAt - now;
  }
  const nextCdEnd = now + repeatCdMs;
  cmdCooldowns.set(cooldownKey, nextCdEnd);
  const cleanupTimeout = setTimeout(() => {
    if (cmdCooldowns.get(cooldownKey) === nextCdEnd) {
      cmdCooldowns.delete(cooldownKey);
    }
  }, repeatCdMs);
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
  const reqPage = interaction.fields.getTextInputValue('page_number').trim();
  if (!/^-?\d+$/.test(reqPage)) {
    return null;
  }
  const pageNumber = BigInt(reqPage);
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
    lbButtonIds,
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
    achButtonIds,
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

function getShopItemsForCategory(shopItems, selectedCat) {
  return selectedCat === 'all'
    ? shopItems
    : shopItems.filter((item) => item.category === selectedCat);
}

function getShopPageCount(shopItems, selectedCat) {
  const visibleItems = getShopItemsForCategory(shopItems, selectedCat);
  return Math.max(1, Math.ceil(visibleItems.length / shopConfig.itemsPerPage));
}

function clampShopPage(page, shopItems, selectedCat) {
  return Math.min(Math.max(page, 0), getShopPageCount(shopItems, selectedCat) - 1);
}

function createShopCategoryMenu(shopItems, selectedCat, disableAll = false) {
  const categories = getShopCategories(shopItems);
  const menu = new StringSelectMenuBuilder()
    .setCustomId('economy_shop_category')
    .setPlaceholder(selectedCat === 'all' ? 'All Categories' : selectedCat)
    .setDisabled(disableAll)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('All Categories')
        .setValue('all')
        .setDefault(selectedCat === 'all'),
      ...categories.map((category) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(category)
          .setValue(category)
          .setDefault(selectedCat === category)
      )
    );
  return new ActionRowBuilder().addComponents(menu);
}

function createShopComponents(
  account,
  shopItems,
  selectedCat = 'all',
  page = 0,
  disableAll = false
) {
  const visibleItems = getShopItemsForCategory(shopItems, selectedCat);
  const totalPages = getShopPageCount(shopItems, selectedCat);
  const currentPage = clampShopPage(page, shopItems, selectedCat);
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
    createShopCategoryMenu(shopItems, selectedCat, disableAll)
  ];
  if (totalPages > 1) {
    components.push(createShopButtons(currentPage, totalPages, disableAll));
  }
  return components;
}

function addMentionBadges(text, guildId) {
  if (!guildId || !/<@!?\d+>/.test(text)) return text;
  try {
    if (!fs.existsSync(economyFile) || !fs.existsSync(achievementsFile)) return text;
    const users = JSON.parse(readJsonText(economyFile)).guilds?.[guildId]?.users || {};
    const achievements = loadAchievements();
    return text.replace(/<@!?(\d+)>/g, (mention, userId, offset) => {
      const badges = getLeaderboardBadges(users[userId], achievements);
      if (!badges || text.slice(0, offset).endsWith(`${badges} `)) return mention;
      return `${badges} ${mention}`;
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to load mention badges:', error);
    return text;
  }
}

function userMention(message, userId) {
  return addMentionBadges(`<@${userId}>`, message.guild?.id || message.guildId);
}

function createEconomyEmbed(message, color, author = message.author) {
  let badges = '';
  try {
    const guildId = message.guild?.id || message.guildId;
    if (guildId && fs.existsSync(economyFile) && fs.existsSync(achievementsFile)) {
      const data = JSON.parse(readJsonText(economyFile));
      const account = data.guilds?.[guildId]?.users?.[author.id];
      badges = getLeaderboardBadges(account, loadAchievements())
        .replace(/<a?:([A-Za-z0-9_]+):[0-9]+>/g, ' :$1: ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to load author badges:', error);
  }
  const name = badges ? `${badges} ${author.username}` : author.username;
  let authorName = '';
  for (const char of name) {
    if (authorName.length + char.length > 256) break;
    authorName += char;
  }
  return new EmbedBuilder().setColor(color).setAuthor({
    name: authorName,
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

function formatStatisticName(statName) {
  if (extraStats.has(statName)) return extraStats.get(statName).label;
  const words = statName.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function isMoneyStatistic(statName) {
  if (extraStats.has(statName)) return extraStats.get(statName).type === 'money';
  return (
    statName.startsWith('money_') ||
    statName.startsWith('largest_') ||
    statName === 'slots_wagered' ||
    statName === 'slots_payouts' ||
    statName === 'roulette_wagered' ||
    statName === 'roulette_payouts' ||
    statName === 'shop_money_spent' ||
    statName === 'most_expensive_shop_purchase'
  );
}

function formatStatisticValue(statName, value) {
  const def = extraStats.get(statName);
  if (def?.type === 'rank' && !value) return '**—**';
  if (def?.type === 'percent') return `**${statDecimals.format(value)}%**`;
  const formattedValue = def ? statDecimals.format(value) : formatMoney(value);
  return isMoneyStatistic(statName)
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
  const startIndex = currentPage * achConfig.achievementsPerPage;
  const pageAchievements = achievements.slice(
    startIndex,
    startIndex + achConfig.achievementsPerPage
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
          'view and manage your badges with `?badges`',
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
         `### ${achievement.badge} **${achievement.name}**`,
          `> **${achievement.description}**`,
          title,
          ...(achievement.rewards.money > 0 || achievement.rewards.xp > 0
            ? [`> -# 🎁 ${formatAchievementRewards(achievement)}`]
            : []),
          `> -# 👥 **Achieved by ${percentageText}%**`,
          ...(achievement.difficulty
            ? [`> -# ${achievement.difficultyEmoji ? `${achievement.difficultyEmoji} ` : ''}**${achievement.difficulty}**`]
            : []),
          ...(achievement.badge
            ? [`> -# 💠 **Badge**`]
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

  commandRepeatCooldown(message, cmdKey, remainingMilliseconds) {
    const remainingSeconds = Math.ceil(remainingMilliseconds / 100) / 10;
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      `You're using \`?${cmdKey}\` too quickly. ` +
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
        commandUsage.leaderboard,
        'Use `?lb list` to see every category.'
      ].join('\n')
    );
  },

  leaderboard(message, account, entries, category, currentPage, totalPages) {
    const categoryName = category === 'level' ? 'Level' :
      lbText.categoryNames[category] || formatStatisticName(category);
    const startIndex = currentPage * lbConfig.usersPerPage;
    const pageEntries = entries.slice(startIndex, startIndex + lbConfig.usersPerPage);
    const description =
      pageEntries.length > 0
        ? pageEntries
            .map((entry, index) => {
              const rank = startIndex + index + 1;
              const youMarker = entry.userId === message.author.id ? ' <- you!' : '';
              const badgePrefix = entry.badges ? `${entry.badges} ` : '';
              if (category === 'level') {
                return `**${rank}.** ${badgePrefix}<@${entry.userId}> · \`Lv. ${entry.level}\` · \`${formatXp(entry.xp)} XP\`${youMarker}`;
              }
              if (statisticNames.includes(category)) {
                return `**${rank}.** ${badgePrefix}<@${entry.userId}> · ${formatStatisticValue(category, entry.value)}${youMarker}`;
              }
              return (
                `**${rank}.** ${badgePrefix}<@${entry.userId}>` +
                `${currencyEmoji}` +
                `**${formatMoney(entry.value)}** ${youMarker}`
              );
            })
            .join('\n')
        : category === 'level'
          ? 'No XP data yet.'
          : category === 'debt'
            ? 'Nobody is currently in debt.'
            : lbText.emptyLeaderboard;
    const yourRank = entries.findIndex((entry) => entry.userId === message.author.id) + 1;
    return createEconomyEmbed(message, account.settings.embedColor)
      .setTitle(`${categoryName} Leaderboard`)
      .setDescription(description)
      .setFooter({
        text:
          `Page ${currentPage + 1}/${totalPages} • ` +
          `${entries.length} users • Your rank: ${yourRank === 0 ? 'Unranked' : yourRank}`
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
      .map((statName) => {
        const value = account.achievementStats[statName] || 0;
        return `${formatStatisticName(statName)}: ${formatStatisticValue(
          statName,
          value
        )}`;
      })
      .join('\n');
    return createEconomyEmbed(message, account.settings.embedColor)
      .setTitle('RolfBot Statistics')
      .setDescription(`${description}`)
      .setFooter({
        text:
          `Page ${currentPage + 1}/${totalPages} • ` +
          `${statisticNames.length} statistics`
      })
      .setTimestamp();
  },

  achievements(message, account, achievements, currentPage, totalPages) {
    const startIndex = currentPage * achConfig.achievementsPerPage;
    const pageAchievements = achievements.slice(
      startIndex,
      startIndex + achConfig.achievementsPerPage
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
      `${userMention(message, target.id)} has Robbing Immunity and can't be robbed. you can buy this aswell using \`?shop\`!`
    );
  },

  robEmptyWallet(message, target) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      `${userMention(message, target.id)} is too broke and doesn't have any money in their wallet to rob.`
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
        `You successfully robbed ${userMention(message, target.id)} and stole ` +
          `${currencyEmoji}**${formatMoney(stolenMoney)}**`
      )
      .setTimestamp();
  },

  robFail(message, target, fine) {
    return createEconomyEmbed(message, failEmbedColor)
      .setDescription(
        `You were caught trying to rob ${userMention(message, target.id)} and were fined ` +
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

  depositNoDebt(message, bank) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        "you don't have any debt in your bank to clear.",
        `**Bank:** ${currencyEmoji}${formatMoney(bank)}`
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

  withdrawNoDebt(message, wallet) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        "you don't have any debt in your wallet to clear.",
        `**Wallet:** ${currencyEmoji}${formatMoney(wallet)}`
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
      .setDescription(`you gave ${userMention(message, target.id)} ${currencyEmoji}**${formatMoney(amount)}**.`)
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
      .setTitle(isNewGame ? 'new roulette game started!' : 'Roulette bet added!')
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
          '',
          '`red`, `black`, `even`, `odd`, `low`/`1-18`, `high`/`19-36` = 2x multiplier',
          '',
          'dozen / column = 3x multiplier',
          'dozen example: `?roulette [ amount ] 2nd`',
          'column example: `?roulette [ amount ] column1`',
          '',
          'straight number = 36x multiplier',
          'straight number example: `?roulette [ amount ] 17`',
          '',
          'split - 2 numbers that touch each other on the roulette table side-by-side or vertically = 18x multiplier',
          'split example: `?roulette [ amount ] 2-5`',
          '',
          'street / zero trio - 3 numbers that touch each other on the roulette table horizontally = 12x multiplier',
          'street example: `?roulette [ amount ] 24-25-26`',
          'zero trio example: `?roulette [ amount ] 0-1-2`',
          '',
          'corner / first four - 4 numbers that meet at one corner of the table = 9x multiplier',
          'corner example: `?roulette [ amount ] 7-8-10-11`',
          'first four example: `?roulette [ amount ] 0-1-2-3`',
          '',
          'six line - 6 numbers that touch each other on the roulette table horizontally = 6x multiplier',
          'six line example: `?roulette [ amount ] 13-14-15-16-17-18`',
        ].join('\n')
      );
  },

  rouletteResult(number, summaries, guildId) {
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
        value: formatRouletteSummaries(winners, 'won', guildId)
      });
    }
    if (losers.length > 0) {
      embed.addFields({
        name: 'Losers',
        value: formatRouletteSummaries(losers, 'lost', guildId)
      });
    }
    if (breakEven.length > 0) {
      embed.addFields({
        name: 'No net change',
        value: formatRouletteSummaries(breakEven, 'broke even', guildId)
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
          `\`?color [ reset | #HEXHEX ]\`\n` +
          `change your RolfBot Embed color.\n` +
          `Aliases: \`?color\`, \`?colour\`, \`?settings color\`, \`?settings colour\`` +
          `\n\n` +
          `\`?badges\`\n` +
          `view and manage your RolfBot Economy badges.\n` +
          `Aliases: \`?badges\`, \`?settings badges\``
      )
      .setTimestamp();
  },

  settingsInvalidSetting(message, settingName) {
    return createEconomyEmbed(message, failEmbedColor).setDescription(
      [
        `Incorrect usage! \`${settingName}\` isn't a setting.`,
        '**available settings:**',
        commandUsage.badges,
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
  jsonFileCache.delete(file);
}

function loadEconomy() {
  refreshStatsDefinitions();
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
    for (const [key, def] of Object.entries(data.statCatalog || {})) {
      if (/^(shop_item_|shop_category_|achievements_)/.test(key) && def && typeof def.label === 'string') {
        addStat(key, def.label.slice(0, 90), def.type === 'money' ? 'money' : 'count');
      }
    }
    registerRankStats();
    for (const [guildId, guild] of Object.entries(data.guilds)) {
      for (const userId of Object.keys(guild.users || {})) getAccount(data, guildId, userId);
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
      if (!Number.isFinite(condition.target) || Math.abs(condition.target) > Number.MAX_SAFE_INTEGER || condition.target <= 0) {
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
        badge: typeof achievement.badge === 'string' && achievement.badge.trim() !== '[]'
          ? achievement.badge.trim()
          : '',
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
  data.statCatalog = Object.fromEntries([...extraStats].filter(([key]) => /^(shop_item_|shop_category_|achievements_)/.test(key))
    .map(([key, def]) => [key, { label: def.label, type: def.type }]));
  for (const [guildId, guild] of Object.entries(data.guilds)) {
    for (const userId of Object.keys(guild.users || {})) getAccount(data, guildId, userId);
  }
  updateRankRecords(data);
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
  if (!Array.isArray(account.achievementRewardClaims)) {
    account.achievementRewardClaims = [...account.achievements];
  }
  account.achievementRewardClaims = [
    ...new Set(account.achievementRewardClaims.filter((id) => typeof id === 'string'))
  ];
  if (!account.achievementStats || typeof account.achievementStats !== 'object') {
    account.achievementStats = {};
  }
  for (const [statName, value] of Object.entries(account.achievementStats)) {
    const def = extraStats.get(statName);
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER ||
        (!def && !Number.isSafeInteger(value)) || (value < 0 && !def?.signed)) {
      delete account.achievementStats[statName];
    }
  }
  if (!account.settings || typeof account.settings !== 'object') {
    account.settings = {};
  }
  if (typeof account.settings.embedColor !== 'string') {
    account.settings.embedColor = memberDefaultEmbedColor;
  }
  syncExtraStats(account, member);
  return account;
}

function incrementAchievementStatistic(account, statName, amount = 1) {
  const currentValue = Number.isFinite(account.achievementStats[statName])
    ? account.achievementStats[statName]
    : 0;
  account.achievementStats[statName] = currentValue + amount;
  recordExtraIncrement(account, statName, amount);
}

function setMaximumAchievementStatistic(account, statName, value) {
  const currentValue = Number.isFinite(account.achievementStats[statName])
    ? account.achievementStats[statName]
    : 0;
  account.achievementStats[statName] = Math.max(currentValue, value);
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
  recordExtraSlot(account, won, outcome, amount, payout);
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
  syncExtraStats(account);
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
      dailyStat(account, 'most_achievements_day');
      if (rewardedIds.has(achievement.id)) {
        newlyUnlocked.push({ ...achievement, rewards: { money: 0, xp: 0 } });
      } else {
        account.wallet += achievement.rewards.money;
        incrementAchievementStatistic(account, 'achievement_money_rewards', achievement.rewards.money);
        incrementAchievementStatistic(account, 'achievement_xp_rewards', achievement.rewards.xp);
        dailyStat(account, 'most_money_earned_day', achievement.rewards.money);
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
  if (statisticNames.includes(category)) {
    const value = account?.achievementStats?.[category];
    return Number.isFinite(value) ? value : 0;
  }
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
  const entries = Object.entries(users)
    .map(([userId, account]) => ({
      userId,
      value: getLeaderboardValue(account, category)
    }));
  if (category === 'debt') {
    return entries
      .filter((entry) => entry.value < 0)
      .sort(
        (entryA, entryB) => entryA.value - entryB.value || entryA.userId.localeCompare(entryB.userId)
      );
  }
  const ascending = extraStats.get(category)?.type === 'rank' || category === 'lowest_total_wealth';
  return (extraStats.get(category)?.type === 'rank' ? entries.filter(entry => entry.value > 0) : entries).sort(
    (a, b) => (ascending ? a.value - b.value : b.value - a.value) || a.userId.localeCompare(b.userId)
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
    member.roles.cache.has(robImmunityRoleId) ||
    account.ownedItems.includes(robImmunityItemId)
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
  for (const part of incomeDateFmt.formatToParts(new Date(timestamp))) {
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

function formatError(error, message) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return economyMessages.unexpectedError(errorMessage, message);
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

function formatRouletteSummaries(summaries, resultWord, guildId) {
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
  return addMentionBadges(lines.join('\n'), guildId);
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
  const accounts = new Map([...new Set(game.bets.map(bet => bet.userId))].map(
    id => [id, getAccount(economyData, game.guildId, id)]
  ));
  for (const bet of game.bets) {
    const account = accounts.get(bet.userId);
    const betWon = rouletteBetWins(bet, number);
    const payout = betWon ? Math.floor(bet.amount * bet.multiplier) : 0;
    account.wallet += payout;
    const tracking = statsMeta(account);
    tracking.escrow = Math.max(0, (tracking.escrow || 0) - bet.amount);
    recordExtraRouletteBet(account, bet, betWon, payout, number);
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
      net: 0,
      bets: 0,
      wins: 0
    };
    summary.bets += 1;
    summary.wins += betWon ? 1 : 0;
    summary.amountBet += bet.amount;
    summary.payout += payout;
    summary.net += payout - bet.amount;
    summariesByUser.set(bet.userId, summary);
  }
  for (const summary of summariesByUser.values()) {
    const account = accounts.get(summary.userId);
    setMaximumAchievementStatistic(account, 'most_roulette_bets_round', summary.bets);
    setMaximumAchievementStatistic(account, 'most_roulette_wins_round', summary.wins);
    setMaximumAchievementStatistic(account, 'most_roulette_wagered_round', summary.amountBet);
    setMaximumAchievementStatistic(account, 'biggest_roulette_net_win', summary.net);
    streakStat(account, 'roulette_win', summary.net > 0);
    streakStat(account, 'roulette_loss', summary.net < 0);
    recordGamblingDay(account, summary.net);
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
      const tracking = statsMeta(account);
      tracking.escrow = Math.max(0, (tracking.escrow || 0) - bet.amount);
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
  const embed = economyEmbeds.rouletteResult(number, summaries, game.guildId);
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
            content: economyMessages.helpWrongUser(message.author.id, message),
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
          const reqPage = getPageFromModal(modalInteraction, totalPages);
          if (reqPage === null) {
            await modalInteraction.reply({
              content: 'Please enter a whole page number.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          currentPage = reqPage;
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
              content: formatError(error, message),
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
    return message.reply(formatError(error, message));
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
    return message.reply(formatError(error, message));
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
    return message.reply(formatError(error, message));
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
    return message.reply(formatError(error, message));
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
            content: economyMessages.statsWrongUser(message.author.id, message),
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
          const reqPage = getPageFromModal(modalInteraction, totalPages);
          if (reqPage === null) {
            await modalInteraction.reply({
              content: 'Please enter a whole page number.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          currentPage = reqPage;
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
              content: formatError(error, message),
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
    return message.reply(formatError(error, message));
  }
}

function getLeaderboardBadges(account, achievements) {
  const unlockedIds = new Set(Array.isArray(account?.achievements) ? account.achievements : []);
  const hiddenIds = new Set(Array.isArray(account?.settings?.hiddenBadgeIds) ? account.settings.hiddenBadgeIds : []);
  return achievements
    .filter((achievement) => unlockedIds.has(achievement.id) && achievement.badge && !hiddenIds.has(achievement.id))
    .map((achievement) => achievement.badge)
    .join('');
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

async function showLeaderboardCategories(message) {
    loadEconomy();
    const statisticsPerPage = 15;
    const totalPages = Math.max(1, Math.ceil(statisticNames.length / statisticsPerPage));
    let currentPage = 0;
    const color = getUserEmbedColor(message.guild.id, message.author.id, message.member);
    const buildEmbed = () => createEconomyEmbed(message, color)
      .setTitle('Leaderboard Categories')
      .setDescription([
        '**Money and levels**',
        '`total`, `wallet`, `bank`, `debt`, `level`',
        '',
        '**Statistics**',
        ...statisticNames
          .slice(currentPage * statisticsPerPage, (currentPage + 1) * statisticsPerPage)
          .map(name => `\`${name}\``)
      ].join('\n'))
      .setFooter({ text: `Page ${currentPage + 1}/${totalPages} • ${statisticNames.length} statistics` });
    const embed = buildEmbed();
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
      time: lbConfig.buttonTimeoutMinutes * 60 * 1000
    });
    collector.on('collect', async (interaction) => {
      try {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({
            content: economyMessages.leaderboardWrongUser(message.author.id, message),
            flags: MessageFlags.Ephemeral,
            allowedMentions: {
              parse: []
            }
          });
          return;
        }
        let pageInteraction = interaction;
        if (interaction.customId === lbButtonIds.first) {
          currentPage = 0;
        } else if (interaction.customId === lbButtonIds.previous) {
          currentPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === lbButtonIds.next) {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        } else if (interaction.customId === lbButtonIds.last) {
          currentPage = totalPages - 1;
        } else if (interaction.customId === lbButtonIds.page) {
          collector.resetTimer();
          const modalId = `economy_leaderboard_categories_page_modal:${interaction.id}`;
          const modalInteraction = await waitForPageModal(interaction, modalId, totalPages);
          if (!modalInteraction) {
            return;
          }
          const reqPage = getPageFromModal(modalInteraction, totalPages);
          if (reqPage === null) {
            await modalInteraction.reply({
              content: 'Please enter a whole page number.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          currentPage = reqPage;
          pageInteraction = modalInteraction;
        } else {
          return;
        }
        const updatedEmbed = buildEmbed();
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
              content: formatError(error, message),
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
}

async function showLeaderboard(message, args = []) {
  try {
    loadEconomy();
    const requestedCategory = args.join(' ').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (requestedCategory === 'list' || requestedCategory === 'stats') {
      return await showLeaderboardCategories(message);
    }
    const category = requestedCategory
      ? (levelAliases.has(requestedCategory) ? 'level' : leaderboardCategoryAliases.get(requestedCategory))
      : 'total';
    if (!category) {
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
    const achievements = fs.existsSync(achievementsFile) ? loadAchievements() : [];
    const guildUsers = economyData.guilds[message.guild.id]?.users || {};
    for (const entry of entries) {
      entry.badges = getLeaderboardBadges(guildUsers[entry.userId], achievements);
    }
    const totalPages = Math.max(1, Math.ceil(entries.length / lbConfig.usersPerPage));
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
      time: lbConfig.buttonTimeoutMinutes * 60 * 1000
    });
    collector.on('collect', async (interaction) => {
      try {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({
            content: economyMessages.leaderboardWrongUser(message.author.id, message),
            flags: MessageFlags.Ephemeral,
            allowedMentions: {
              parse: []
            }
          });
          return;
        }
        let pageInteraction = interaction;
        if (interaction.customId === lbButtonIds.first) {
          currentPage = 0;
        } else if (interaction.customId === lbButtonIds.previous) {
          currentPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === lbButtonIds.next) {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        } else if (interaction.customId === lbButtonIds.last) {
          currentPage = totalPages - 1;
        } else if (interaction.customId === lbButtonIds.page) {
          collector.resetTimer();
          const modalId = `economy_leaderboard_page_modal:${interaction.id}`;
          const modalInteraction = await waitForPageModal(interaction, modalId, totalPages);
          if (!modalInteraction) {
            return;
          }
          const reqPage = getPageFromModal(modalInteraction, totalPages);
          if (reqPage === null) {
            await modalInteraction.reply({
              content: 'Please enter a whole page number.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          currentPage = reqPage;
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
              content: formatError(error, message),
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
    return message.reply(formatError(error, message));
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
      Math.ceil(achievements.length / achConfig.achievementsPerPage)
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
      time: achConfig.buttonTimeoutMinutes * 60 * 1000
    });
    collector.on('collect', async (interaction) => {
      try {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({
            content: economyMessages.achievementsWrongUser(message.author.id, message),
            flags: MessageFlags.Ephemeral,
            allowedMentions: {
              parse: []
            }
          });
          return;
        }
        let pageInteraction = interaction;
        if (interaction.customId === achButtonIds.first) {
          currentPage = 0;
        } else if (interaction.customId === achButtonIds.previous) {
          currentPage = Math.max(0, currentPage - 1);
        } else if (interaction.customId === achButtonIds.next) {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        } else if (interaction.customId === achButtonIds.last) {
          currentPage = totalPages - 1;
        } else if (interaction.customId === achButtonIds.page) {
          collector.resetTimer();
          const modalId = `economy_achievement_page_modal:${interaction.id}`;
          const modalInteraction = await waitForPageModal(interaction, modalId, totalPages);
          if (!modalInteraction) {
            return;
          }
          const reqPage = getPageFromModal(modalInteraction, totalPages);
          if (reqPage === null) {
            await modalInteraction.reply({
              content: 'Please enter a whole page number.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          currentPage = reqPage;
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
              content: formatError(error, message),
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
    return message.reply(formatError(error, message));
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
      const cooldownResponse = workCdResponses[
        Math.floor(Math.random() * workCdResponses.length)
      ].replace('{time}', `<t:${nextWorkTimestamp}:R>`);
      const embed = economyEmbeds.workCooldown(message, cooldownResponse);
      return message.reply({
        embeds: [embed]
      });
    }
    const earnedMoney =
      Math.floor(Math.random() * (workConfig.maximumPay - workConfig.minimumPay + 1)) +
      workConfig.minimumPay;
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
    return message.reply(formatError(error, message));
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
    const tracking = statsMeta(account);
    if (tracking.lastCollectedDay !== tracking.day) {
      tracking.lastCollectedDay = tracking.day;
      tracking.collectionDays = (tracking.collectionDays || 0) + 1;
    }
    tracking.collectionMoney = (tracking.collectionMoney || 0) + dailyIncome;
    for (const role of unclaimedIncomeRoles) {
      tracking.claimed[role.roleId] = true;
      incrementAchievementStatistic(account, 'individual_income_claims');
      incrementAchievementStatistic(account, `income_role_${role.roleId}`, role.income);
      if ([...shopRoleIds].some(([itemId, roleId]) => roleId === role.roleId && account.ownedItems.includes(itemId))) {
        incrementAchievementStatistic(account, 'purchased_role_income', role.income);
      }
    }
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
    return message.reply(formatError(error, message));
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
      const cooldownResponse = randomResponse(crimeCdResponses).replace(
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
      const crimeResponse = randomResponse(crimeWinResponses).replace(
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
    return message.reply(formatError(error, message));
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
      if (Date.now() >= account.lastRobAt + robConfig.cooldownMinutes * 60000) {
        incrementAchievementStatistic(targetAccount, 'immunity_blocks');
      }
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
    mapStat(account, 'robTargets', targetMember.id, 'unique_rob_targets');
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
      mapStat(account, 'robVictims', targetMember.id, 'unique_rob_victims', 'most_robs_same_user');
      mapStat(targetAccount, 'robbers', message.author.id, 'unique_robbers', 'most_robbed_by_same_user');
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
      incrementAchievementStatistic(targetAccount, 'failed_robs_against_you');
      incrementAchievementStatistic(account, 'rob_failures');
      recordMoneyLost(account, 'rob_fines', fine);
    }
    saveEconomy(economyData);
    return message.reply({
      embeds: [embed]
    });
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to rob user:', error);
    return message.reply(formatError(error, message));
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
      const cooldownResponse = randomResponse(begCdResponses).replace(
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
    return message.reply(formatError(error, message));
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
    if (requestedAmount === 'debt') {
      if (account.bank >= 0) {
        const embed = economyEmbeds.depositNoDebt(message, account.bank);
        return message.reply({
          embeds: [embed]
        });
      }
      amount = -account.bank;
    } else if (requestedAmount === 'all') {
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
    return message.reply(formatError(error, message));
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
    if (requestedAmount === 'debt') {
      if (account.wallet >= 0) {
        const embed = economyEmbeds.withdrawNoDebt(message, account.wallet);
        return message.reply({
          embeds: [embed]
        });
      }
      amount = -account.wallet;
    } else if (requestedAmount === 'all') {
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
    return message.reply(formatError(error, message));
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
    mapStat(account, 'giveRecipients', targetMember.id, 'unique_give_recipients');
    mapStat(targetAccount, 'transferSenders', message.author.id, 'unique_transfer_senders');
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
    return message.reply(formatError(error, message));
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
    return message.reply(formatError(error, message));
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
    statsMeta(account).escrow += amount;
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
    return message.reply(formatError(error, message));
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
    let selectedCat = 'all';
    let selectedPage = 0;
    saveEconomy(economyData);
    const components = createShopComponents(account, shopItems, selectedCat, selectedPage);
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
            content: economyMessages.shopWrongUser(message.author.id, message),
            flags: MessageFlags.Ephemeral,
            allowedMentions: {
              parse: []
            }
          });
          return;
        }
        if (interaction.customId === 'economy_shop_category') {
          selectedCat = interaction.values[0];
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
          if (selectedCat !== 'all' && !categories.includes(selectedCat)) {
            selectedCat = 'all';
          }
          saveEconomy(categoryEconomyData);
          account.wallet = categoryAccount.wallet;
          account.ownedItems = [...categoryAccount.ownedItems];
          await interaction.update({
            components: createShopComponents(
              categoryAccount,
              categoryShopItems,
              selectedCat,
              selectedPage
            )
          });
          return;
        }
        if (interaction.customId === shopButtonIds.page) {
          collector.resetTimer();
          const modalShopItems = loadShopItems();
          const modalTotalPages = getShopPageCount(modalShopItems, selectedCat);
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
          if (selectedCat !== 'all' && !categories.includes(selectedCat)) {
            selectedCat = 'all';
          }
          const totalPages = getShopPageCount(pageShopItems, selectedCat);
          const reqPage = getPageFromModal(modalInteraction, totalPages);
          if (reqPage === null) {
            await modalInteraction.reply({
              content: 'Please enter a whole page number.',
              flags: MessageFlags.Ephemeral
            });
            return;
          }
          selectedPage = reqPage;
          saveEconomy(pageEconomyData);
          account.wallet = pageAccount.wallet;
          account.ownedItems = [...pageAccount.ownedItems];
          await modalInteraction.update({
            components: createShopComponents(
              pageAccount,
              pageShopItems,
              selectedCat,
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
            selectedPage = getShopPageCount(pageShopItems, selectedCat) - 1;
          }
          selectedPage = clampShopPage(selectedPage, pageShopItems, selectedCat);
          saveEconomy(pageEconomyData);
          account.wallet = pageAccount.wallet;
          account.ownedItems = [...pageAccount.ownedItems];
          await interaction.update({
            components: createShopComponents(
              pageAccount,
              pageShopItems,
              selectedCat,
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
        mapStat(updatedAccount, 'shopItems', item.id, 'unique_shop_items');
        incrementAchievementStatistic(updatedAccount, `shop_item_${statId(item.id)}_purchases`);
        incrementAchievementStatistic(updatedAccount, `shop_category_${statId(item.category)}_purchases`);
        incrementAchievementStatistic(updatedAccount, `shop_category_${statId(item.category)}_spent`, item.price);
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
            selectedCat,
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
              content: formatError(error, message),
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
            selectedCat,
            selectedPage,
            true
          )
        })
        .catch(() => {});
    });
    return shopMessage;
  } catch (error) {
    console.error('[ECONOMY ERROR]: Failed to show shop:', error);
    return message.reply(formatError(error, message));
  }
}

function createBadgeSettingsComponents(account, badges, page, disableAll = false) {
  const pages = Math.max(1, Math.ceil(badges.length / 5));
  const hiddenIds = new Set(account.settings.hiddenBadgeIds || []);
  const container = new ContainerBuilder()
    .setAccentColor(Number.parseInt(account.settings.embedColor.slice(1), 16))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      '## Badge Settings\nChoose which earned badges appear before your name and mentions throughout the bot. you can get badges by completing difficult achievements. use `?achievements` and look for emojis in front of achievement names.'
    ));
  for (const badge of badges.slice(page * 5, page * 5 + 5)) {
    const owned = account.achievements.includes(badge.id);
    const hidden = hiddenIds.has(badge.id);
    const secret = badge.hidden && !owned;
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(secret
        ? '### 🔒 Hidden Badge\nUnlock its achievement to discover it.'
        : `### ${badge.badge} ${badge.name}\n${badge.description}\n-# ${!owned ? '🔒 Locked' : hidden ? 'Hidden everywhere' : 'Shown everywhere'}`))
      .setButtonAccessory(new ButtonBuilder()
        .setCustomId(`badge_toggle:${badge.id}`)
        .setLabel(!owned ? 'Locked' : hidden ? 'Show' : 'Hide')
        .setStyle(owned && hidden ? ButtonStyle.Success : ButtonStyle.Danger)
        .setDisabled(disableAll || !owned)));
  }
  if (!badges.length) container.addTextDisplayComponents(new TextDisplayBuilder().setContent('No achievement badges are available yet.'));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Page ${page + 1}/${pages}`));
  const components = [container];
  if (pages > 1) components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('badge_previous').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(disableAll || page === 0),
    new ButtonBuilder().setCustomId('badge_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(disableAll || page === pages - 1)
  ));
  return components;
}

async function showBadgeSettings(message) {
  const badges = loadAchievements().filter(achievement => achievement.badge);
  const readAccount = () => {
    const data = loadEconomy();
    const account = getAccount(data, message.guild.id, message.author.id, message.member);
    if (!Array.isArray(account.settings.hiddenBadgeIds)) account.settings.hiddenBadgeIds = [];
    return { data, account };
  };
  let page = 0;
  const initial = readAccount();
  saveEconomy(initial.data);
  const panel = await message.reply({
    flags: MessageFlags.IsComponentsV2,
    components: createBadgeSettingsComponents(initial.account, badges, page),
    allowedMentions: { parse: [], repliedUser: false }
  });
  const collector = panel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });
  collector.on('collect', async interaction => {
    try {
      if (interaction.user.id !== message.author.id) {
        await interaction.reply({ content: 'Only the person who opened these settings can use these buttons.', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.deferUpdate();
      const { data, account } = readAccount();
      if (interaction.customId === 'badge_previous') page = Math.max(0, page - 1);
      else if (interaction.customId === 'badge_next') page = Math.min(Math.max(0, Math.ceil(badges.length / 5) - 1), page + 1);
      else if (interaction.customId.startsWith('badge_toggle:')) {
        const id = interaction.customId.slice('badge_toggle:'.length);
        if (account.achievements.includes(id) && loadAchievements().some(badge => badge.id === id && badge.badge)) {
          const hidden = new Set(account.settings.hiddenBadgeIds);
          if (hidden.has(id)) hidden.delete(id);
          else hidden.add(id);
          account.settings.hiddenBadgeIds = [...hidden];
          incrementAchievementStatistic(account, 'badge_changes');
          saveEconomy(data);
        }
      }
      await interaction.editReply({ components: createBadgeSettingsComponents(account, badges, page, collector.ended) });
    } catch (error) {
      console.error('[ECONOMY ERROR]: Failed to update badge settings:', error);
      if (interaction.deferred || interaction.replied) await interaction.followUp({ content: 'Could not update badge settings. Please reopen ?badges and try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
  collector.on('end', async () => {
    try {
      await panel.edit({ components: createBadgeSettingsComponents(readAccount().account, badges, page, true) });
    } catch (error) {
      console.error('[ECONOMY ERROR]: Failed to close badge settings:', error);
    }
  });
  return panel;
}

async function showSettings(message, args) {
  try {
    if (args[0]?.toLowerCase() === 'badges') return await showBadgeSettings(message);
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
    return message.reply(formatError(error, message));
  }
}

function getAdminCommand(cmdName, args) {
  for (const [action, aliases] of adminMoneyAliases) {
    if (aliases.has(cmdName)) {
      return { type: 'money', action, args };
    }
  }
  const subcommand = args[0]?.toLowerCase();
  if (statsAliases.has(cmdName) && adminStatisticActions.has(subcommand)) {
    return { type: 'stats', action: adminStatisticActions.get(subcommand), args: args.slice(1) };
  }
  if (achievementAliases.has(cmdName) && adminAchievementActions.has(subcommand)) {
    return { type: 'achievements', action: adminAchievementActions.get(subcommand), args: args.slice(1) };
  }
  if (resetCooldownAliases.has(cmdName)) {
    return { type: 'cooldown', args };
  }
  if (adminHelpAliases.has(cmdName)) {
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
    .setDescription(addMentionBadges(description, message.guild.id))
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
  const reqPocket = args.at(-1).toLowerCase();
  const pocket = reqPocket === 'cash' ? 'wallet' : reqPocket;
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
  loadEconomy();
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
  const trailingArgs = resetting ? 1 : 2;
  if (args.length < trailingArgs + 1) {
    return adminInvalidUsage(message, usage);
  }
  const statName = args.at(-trailingArgs).toLowerCase();
  const resetAll = resetting && statName === 'all';
  if (!resetAll && !adminStatisticNames.has(statName)) {
    return replyAdmin(message, adminMessages.invalidStatistic, true);
  }
  const def = extraStats.get(statName);
  const rawAmount = args.at(-1)?.replaceAll(',', '');
  const amount = resetting ? 0 : def
    ? (/^-?\d+(?:\.\d+)?$/.test(rawAmount || '') && Number.isFinite(Number(rawAmount)) ? Number(rawAmount) : null)
    : parseAdminNumber(args.at(-1));
  if (amount === null || ((action === 'add' || action === 'remove') && amount === 0)) {
    return replyAdmin(message, `${adminMessages.invalidAmount}\n${usage}`, true);
  }
  const target = await resolveAdminMember(message, args.slice(0, -trailingArgs), usage);
  if (!target) {
    return;
  }
  const economyData = loadEconomy();
  const account = getAccount(economyData, message.guild.id, target.id, target);
  if (resetAll) {
    const previous = { ...account.achievementStats };
    account.achievementStats = {};
    delete account.statTracking;
    delete account.statOverrides;
    const rankHistory = economyData.guilds[message.guild.id].statRankTracking;
    if (rankHistory) for (const ids of Object.values(rankHistory.leaders)) {
      const index = ids.indexOf(target.id);
      if (index !== -1) ids.splice(index, 1);
    }
    return saveAdminChange(message, economyData, adminMessages.statisticsReset(target.id), {
      targetId: target.id, action: 'stats-reset', statistic: 'all', before: previous, after: {}
    });
  }
  const previous = account.achievementStats[statName] || 0;
  const next = action === 'add' ? previous + amount : action === 'remove' ? previous - amount : amount;
  if (!Number.isFinite(next) || Math.abs(next) > Number.MAX_SAFE_INTEGER ||
      ((!def || def.type === 'count' || def.type === 'rank') && !Number.isSafeInteger(next)) ||
      (next < 0 && !def?.signed) || (statName === 'platinum_loss_sequence_active' && next > 1)) {
    return replyAdmin(message, adminMessages.invalidStatisticValue, true);
  }
  account.achievementStats[statName] = next;
  if (resetting && account.statTracking) {
    const meta = account.statTracking;
    if (Object.hasOwn(meta.daily, statName)) meta.daily[statName] = 0;
    const mapKey = { unique_rob_targets: 'robTargets', unique_rob_victims: 'robVictims',
      unique_robbers: 'robbers', unique_give_recipients: 'giveRecipients',
      unique_transfer_senders: 'transferSenders', unique_roulette_numbers_won: 'rouletteNumbers',
      unique_shop_items: 'shopItems', most_robs_same_user: 'robVictims',
      most_robbed_by_same_user: 'robbers' }[statName];
    if (mapKey) meta.maps[mapKey] = {};
  }
  if (def?.calc || def?.type === 'rank') {
    account.statOverrides ||= {};
    if (resetting) delete account.statOverrides[statName];
    else account.statOverrides[statName] = next;
  }
  return saveAdminChange(message, economyData, adminMessages.statisticUpdated(target.id, statName, previous, next), {
    targetId: target.id, action: `stats-${action}`, statistic: statName, before: previous, after: next
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
  const cmdKey = getEconomyCommandKey(requestedCommand);
  if (requestedCommand !== 'all' && !adminCooldownFields.has(cmdKey)) {
    return replyAdmin(message, adminMessages.invalidCooldown, true);
  }
  const target = await resolveAdminMember(message, args.slice(0, -1), adminUsage.cooldown);
  if (!target) {
    return;
  }
  const economyData = loadEconomy();
  const account = getAccount(economyData, message.guild.id, target.id, target);
  const commands = requestedCommand === 'all' ? [...adminCooldownFields.keys()] : [cmdKey];
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
  for (const key of cmdCooldowns.keys()) {
    if (key.startsWith(prefix) && (requestedCommand === 'all' || key === `${prefix}${cmdKey}`)) {
      cmdCooldowns.delete(key);
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
  if (rouletteGames.get(guild.id)?.bets.some((bet) => bet.userId === userId)) return;
  try {
    await guild.members.fetch({ user: userId, force: true, cache: false });
    return;
  } catch (error) {
    if (Number(error.code) !== 10007) throw error;
  }
  if (guild.available === false || !guild.client.isReady()) return;
  if (rouletteGames.get(guild.id)?.bets.some((bet) => bet.userId === userId)) return;
  const data = loadEconomy();
  const users = data.guilds[guild.id]?.users;
  if (!users || !Object.prototype.hasOwnProperty.call(users, userId)) return;
  const backup = JSON.stringify({
    removedAt: new Date().toISOString(), guildId: guild.id, userId, account: users[userId]
  });
  fs.appendFileSync(path.join(__dirname, 'economy_removed_users.jsonl'), backup + '\n');
  delete users[userId];
  saveEconomy(data);
  console.log(`[ECONOMY CLEANUP]: Removed ${userId} from guild ${guild.id}; account backed up.`);
}

async function cleanupDepartedEconomyUsers(client) {
  if (!client.isReady()) return;
  for (const guild of client.guilds.cache.values()) {
    if (guild.available === false || cleanupRunning.has(guild.id)) continue;
    cleanupRunning.add(guild.id);
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
      cleanupRunning.delete(guild.id);
    }
  }
}

function initializeEconomyCleanup(client) {
  if (!client || cleanupClients.has(client)) return;
  cleanupClients.add(client);
  startStatsClock(client);
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
  const timer = setInterval(run, cleanupIntervalMs);
  timer.unref?.();
  setImmediate(run);
}

async function handleEconomyCommand(message) {
  initializeEconomyCleanup(message.client);
  if (message.author.bot || !message.guild || !message.content.startsWith(commandPrefix)) {
    return false;
  }
  const commandParts = message.content.slice(commandPrefix.length).trim().split(/\s+/);
  const cmdName = commandParts.shift()?.toLowerCase();
  const adminCommand = getAdminCommand(cmdName, commandParts);
  if (adminCommand) {
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
  const cmdKey = getEconomyCommandKey(cmdName);
  if (!cmdKey) {
    return false;
  }
  const remainingCooldown = useCommandRepeatCooldown(message, cmdKey);
  if (remainingCooldown > 0) {
    const embed = economyEmbeds.commandRepeatCooldown(
      message,
      cmdKey,
      remainingCooldown
    );
    await message.reply({
      embeds: [embed]
    });
    return true;
  }
  recordCommandUse(message, cmdKey);
  if (balanceAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => showBalance(message));
  }
  if (levelAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => showLevel(message, commandParts));
  }
  if (leaderboardAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => showLeaderboard(message, commandParts));
  }
  if (workAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => work(message));
  }
  if (collectAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => collectDailyIncome(message, commandParts));
  }
  if (crimeAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => crime(message));
  }
  if (robAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => rob(message, commandParts));
  }
  if (begAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => beg(message));
  }
  if (slotAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => slot(message, commandParts));
  }
  if (rouletteAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => roulette(message, commandParts));
  }
  if (shopAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => showShop(message, commandParts));
  }
  if (achievementAliases.has(cmdName)) {
    await checkAndAnnounceAchievements(message);
    await showAchievements(message, commandParts);
    return true;
  }
  if (cooldownAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => showCooldowns(message, commandParts));
  }
  if (statsAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => showStats(message, commandParts));
  }
  if (settingsAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => showSettings(message, commandParts));
  }
  if (badgeAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => showSettings(message, ['badges', ...commandParts]));
  }
  if (colorAliases.has(cmdName)) {
    return completeEconomyCommand(message, () =>
      showSettings(message, ['color', ...commandParts])
    );
  }
  if (giveAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => giveMoney(message, commandParts));
  }
  if (depositAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => deposit(message, commandParts));
  }
  if (withdrawAliases.has(cmdName)) {
    return completeEconomyCommand(message, () => withdraw(message, commandParts));
  }
  if (helpAliases.has(cmdName)) {
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

const extraStats = new Map();
const statsSession = require('crypto').randomUUID();
const statDecimals = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
let statsDefs = { achievements: [], items: [] };
let statsDefsStamp = '';

function addStat(key, label, type = 'count', calc = null, signed = false) {
  if (!extraStats.has(key)) {
    extraStats.set(key, { label, type, calc, signed });
    if (!statisticNames.includes(key)) statisticNames.push(key);
    adminStatisticNames.add(key);
    leaderboardCategoryAliases.set(key, key);
  } else if (calc) {
    Object.assign(extraStats.get(key), { label, type, calc, signed });
  }
  return key;
}

function statId(value) {
  const raw = String(value).trim().toLowerCase();
  const slug = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'other';
  return `${slug}_${require('crypto').createHash('sha256').update(raw).digest('hex').slice(0, 10)}`;
}

function statNum(account, key) {
  const value = account.achievementStats?.[key];
  return Number.isFinite(value) ? value : 0;
}

function initExtraStats() {
  const count = (key, label) => addStat(key, label);
  const money = (key, label, signed = false) => addStat(key, label, 'money', null, signed);
  const ratio = (key, label, top, bottom, percent = false) => addStat(key, label,
    percent ? 'percent' : 'money', a => {
      const n = typeof top === 'function' ? top(a) : statNum(a, top);
      const d = typeof bottom === 'function' ? bottom(a) : statNum(a, bottom);
      return d > 0 ? n / d * (percent ? 100 : 1) : 0;
    });
  const sum = (key, label, keys, type = 'count') => addStat(key, label, type,
    a => keys.reduce((total, name) => total + statNum(a, name), 0));
  const net = (key, label, earned, lost) => addStat(key, label, 'money',
    a => statNum(a, earned) - statNum(a, lost), true);
  for (const [key, label] of Object.entries({
    highest_wallet_balance: 'Highest wallet balance', highest_bank_balance: 'Highest bank balance',
    highest_total_wealth: 'Highest total wealth', lowest_total_wealth: 'Lowest total wealth',
    largest_debt: 'Largest debt', debt_repaid: 'Total debt repaid',
    most_money_earned_day: 'Most money earned in one day', most_money_lost_day: 'Most money lost in one day',
    biggest_wealth_increase_day: 'Biggest wealth increase in one day',
    biggest_wealth_decrease_day: 'Biggest wealth decrease in one day',
    missed_daily_income: 'Uncollected income on observed days',
    most_money_given_day: 'Most money given in one day', most_money_received_day: 'Most money received in one day',
    biggest_slots_net_win: 'Biggest slots net profit in one spin',
    most_roulette_wagered_round: 'Most money wagered in one roulette round',
    biggest_roulette_net_win: 'Biggest roulette net profit in one round',
    biggest_gambling_profit_day: 'Biggest gambling profit in one day',
    biggest_gambling_loss_day: 'Biggest gambling loss in one day',
    most_shop_spent_day: 'Most money spent in the shop in one day',
    purchased_role_income: 'Income earned from purchased income roles',
    achievement_money_rewards: 'Money earned from achievement rewards'
  })) money(key, label, ['highest_wallet_balance', 'highest_bank_balance', 'highest_total_wealth', 'lowest_total_wealth'].includes(key));
  for (const [key, label] of Object.entries({
    times_entered_debt: 'Times entering debt', most_work_day: 'Most work commands in one day',
    individual_income_claims: 'Individual income role payouts collected', most_beg_day: 'Most successful begs in one day',
    unique_rob_targets: 'Different users targeted for robbery', unique_rob_victims: 'Different users successfully robbed',
    unique_robbers: 'Different users who robbed you', most_robs_same_user: 'Most times robbing the same user',
    most_robbed_by_same_user: 'Most times robbed by the same user', immunity_blocks: 'Robbery attempts blocked by your immunity',
    failed_robs_against_you: 'Failed robbery attempts against you', most_rob_successes_day: 'Most successful robberies in one day',
    most_times_robbed_day: 'Most times robbed in one day', unique_give_recipients: 'Different users given money',
    unique_transfer_senders: 'Different users money received from', spins_since_platinum: 'Spins since last platinum',
    most_spins_between_platinum: 'Most spins between platinum wins', platinum_then_five_losses: 'Platinum followed by five losses completed',
    most_slots_plays_day: 'Most slots spins in one day', most_roulette_bets_round: 'Most bets in one roulette round',
    most_roulette_wins_round: 'Most winning bets in one roulette round', roulette_zero_wins: 'Successful straight bets on zero',
    roulette_straight_wins: 'Successful straight-number bets', unique_roulette_numbers_won: 'Different straight numbers won',
    most_roulette_games_day: 'Most roulette rounds in one day', unique_shop_items: 'Different shop items purchased',
    most_shop_purchases_day: 'Most shop purchases in one day', most_achievements_day: 'Most achievements unlocked in one day',
    achievement_xp_rewards: 'XP earned from achievement rewards', badge_changes: 'Badge changes',
    active_days: 'Different days using the economy', total_commands: 'Total bot commands used',
    most_commands_day: 'Most bot commands used in one day'
  })) count(key, label);
  for (const [key, label] of [['work_days', 'consecutive days worked'], ['collect_days', 'daily collection streak'], ['active_days', 'consecutive days using the economy'],
    ['crime_success', 'crime success streak'], ['crime_failure', 'crime failure streak'],
    ['rob_success', 'robbery success streak'], ['rob_failure', 'robbery failure streak'],
    ['platinum', 'consecutive platinum wins'], ['gold_plus', 'consecutive gold-or-better wins'],
    ['roulette_win', 'roulette round win streak'], ['roulette_loss', 'roulette round loss streak']]) {
    count(`current_${key}_streak`, `Current ${label}`);
    count(`longest_${key}_streak`, `Longest ${label}`);
  }
  ratio('average_work_payout', 'Average work payout', 'money_earned_work', 'work');
  addStat('average_collect_payout', 'Average daily collection payout', 'money', a =>
    a.statTracking?.collectionDays > 0 ? a.statTracking.collectionMoney / a.statTracking.collectionDays : 0);
  ratio('average_beg_payout', 'Average begging payout', 'money_earned_beg', 'beg');
  for (const key of ['crime', 'rob']) {
    sum(`${key}_attempts`, `Total ${key === 'rob' ? 'robbery' : 'crime'} attempts`, [`${key}_successes`, `${key}_failures`]);
    ratio(`${key}_success_rate`, `${key === 'rob' ? 'Robbery' : 'Crime'} success rate`, `${key}_successes`, a => statNum(a, `${key}_successes`) + statNum(a, `${key}_failures`), true);
    net(`${key}_net_profit`, `Net ${key === 'rob' ? 'robbery' : 'crime'} profit after fines`, `money_earned_${key}`, key === 'rob' ? 'money_lost_rob_fines' : 'money_lost_crime');
    ratio(`average_${key}_payout`, `Average successful ${key === 'rob' ? 'robbery' : 'crime'} payout`, `money_earned_${key}`, `${key}_successes`);
    ratio(`average_${key}_fine`, `Average ${key === 'rob' ? 'robbery' : 'crime'} fine`, key === 'rob' ? 'money_lost_rob_fines' : 'money_lost_crime', `${key}_failures`);
  }
  ratio('average_give', 'Average transfer sent', 'money_given', 'gives');
  ratio('average_received', 'Average transfer received', 'money_received', 'transfers_received');
  net('net_transfers', 'Net transfers received minus given', 'money_received', 'money_given');
  ratio('average_deposit', 'Average deposit amount', 'money_deposited', 'deposits');
  ratio('average_withdrawal', 'Average withdrawal amount', 'money_withdrawn', 'withdrawals');
  for (const key of ['slots', 'roulette']) {
    ratio(`${key}_win_rate`, `${key === 'slots' ? 'Slots' : 'Roulette round'} win rate`, `${key}_wins`, key === 'slots' ? 'slots_plays' : 'roulette_games', true);
    net(`${key}_net_profit`, `${key === 'slots' ? 'Slots' : 'Roulette'} net profit`, `${key}_payouts`, `${key}_wagered`);
    ratio(`${key}_return_percentage`, `${key === 'slots' ? 'Slots' : 'Roulette'} return percentage`, `${key}_payouts`, `${key}_wagered`, true);
    ratio(`average_${key}_bet`, `Average ${key} bet`, `${key}_wagered`, key === 'slots' ? 'slots_plays' : 'roulette_bets');
    ratio(`average_${key}_payout`, `Average ${key} payout per winning ${key === 'slots' ? 'spin' : 'bet'}`, `${key}_payouts`, key === 'slots' ? 'slots_wins' : 'roulette_bets_won');
  }
  ratio('roulette_bet_win_rate', 'Roulette individual bet win rate', 'roulette_bets_won', 'roulette_bets', true);
  sum('gambling_wagered', 'Combined slots and roulette wagers', ['slots_wagered', 'roulette_wagered'], 'money');
  sum('gambling_payouts', 'Combined slots and roulette payouts', ['slots_payouts', 'roulette_payouts'], 'money');
  addStat('gambling_net_profit', 'Combined slots and roulette net profit', 'money', a =>
    statNum(a, 'slots_payouts') + statNum(a, 'roulette_payouts') - statNum(a, 'slots_wagered') - statNum(a, 'roulette_wagered'), true);
  ratio('average_shop_price', 'Average shop purchase price', 'shop_money_spent', 'shop_purchases');
  addStat('achievements_unlocked', 'Achievements unlocked', 'count', a => a.achievements.length);
  addStat('achievement_completion', 'Achievement completion percentage', 'percent', a => statsDefs.achievements.length ?
    statsDefs.achievements.filter(x => a.achievements.includes(x.id)).length / statsDefs.achievements.length * 100 : 0);
  addStat('hidden_achievements_unlocked', 'Hidden achievements unlocked', 'count', a => statsDefs.achievements.filter(x => x.hidden && a.achievements.includes(x.id)).length);
  addStat('badges_unlocked', 'Badges unlocked', 'count', a => statsDefs.achievements.filter(x => x.badge && a.achievements.includes(x.id)).length);
  for (const tier of ['bronze', 'silver', 'gold', 'platinum']) money(`slots_${tier}_winnings`, `Slots net winnings from ${tier}`);
  for (const type of [...rouletteOutsideBets.keys(), 'straight', 'split', 'street', 'corner', 'six_line']) {
    count(`roulette_${type}_bets`, `Roulette ${type.replaceAll('_', ' ')} bets placed`);
    count(`roulette_${type}_wins`, `Roulette ${type.replaceAll('_', ' ')} bets won`);
    money(`roulette_${type}_wagered`, `Roulette ${type.replaceAll('_', ' ')} money wagered`);
    money(`roulette_${type}_net_profit`, `Roulette ${type.replaceAll('_', ' ')} net profit`, true);
  }
  for (const key of commandAliasGroups.keys()) count(`commands_${key}`, `Uses of ?${key}`);
  for (const [id] of dailyIncomeRoles) money(`income_role_${id}`, `Income earned from role ${id}`);
}

function refreshStatsDefinitions() {
  const stamp = [shopItemsFile, achievementsFile].map(file => fs.existsSync(file) ? getJsonFileStamp(file) : '').join('|');
  if (stamp === statsDefsStamp) return;
  const shop = fs.existsSync(shopItemsFile) ? JSON.parse(readJsonText(shopItemsFile)) : {};
  const ach = fs.existsSync(achievementsFile) ? JSON.parse(readJsonText(achievementsFile)) : {};
  statsDefs = { items: shop.items || [], achievements: (ach.achievements || []).filter(x => x.enabled !== false) };
  for (const item of statsDefs.items) {
    if (!item?.id) continue;
    addStat(`shop_item_${statId(item.id)}_purchases`, `Purchases: ${String(item.name || item.id).slice(0, 55)}`);
    const cat = String(item.category || 'Other').trim();
    addStat(`shop_category_${statId(cat)}_purchases`, `Shop purchases: ${cat.slice(0, 55)}`);
    addStat(`shop_category_${statId(cat)}_spent`, `Shop money spent: ${cat.slice(0, 55)}`, 'money');
  }
  for (const ach of statsDefs.achievements) {
    const difficulty = String(ach.difficulty || 'Unspecified').trim();
    addStat(`achievements_${statId(difficulty)}`, `Achievements unlocked: ${difficulty.slice(0, 55)}`, 'count', a =>
      statsDefs.achievements.filter(x => String(x.difficulty || 'Unspecified').trim().toLowerCase() === difficulty.toLowerCase() && a.achievements.includes(x.id)).length);
  }
  statsDefsStamp = stamp;
  registerRankStats();
}

function registerRankStats() {
  for (const cat of ['wallet', 'bank', 'total', 'debt', 'level', ...statisticNames.filter(key => !/^(best_rank_|days_first_)/.test(key))]) {
    const label = extraStats.get(cat)?.label || formatStatisticName(cat);
    addStat(`best_rank_${cat}`, `Best rank: ${label.slice(0, 65)}`, 'rank');
    addStat(`days_first_${cat}`, `Days finishing first: ${label.slice(0, 60)}`);
  }
}

function statDay(now = Date.now()) {
  const p = getDailyIncomeDateTimeParts(now);
  return Math.floor(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) / 86400000);
}

function statsMeta(account, now = Date.now()) {
  if (!account.statTracking || typeof account.statTracking !== 'object') {
    const total = account.wallet + account.bank;
    account.statTracking = { startedAt: now, day: statDay(now), daily: {}, maps: {}, streakDays: {},
      wealth: total, dayWealth: total, roles: {}, claimed: {}, escrow: 0 };
    for (const [key, value] of Object.entries({ highest_wallet_balance: account.wallet,
      highest_bank_balance: account.bank, highest_total_wealth: total, lowest_total_wealth: total,
      largest_debt: Math.max(0, -total) })) {
      if (!Number.isFinite(account.achievementStats[key])) account.achievementStats[key] = value;
    }
  }
  const meta = account.statTracking;
  if (meta.escrowSession !== statsSession) {
    meta.escrow = 0;
    meta.escrowSession = statsSession;
  }
  const today = statDay(now);
  if (meta.day !== today) {
    const missed = Object.entries(meta.roles).reduce((sum, [id, income]) => sum + (meta.claimed[id] ? 0 : income), 0);
    account.achievementStats.missed_daily_income = statNum(account, 'missed_daily_income') + missed;
    meta.day = today;
    meta.daily = {};
    meta.dayWealth = meta.wealth;
    meta.roles = {};
    meta.claimed = {};
  }
  return meta;
}

function dailyStat(account, key, amount = 1, now = Date.now()) {
  const meta = statsMeta(account, now);
  meta.daily[key] = (meta.daily[key] || 0) + amount;
  account.achievementStats[key] = Math.max(statNum(account, key), meta.daily[key]);
}

function streakStat(account, key, success) {
  account.achievementStats[`current_${key}_streak`] = success ? statNum(account, `current_${key}_streak`) + 1 : 0;
  setMaximumAchievementStatistic(account, `longest_${key}_streak`, statNum(account, `current_${key}_streak`));
}

function dayStreak(account, key, now = Date.now()) {
  const meta = statsMeta(account, now);
  const today = statDay(now);
  if (meta.streakDays[key] === today) return false;
  const previous = meta.streakDays[key];
  if (previous !== today - 1) account.achievementStats[`current_${key}_streak`] = 0;
  streakStat(account, key, true);
  meta.streakDays[key] = today;
  return true;
}

function mapStat(account, map, id, uniqueKey, maximumKey) {
  const meta = statsMeta(account);
  const values = meta.maps[map] ||= {};
  values[id] = (Object.hasOwn(values, id) ? values[id] : 0) + 1;
  if (uniqueKey) account.achievementStats[uniqueKey] = Object.keys(values).length;
  if (maximumKey) setMaximumAchievementStatistic(account, maximumKey, values[id]);
}

function syncExtraStats(account, member, now = Date.now()) {
  const meta = statsMeta(account, now);
  const stats = account.achievementStats;
  if (member?.roles?.cache) {
    for (const [id, income] of dailyIncomeRoles) {
      if (member.roles.cache.has(id)) meta.roles[id] = income;
    }
    if (account.incomeRoleClaimsDate === getDailyIncomeDateKey(now)) {
      for (const id of account.collectedIncomeRoleIds) meta.claimed[id] = true;
    }
  }
  const total = account.wallet + account.bank + (meta.escrow || 0);
  stats.highest_wallet_balance = Math.max(stats.highest_wallet_balance, account.wallet);
  stats.highest_bank_balance = Math.max(stats.highest_bank_balance, account.bank);
  stats.highest_total_wealth = Math.max(stats.highest_total_wealth, total);
  stats.lowest_total_wealth = Math.min(stats.lowest_total_wealth, total);
  stats.largest_debt = Math.max(stats.largest_debt, -total, 0);
  if (meta.wealth >= 0 && total < 0) stats.times_entered_debt = statNum(account, 'times_entered_debt') + 1;
  if (meta.wealth < 0 && total > meta.wealth) stats.debt_repaid = statNum(account, 'debt_repaid') + Math.min(-meta.wealth, total - meta.wealth);
  stats.biggest_wealth_increase_day = Math.max(statNum(account, 'biggest_wealth_increase_day'), total - meta.dayWealth);
  stats.biggest_wealth_decrease_day = Math.max(statNum(account, 'biggest_wealth_decrease_day'), meta.dayWealth - total);
  meta.wealth = total;
  for (const key of ['work_days', 'collect_days', 'active_days']) {
    if (meta.streakDays[key] < statDay(now) - 1) stats[`current_${key}_streak`] = 0;
  }
  for (const [key, def] of extraStats) {
    if (def.calc) stats[key] = def.calc(account);
  }
  for (const [key, value] of Object.entries(account.statOverrides || {})) stats[key] = value;
}

function recordExtraIncrement(account, name, amount) {
  const daily = { work: 'most_work_day', beg: 'most_beg_day', rob_successes: 'most_rob_successes_day',
    times_robbed: 'most_times_robbed_day', slots_plays: 'most_slots_plays_day', roulette_games: 'most_roulette_games_day',
    money_earned_total: 'most_money_earned_day', money_lost_total: 'most_money_lost_day',
    money_given: 'most_money_given_day', money_received: 'most_money_received_day',
    shop_purchases: 'most_shop_purchases_day', shop_money_spent: 'most_shop_spent_day', total_commands: 'most_commands_day' };
  if (daily[name]) dailyStat(account, daily[name], amount);
  if (name === 'work') dayStreak(account, 'work_days');
  if (name === 'collect') dayStreak(account, 'collect_days');
  for (const key of ['crime', 'rob']) {
    if (name === `${key}_successes` || name === `${key}_failures`) {
      streakStat(account, `${key}_success`, name.endsWith('successes'));
      streakStat(account, `${key}_failure`, name.endsWith('failures'));
    }
  }
}

function recordExtraSlot(account, won, outcome, amount, payout) {
  const meta = statsMeta(account);
  const tier = won ? outcome.name.toLowerCase() : '';
  streakStat(account, 'platinum', tier === 'platinum');
  streakStat(account, 'gold_plus', tier === 'platinum' || tier === 'gold');
  if (tier === 'platinum') {
    if (meta.seenPlatinum) setMaximumAchievementStatistic(account, 'most_spins_between_platinum', statNum(account, 'spins_since_platinum'));
    meta.seenPlatinum = true;
    account.achievementStats.spins_since_platinum = 0;
  } else if (meta.seenPlatinum) {
    incrementAchievementStatistic(account, 'spins_since_platinum');
  }
  if (won) {
    incrementAchievementStatistic(account, `slots_${tier}_winnings`, Math.max(0, payout - amount));
    setMaximumAchievementStatistic(account, 'biggest_slots_net_win', payout - amount);
  } else if (account.achievementStats.platinum_loss_sequence_active === 1 && statNum(account, 'current_platinum_followup_losses') === 4) {
    incrementAchievementStatistic(account, 'platinum_then_five_losses');
  }
  recordGamblingDay(account, payout - amount);
}

function recordGamblingDay(account, net) {
  const meta = statsMeta(account);
  meta.daily.gamblingNet = (meta.daily.gamblingNet || 0) + net;
  setMaximumAchievementStatistic(account, 'biggest_gambling_profit_day', meta.daily.gamblingNet);
  setMaximumAchievementStatistic(account, 'biggest_gambling_loss_day', -meta.daily.gamblingNet);
}

function recordExtraRouletteBet(account, bet, won, payout, number) {
  const type = bet.key === 'inside' ? ({ 1: 'straight', 2: 'split', 3: 'street', 4: 'corner', 6: 'six_line' })[bet.numbers.length] : bet.key;
  incrementAchievementStatistic(account, `roulette_${type}_bets`);
  incrementAchievementStatistic(account, `roulette_${type}_wagered`, bet.amount);
  incrementAchievementStatistic(account, `roulette_${type}_net_profit`, payout - bet.amount);
  if (won) {
    incrementAchievementStatistic(account, `roulette_${type}_wins`);
    if (type === 'straight') {
      if (number === 0) incrementAchievementStatistic(account, 'roulette_zero_wins');
      mapStat(account, 'rouletteNumbers', String(number), 'unique_roulette_numbers_won');
    }
  }
}

function recordCommandUse(message, key) {
  const data = loadEconomy();
  const account = getAccount(data, message.guild.id, message.author.id, message.member);
  incrementAchievementStatistic(account, 'total_commands');
  incrementAchievementStatistic(account, `commands_${key}`);
  if (dayStreak(account, 'active_days')) incrementAchievementStatistic(account, 'active_days');
  saveEconomy(data);
}

function updateRankRecords(data, now = Date.now()) {
  const today = statDay(now);
  const xpRanks = getLevelLeaderboardEntries();
  for (const [guildId, guild] of Object.entries(data.guilds)) {
    const users = guild.users || {};
    const history = guild.statRankTracking ||= { day: today, leaders: {} };
    if (history.day !== today) {
      for (const [cat, ids] of Object.entries(history.leaders)) {
        for (const id of ids) if (users[id]) incrementAchievementStatistic(users[id], `days_first_${cat}`);
      }
      history.day = today;
      history.leaders = {};
    }
    const categories = ['wallet', 'bank', 'total', 'debt', ...statisticNames.filter(key => !/^(best_rank_|days_first_)/.test(key))];
    for (const cat of categories) {
      const entries = getLeaderboardEntries(data, guildId, cat);
      const eligible = extraStats.get(cat)?.type === 'rank' ? entries.filter(x => x.value > 0) : entries;
      history.leaders[cat] = eligible.length ? [eligible[0].userId] : [];
      eligible.forEach((entry, i) => {
        const rank = i + 1;
        const account = users[entry.userId];
        const key = `best_rank_${cat}`;
        account.achievementStats[key] = account.statOverrides?.[key] ?? Math.min(statNum(account, key) || Infinity, rank);
      });
    }
    const xpEntries = xpRanks;
    history.leaders.level = xpEntries.length && users[xpEntries[0].userId] ? [xpEntries[0].userId] : [];
    xpEntries.forEach((entry, i) => {
      const rank = i + 1;
      const account = users[entry.userId];
      if (!account) return;
      account.achievementStats.best_rank_level = account.statOverrides?.best_rank_level ?? Math.min(statNum(account, 'best_rank_level') || Infinity, rank);
    });
  }
}

function startStatsClock(client) {
  const tick = () => {
    if (!client.isReady()) return;
    try {
      const data = loadEconomy();
      for (const [guildId, guild] of Object.entries(data.guilds)) {
        for (const id of Object.keys(guild.users || {})) getAccount(data, guildId, id, client.guilds.cache.get(guildId)?.members.cache.get(id));
      }
      saveEconomy(data);
    } catch (error) { console.error('[ECONOMY STATS]: Failed to update daily records:', error); }
  };
  client.on('guildMemberUpdate', (_old, member) => {
    try {
      const data = loadEconomy();
      if (!data.guilds[member.guild.id]?.users?.[member.id]) return;
      getAccount(data, member.guild.id, member.id, member);
      saveEconomy(data);
    } catch (error) { console.error('[ECONOMY STATS]: Failed to observe income roles:', error); }
  });
  const timer = setInterval(tick, 60 * 1000);
  timer.unref?.();
  setImmediate(tick);
}

initExtraStats();
registerRankStats();


module.exports = {
  handleEconomyCommand,
  getUserEmbedColor,
  getLevelEmbed,
  formatXp,
  showLevelLeaderboard
};