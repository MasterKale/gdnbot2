import { CommandoClient, CommandoMessage } from 'discord.js-commando';
import { oneLine, stripIndents } from 'common-tags';

import GDNCommand from '../../helpers/GDNCommand';
import logger, { getLogTag } from '../../helpers/logger';
import { CMD_GROUPS, CMD_NAMES } from '../../helpers/constants';
import getRoleCollector, { RoleArgs } from '../../helpers/gdn/getRoleCollector';
import getChannelCollector, { ChannelArgs } from '../../helpers/gdn/getChannelCollector';
import { axiosGDN, GDN_URLS, APIGuildAuthme } from '../../helpers/axiosGDN';
import logCommandStart from '../../helpers/logCommandStart';

import hasGuildEnrolled from '../../checks/hasGuildEnrolled';

import { OPTIONS } from './list';

export default class EnableAuthmeCommand extends GDNCommand {
  constructor (client: CommandoClient) {
    super(client, {
      name: CMD_NAMES.GDN_ENABLE_AUTHME,
      group: CMD_GROUPS.GDN,
      memberName: 'enable_authme',
      description: `Enable \`${client.commandPrefix}${CMD_NAMES.AUTHME}\``,
      details: stripIndents`
        Enrolled servers can use this command to enable the use of \`!authme\` on their server.

        ${oneLine`
          \`!authme\` empowers new server members to interact with this bot to verify their
          membership to the Something Awful forums. After authenticating, the bot will automatically
          give them a server-specific "verified goon" role. Authenticated users will also enjoy
          automatic authentication upon joining another GDN-enrolled Discord server.
        `}

        ${oneLine`
          Depending on how this server is configured, this server's "verified goon" role can be used
          to lock down the server's channels to only be visible to authenticated users.
          Unauthenticated users would see an "#auth-room" channel in which they can call \`!authme\`
          and complete authentication. After verifying their SA membership, the newly-added role
          would immediately reveal all of the other channels in the server!
        `}

        ${oneLine`
          If you have any questions about this, feel free to ask in the official GDN support
          server: ${client.options.invite} :bee:
        `}
      `,
      guildOnly: true,
      userPermissions: ['MANAGE_ROLES', 'MANAGE_CHANNELS'],
    });
  }

  async run (message: CommandoMessage) {
    const { id, guild } = message;
    const { commandPrefix } = this.client;

    const tag = getLogTag(id);

    logCommandStart(tag, message);

    /**
     * Check that server is enrolled
     */
    const { isEnrolled } = await hasGuildEnrolled(tag, guild);

    if (!isEnrolled) {
      logger.info(tag, 'Server not enrolled, exiting');

      message.channel.stopTyping();
      return message.reply(oneLine`
        please enroll this server in GDN to enable use of this command.
      `);
    }

    /**
     * Prompt for a "verified goon" role
     */
    logger.info(tag, 'Prompting for a role ID');

    await this.client.registry.commands.get(CMD_NAMES.GDN_LIST)?.run(
      message,
      { option: OPTIONS.ROLES },
      false,
    );

    const roleCollector = getRoleCollector(
      tag,
      this.client,
      guild,
      'specify a "verified goon" Role ID from the list above:',
    );
    const roleResp = await roleCollector.obtain(message);
    const roleID = (roleResp.values as RoleArgs)?.roleID;

    if (roleResp.cancelled) {
      logger.info(tag, 'User cancelled, exiting');

      return message.reply('command cancelled, no action was taken.');
    } else if (!roleID) {
      logger.info(tag, 'User did not specify a roleID, exiting');

      return message.reply(oneLine`
        a role ID is required to continue. Feel free to run ${commandPrefix}${this.name} to try
        again.
      `);
    }

    /**
     * Prompt for a logging channel
     */
    logger.info(tag, 'Prompting for a logging channel ID');

    await this.client.registry.commands.get(CMD_NAMES.GDN_LIST)?.run(
      message,
      { option: OPTIONS.CHANNELS },
      false,
    );

    const channelCollector = getChannelCollector(
      tag,
      this.client,
      guild,
      'specify an "auth logging" Channel ID from the list above:',
    );
    const channelResp = await channelCollector.obtain(message);
    const channelID = (channelResp.values as ChannelArgs)?.channelID;

    if (channelResp.cancelled) {
      logger.info(tag, 'User cancelled, exiting');

      return message.reply('command cancelled, no action was taken.');
    } else if (!channelID) {
      logger.info(tag, 'User did not specify a roleID, exiting');

      return message.reply(oneLine`
        a channel ID is required to continue. Feel free to run ${commandPrefix}${this.name} to try
        again.
      `);
    }

    // The argCollector took care of validating roleID and channelID so we can force these to not
    // be undefined
    const role = guild.roles.cache.get(roleID)!;
    const channel = guild.channels.cache.get(channelID)!;

    /**
     * Update guild with role and channel IDs
     */
    const details: APIGuildAuthme = {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    };

    logger.info({ ...tag, details }, 'Submitting server to GDN API');

    try {
      await axiosGDN.patch(`${GDN_URLS.GUILDS}/${guild.id}`, details);
    } catch (err) {
      logger.error({ ...tag, err }, 'Error submitting guild data to GDN API');
      throw err;
    }

    return message.reply(stripIndents`
      ${oneLine`
        \`!authme\` is now available for use on this server!
        Authed users will be automatically assigned the **${role.name}** role,
        and auth confirmation messages will be logged to the **#${channel.name}** channel :bee:
      `}

      ${oneLine`
        You can update either of these values at any time by re-running
        \`${commandPrefix}${this.name}\`.
      `}
    `);
  }
}
