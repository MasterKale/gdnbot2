import { Guild, Collection, GuildChannel } from 'discord.js';

/**
 * List all of the guild's Text Channels
 */
export default function listTextChannels (guild: Guild): Collection<string, GuildChannel> {
  return guild.channels.cache.filter(channel => channel.type === 'text');
}
