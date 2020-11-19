import { Guild, TextChannel } from 'discord.js';

import logger, { LogTag } from '../helpers/logger';

interface ValidatedLogChannel {
  isValid: boolean;
  logChannel?: TextChannel;
}

/**
 * Try to find a logging channel matching the guild's authme logging channel ID
 */
export default async function isValidLogChannel (
  tag: LogTag,
  guild: Guild,
  channelId?: string,
): Promise<ValidatedLogChannel> {
  let logChannel: TextChannel;
  let isValid = false;

  if (channelId) {
    logger.info(tag, `Validating logging channel ID: '${channelId}'`);
    const textChannel = guild.channels.cache.get(channelId);

    if (textChannel?.type === 'text') {
      logger.info(tag, `Found valid text channel: '#${textChannel.name}'`);
      isValid = true;
      logChannel = (textChannel as TextChannel);
    } else {
      logger.info(tag, 'No text channel found by that ID');
    }
  } else {
    logger.info(tag, 'No channel ID provided');
  }

  return {
    isValid,
    // @ts-ignore 2454
    logChannel,
  };
}
