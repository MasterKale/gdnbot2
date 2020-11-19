import { CommandoClient, CommandoMessage } from 'discord.js-commando';
import { GuildMember } from 'discord.js';
import { oneLine } from 'common-tags';

import GDNEmbed from '../../helpers/GDNEmbed';
import GDNCommand from '../../helpers/GDNCommand';
import { CMD_GROUPS, CMD_NAMES } from '../../helpers/constants';
import logger, { getLogTag } from '../../helpers/logger';
import logCommandStart from '../../helpers/logCommandStart';
import { axiosGDN, GDN_URLS } from '../../helpers/axiosGDN';

import hasGuildEnrolled from '../../checks/hasGuildEnrolled';

/**
 * !gdn-detect
 *
 * Can be used to display a list of roles, channels, etc... (see `options` above) for whatever
 * server the command is run in
 */
export default class DetectBlacklistedCommand extends GDNCommand {
  constructor (client: CommandoClient) {
    super(client, {
      name: CMD_NAMES.GDN_DETECT_BLACKLISTED,
      group: CMD_GROUPS.GDN,
      memberName: 'detect_blacklisted',
      description: 'Detect members of this server that are blacklisted in GDN',
      guildOnly: true,
      userPermissions: ['KICK_MEMBERS', 'BAN_MEMBERS'],
    });
  }

  async run (message: CommandoMessage) {
    const { id, guild } = message;

    const tag = getLogTag(id);

    logCommandStart(tag, message);

    /**
     * Check that server is enrolled
     */
    const { isEnrolled, guildData } = await hasGuildEnrolled(tag, guild);

    if (!isEnrolled) {
      logger.info(tag, 'Server not enrolled, exiting');

      message.channel.stopTyping();
      return message.reply(oneLine`
        please enroll this server in GDN to enable use of this command.
      `);
    }

    if (!guildData) {
      logger.error({ ...tag, guildData }, 'Server is enrolled, but no guild data??? IMPOSSIBLE');
      throw new Error('Server is enrolled, but no server data is available');
    }

    /**
     * Request a list of all blacklisted IDs
     */
    let blacklistedIDs: string[] = [];
    try {
      logger.info(tag, 'Retrieving blacklisted Discord members');
      const { data } = await axiosGDN.get<string[]>(GDN_URLS.MEMBERS_BLACKLISTED);
      blacklistedIDs = data;
    } catch (err) {
      logger.error({ ...tag, err }, 'Error fetching blacklisted members');
    }

    if (blacklistedIDs.length < 1) {
      logger.info(tag, 'Server returned no blacklisted members, exiting');
      return message.say('There are currently no blacklisted users in GDN');
    }

    // Map blacklisted IDs for faster matches
    const mappedBlacklisted: { [id: string]: true } = {};
    blacklistedIDs.forEach((id: string) => {
      mappedBlacklisted[id] = true;
    });

    /**
     * Filter guild members to just those who are blacklisted
     */
    const matching = guild.members.cache.filter(
      (member: GuildMember) => !!mappedBlacklisted[member.id],
    );

    // None of the blacklisted users are in this guild
    if (matching.size < 1) {
      logger.info(tag, `No blacklisted users are in ${guild.name}, exiting`);
      return message.say('No blacklisted users were detected in this guild');
    }

    const matchingString = matching.array();

    logger.info(
      {
        ...tag,
        matching: matchingString.join(', '),
      },
      `Found ${matching.size} blacklisted member(s) in this guild`,
    );

    /**
     * Send formatted list of matching users
     */
    const embed = new GDNEmbed()
      .setTitle(`GDN Blacklist Check for ${guild.name}`)
      .setDescription(oneLine`
        The following **${matching.size} Discord member(s)** in your guild are blacklisted in GDN:
      `)
      .addField('Matching Guild Members', matchingString.map(
        member => `**${member.user.tag}** (${member.id})`,
      ))
      .addField('Tips', `${oneLine`_
        You can **Copy > Paste** a username above into **Server Settings > Members** to quickly
        identify that member within this guild.
      _`}`);

    return message.embed(embed);
  }
}
