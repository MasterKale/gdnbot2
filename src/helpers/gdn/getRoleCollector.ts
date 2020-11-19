import { ArgumentCollector, CommandoClient, CommandoGuild } from 'discord.js-commando';
import { oneLine } from 'common-tags';

import logger, { LogTag } from '../logger';

/**
 * An interface reflecting the values returned from this collector
 */
export interface RoleArgs {
  roleID: string;
}

/**
 * An ArgumentCollector for prompting users for a server description and invite code
 */
export default function getRoleCollector (
  tag: LogTag,
  client: CommandoClient,
  guild: CommandoGuild,
  prompt: string = 'specify a Role ID',
): ArgumentCollector {
  return new ArgumentCollector(client, [
    {
      key: 'roleID',
      prompt,
      type: 'string',
      wait: 60,
      validate: async (roleID: string): Promise<string | boolean> => {
        /**
         * See if the provided role ID is valid for this guild
         */

        logger.info(tag, `Confirming role ID "${roleID}" is valid`);

        const role = guild.roles.cache.get(roleID);

        if (!role) {
          return oneLine`
            that doesn't appear to be a valid role ID. Please try again:
          `;
        }

        return true;
      },
    },
  ]);
}
