import { ArgumentCollector, CommandoClient, CommandoGuild } from 'discord.js-commando';
import { oneLine } from 'common-tags';

import logger, { LogTag } from '../logger';

/**
 * An interface reflecting the values returned from this collector
 */
export interface ChannelArgs {
  channelID: string;
}

/**
 * An ArgumentCollector for prompting users for a server description and invite code
 */
export default function getChannelCollector (
  tag: LogTag,
  client: CommandoClient,
  guild: CommandoGuild,
  prompt: string = '',
): ArgumentCollector {
  return new ArgumentCollector(client, [
    {
      key: 'channelID',
      prompt,
      type: 'string',
      wait: 60,
      validate: async (channelID: string): Promise<string | boolean> => {
        /**
         * See if the provided channel ID is valid for this guild
         */

        logger.info(tag, `Confirming channel ID "${channelID}" is valid`);

        const channel = guild.channels.cache.get(channelID);

        if (!channel) {
          return oneLine`
            that doesn't appear to be a valid channel ID. Please try again:
          `;
        }

        return true;
      },
    },
  ]);
}
