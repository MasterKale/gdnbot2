import { Guild } from 'discord.js';
import { CommandoClient } from 'discord.js-commando';
import { DateTime } from 'luxon';

import logger, { LogTag } from '../helpers/logger';
import { axiosGDN, GDN_URLS, APIGuild } from '../helpers/axiosGDN';
import { MAX_IDLE_DAYS } from '../helpers/constants';

export default async function leaveIdleServers (tag: LogTag, bot: CommandoClient): Promise<void> {
  logger.info(tag, '[TASK START] Checking for idle guilds');

  const discordGuilds = bot.guilds;

  const { data: gdnServers } = await axiosGDN.get(GDN_URLS.GUILDS);

  // Determine how many servers
  const countDiscord = discordGuilds.cache.size;
  const countGDN = gdnServers.length;

  logger.info(tag, `Bot is in ${countDiscord} Discord guilds, of which ${countGDN} are in GDN`);

  const gdnServersMapped: { [key: string]: string } = {};
  gdnServers.forEach((gdn: APIGuild) => {
    gdnServersMapped[gdn.server_id] = gdn.name;
  });

  const idlingIn = discordGuilds.cache.filter((guild: Guild) => !gdnServersMapped[guild.id]);
  logger.info(tag, `Idling in ${idlingIn.size} guilds`);

  // Remove the bot from servers it's idling in
  idlingIn.forEach((guild: Guild) => {
    const { id, name, joinedAt } = guild;

    logger.info(tag, `Calculating idle duration for ${name} (${id})`);

    const joined = DateTime.fromJSDate(joinedAt);
    // `.diffNow()` will return a negative number since `joined` will be in the past
    const numDays = joined.diffNow('days').days * -1;

    logger.info(tag, `Bot has been idling for ${numDays} of ${MAX_IDLE_DAYS} days`);

    if (numDays >= MAX_IDLE_DAYS) {
      logger.info(tag, `Leaving idle guild ${name} (${id})`);
      guild
        .leave()
        .catch((err) => logger.error({ ...tag, err }, 'Error leaving guild'));
    }
  });
}
