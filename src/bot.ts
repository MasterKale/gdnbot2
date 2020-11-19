// Load files from the .env file
import dotenv from 'dotenv';

import { CommandoClient, SQLiteProvider, Command, CommandoMessage } from 'discord.js-commando';
import { Guild } from 'discord.js';
import sqlite from 'sqlite';
import path from 'path';
import { stripIndents } from 'common-tags';
import { CronJob } from 'cron';

import logger, { getLogTag } from './helpers/logger';
import { CMD_PREFIX, CMD_GROUPS, DISCORD_BOT_TOKEN } from './helpers/constants';

// Event handlers
import autoAuth from './tasks/autoAuth';
import updateServerCountActivity from './tasks/updateServerCountActivity';
import {
  updateHomepageMemberCounts,
} from './tasks/updateHomepageMemberCounts';
// import removeGuildFromGDN from './tasks/removeGuildFromGDN';
import syncSAPermabans from './tasks/syncSAPermabans';
import leaveIdleServers from './tasks/leaveIdleServers';

dotenv.config();

// Create the bot as a Commando client
const bot = new CommandoClient({
  commandPrefix: CMD_PREFIX,
  owner: '148474055949942787',
  invite: 'https://discord.gg/vH8uVUE',
});

// Set up a SQLite DB to preserve guide-specific command availability
sqlite.open(path.join(__dirname, '../settings.db'))
  .then(db => bot.setProvider(new SQLiteProvider(db)))
  .catch(error => { logger.error('Error loading SQLite DB:', error); });

// Initialize commands and command groups
bot.registry
  .registerDefaultTypes()
  .registerGroups([
    [CMD_GROUPS.AUTH, 'Authentication'],
    [CMD_GROUPS.GDN, 'Goon Discord Network'],
    [CMD_GROUPS.PUBLIC, 'For Everyone'],
    [CMD_GROUPS.OWNER, 'Bot Administration'],
  ])
  .registerDefaultGroups()
  .registerDefaultCommands({
    unknownCommand: false,
    help: false,
    prefix: false,
  })
  // Automatically load commands that exist in the commands/ directory
  // A custom filter is specified so that the `require-all` library picks up .ts files during dev
  .registerCommandsIn({
    dirname: path.join(__dirname, 'commands'),
    filter: /^([^.].*)\.[jt]s$/,
  });

// Announce the bot's readiness to serve
bot.once('ready', () => {
  if (!bot.user) {
    logger.error('Bot initialized but has no user, how did this happen?');
    throw new Error('Bot initialized but has no user, how did this happen?');
  }

  /* eslint-disable no-useless-escape */
  logger.info(stripIndents`
       __________  _   ______        __
      / ____/ __ \/ | / / __ )____  / /_
     / / __/ / / /  |/ / __  / __ \/ __/
    / /_/ / /_/ / /|  / /_/ / /_/ / /_
    \____/_____/_/ |_/_____/\____/\__/
  `);
  logger.info(`Logged in as ${bot.user.tag}`);
  logger.info(`Command prefix: ${bot.commandPrefix}`);
  logger.info('---:getin:---');
  /* eslint-enable no-useless-escape */

  bot.user.setActivity('in the forge');

  const tag = getLogTag('botinit');

  // Update bot activity to reflect number of guilds
  updateServerCountActivity(tag, bot);
});

// Handle errors
bot.on('error', (err: Error) => {
  if (err.message === 'Cannot read property \'trim\' of undefined') {
    // Swallow a bug in discord.js-commando at:
    // node_modules/discord.js-commando/src/extensions/message.js:109:28
  } else {
    logger.error(err, 'Bot system error');
  }
});

/**
 * Event Handlers
 */

// When the bot joins a Guild
bot.on('guildCreate', (guild: Guild) => {
  const tag = getLogTag();

  logger.info(tag, `Joined guild ${guild.name} (${guild.id})`);
  updateServerCountActivity(tag, bot);
});

// When the bot leaves a Guild
bot.on('guildDelete', (guild: Guild) => {
  const tag = getLogTag();

  logger.info(tag, `Left guild ${guild.name} (${guild.id})`);

  updateServerCountActivity(tag, bot);
  // Temporarily disable this since Discord is doing some kind of netsplit that's
  // errantly causing this bot to delete servers from GDN
  // removeGuildFromGDN(tag, guild);
});

// When a Member joins a Guild
bot.on('guildMemberAdd', autoAuth);

bot.on('commandError', (command: Command, err: Error, message: CommandoMessage) => {
  message.channel.stopTyping();
});

// Start the bot
bot.login(DISCORD_BOT_TOKEN);

/**
 * SCHEDULED ADMINISTRATIVE TASKS
 */

/*
 * Remove bot from idle servers (ones not enrolled in GDN)
 * Current execution time: Daily @ 12:05am
 */
const jobLeaveIdleServers = new CronJob('5 0 * * *', function () {
  const tag = getLogTag();
  leaveIdleServers(tag, bot);
}, undefined, false, 'America/Los_Angeles');
jobLeaveIdleServers.start();

/*
 * Update homepage member counts
 * Current execution time: Daily @ 12:10am
 */
const jobUpdateHomepage = new CronJob('10 0 * * *', function () {
  const tag = getLogTag();
  updateHomepageMemberCounts(tag, bot);
}, undefined, false, 'America/Los_Angeles');
jobUpdateHomepage.start();

/**
 * Update blacklist with last month's permabans
 * Current execution time: Monthly on the 1st @ 12:15am
 */
const jobPermabanSync = new CronJob('15 0 1 * *', function () {
  const tag = getLogTag();
  syncSAPermabans(tag);
}, undefined, false, 'America/Los_Angeles');
jobPermabanSync.start();
