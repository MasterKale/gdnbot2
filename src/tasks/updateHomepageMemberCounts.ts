import { Collection, GuildMember } from 'discord.js';
import { CommandoClient } from 'discord.js-commando';

import logger, { LogTag } from '../helpers/logger';
import { axiosGDN, GDN_URLS, APIGuild } from '../helpers/axiosGDN';
import roundDown from '../helpers/roundDown';

interface GuildsMap {
  [guildId: string]: APIGuild;
}

export async function updateHomepageMemberCounts (tag: LogTag, bot: CommandoClient) {
  logger.info(tag, '[TASK START] Updating homepage member counts');

  try {
    // Get the list of enrolled servers from the back end
    const resp = await axiosGDN.get<APIGuild[]>(GDN_URLS.GUILDS);
    const apiGuilds = resp.data;
    // Map the servers by ID
    const guildsMap: GuildsMap = {};
    apiGuilds.forEach(guild => {
      guildsMap[guild.server_id] = guild;
    });

    // Go through each Guild and attempt to count the number of authed Members
    bot.guilds.cache.each(async (guild) => {
      const subTag = { ...tag, guildID: guild.id };
      // Don't do anything if this guild isn't enrolled in GDN
      if (!guildsMap[guild.id]) {
        logger.debug(subTag, `${guild.name} not enrolled in GDN, ignoring`);
        return;
      }

      // Grab the auth role ID registered with the backend
      const authedRoleID = guildsMap[guild.id].validated_role_id;

      let authedUsers: Collection<string, GuildMember>;
      let message: string;
      if (!authedRoleID) {
        // Auth wasn't set up here, so just return the total number of Members
        authedUsers = guild.members.cache;
        message = 'Updating total member count';
      } else {
        // Go through each Member and filter for ones that have the Guild's auth role
        authedUsers = guild.members.cache.filter(
          member => member.roles.cache.some(role => role.id === authedRoleID),
        );
        message = 'Updating authed member count';
      }

      /**
       * Sometimes servers will be misconfigured, with an authme role specified but no one assigned
       * to it. In those cases, fall back to using total member count so that the homepage doesn't
       * display "0 goons"
       */
      if (authedRoleID && authedUsers.size < 1) {
        authedUsers = guild.members.cache;
        message = 'Authed member count was zero. Updating total member count';
      }

      logger.info(subTag, `${message} for ${guild.name}: ${authedUsers.size}`);

      // Patch the server count
      try {
        const count = roundDown(authedUsers.size);
        // Updated server info
        const payload = {
          name: guild.name,
          user_count: count,
        };

        logger.debug({ ...subTag, payload }, 'Updating server info');

        await axiosGDN.patch(`${GDN_URLS.GUILDS}/${guild.id}`, payload);

        logger.info(subTag, 'Successfully updated member count and name');
      } catch (err) {
        logger.error({ ...subTag, err }, 'Error sending updated count to server');
      }
    });
  } catch (err) {
    logger.error({ ...tag, err }, 'Error updating server member counts');
  }
}
