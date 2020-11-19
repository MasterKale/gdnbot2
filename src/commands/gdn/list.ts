import { CommandoClient, CommandoMessage } from 'discord.js-commando';
import capitalize from 'capitalize';

import GDNEmbed from '../../helpers/GDNEmbed';
import GDNCommand from '../../helpers/GDNCommand';
import listTextChannels from '../../helpers/gdn/listTextChannels';
import listRoles from '../../helpers/gdn/listRoles';
import { CMD_GROUPS, CMD_NAMES } from '../../helpers/constants';
import logger, { getLogTag } from '../../helpers/logger';
import logCommandStart from '../../helpers/logCommandStart';

interface ListCommandArgs {
  option: string;
}

export const OPTIONS = {
  ROLES: 'roles',
  CHANNELS: 'channels',
};

const oneOf = [
  OPTIONS.CHANNELS,
  OPTIONS.ROLES,
];
const oneOfFormatted = oneOf.map(opt => `\`${opt}\``).join(', ');

/**
 * !list
 *
 * Can be used to display a list of roles, channels, etc... (see `options` above) for whatever
 * server the command is run in
 */
export default class ListCommand extends GDNCommand {
  constructor (client: CommandoClient) {
    super(client, {
      name: CMD_NAMES.GDN_LIST,
      group: CMD_GROUPS.GDN,
      memberName: 'list',
      description: 'View server roles or channels',
      guildOnly: true,
      userPermissions: ['MANAGE_ROLES', 'MANAGE_CHANNELS'],
      args: [
        {
          key: 'option',
          prompt: `what would you like a list of?\nOptions: ${oneOfFormatted}\n`,
          type: 'string',
          oneOf,
        },
      ],
      examples: [
        'gdn_list roles',
        'gdn_list channels',
      ],
    });
  }

  run (message: CommandoMessage, { option }: ListCommandArgs) {
    const { id, guild } = message;

    const tag = getLogTag(id);

    logCommandStart(tag, message);

    logger.info(tag, `Displaying list of ${option}`);

    const listEmbed = new GDNEmbed()
      .setTitle(`${guild.name} ${capitalize(option)}:`);

    switch (option) {
      case OPTIONS.CHANNELS:
        listTextChannels(guild).each(channel => {
          listEmbed.addField(channel.name, channel.id);
        });
        break;
      case OPTIONS.ROLES:
        listRoles(guild).cache.each(role => {
          listEmbed.addField(role.name, role.id);
        });
        break;
      default:
    }

    return message.embed(listEmbed);
  }
}
