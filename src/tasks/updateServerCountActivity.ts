import { CommandoClient } from 'discord.js-commando';

import logger, { LogTag } from '../helpers/logger';

/**
 * Set the bot's activity to show the number of servers it's sitting in
 *
 * @param {Client} bot
 */
const updateServerCountActivity = async (tag: LogTag, bot: CommandoClient) => {
  const activity = `in ${bot.guilds.cache.size} servers`;

  logger.info(tag, `setting activity to "${activity}"`);

  await bot.user?.setActivity(activity);
};

export default updateServerCountActivity;
