/* eslint-disable camelcase */
import { Role } from 'discord.js';
import { CommandoClient, CommandoMessage } from 'discord.js-commando';
import { oneLine, stripIndents } from 'common-tags';

import GDNCommand from '../../helpers/GDNCommand';
import { CMD_GROUPS, CMD_NAMES, API_ERROR } from '../../helpers/constants';
import logger, { getLogTag } from '../../helpers/logger';
import logCommandStart from '../../helpers/logCommandStart';

import hasGuildEnrolled from '../../checks/hasGuildEnrolled';

interface RoleArgs {
  role: Role;
}

export default class SetDescriptionCommand extends GDNCommand {
  constructor (client: CommandoClient) {
    super(client, {
      // Prevent others from using this for now
      ownerOnly: true,
      name: CMD_NAMES.PUBLIC_TOGGLE_ROLE,
      group: CMD_GROUPS.PUBLIC,
      memberName: 'toggle_role',
      description: 'Toggle a server role on yourself',
      details: stripIndents`
        The rules for toggling are straight-forward:

        - If you specify the name of a role you __don't__ have, the role will be __added__ to you
        - If you specify the name of a role you __do__ have, the role will be __removed__ from you

        ${oneLine`
          If a role can't be toggled, it's probably because the role would grant you more
          permissions than you currently have. This bot's pretty capable, but not _that_
          capable :wink:
        `}

        _In memory of BroBot (2016 - 2019)_ :robot:
      `,
      guildOnly: true,
      examples: [
        `${CMD_NAMES.PUBLIC_TOGGLE_ROLE} LLJK`,
        `${CMD_NAMES.PUBLIC_TOGGLE_ROLE} Pusher Bot`,
      ],
      args: [
        {
          key: 'role',
          type: 'string',
          prompt: 'which role are you interested in?',
          validate: (roleName: string, message: CommandoMessage): boolean | string => {
            const { id } = message;
            const tag = getLogTag(id);

            logCommandStart(tag, message);

            logger.info(tag, `Validating role name "${roleName}"`);

            const toFind = `${roleName.toLowerCase()}`;
            const role = message.guild.roles.cache.find(
              (role) => role.name.toLowerCase() === toFind,
            );

            if (!role) {
              return oneLine`
                that doesn't appear to be a valid role. Try again.
              `;
            }

            logger.info(tag, `Found matching role "${role.name}" (${role.id})`);

            return true;
          },
          parse: (roleName: string, message: CommandoMessage): Role => {
            const { id } = message;
            const tag = getLogTag(id);

            logger.info(tag, `Parsing ${roleName}`);

            const toFind = `${roleName.toLowerCase()}`;
            return message.guild.roles.cache.find((role) => role.name.toLowerCase() === toFind)!;
          },
        },
      ],
    });
  }

  async run (message: CommandoMessage, { role }: RoleArgs) {
    const { id, guild, member } = message;

    const tag = getLogTag(id);

    /**
     * See if the server is enrolled
     */
    const { isEnrolled, guildData } = await hasGuildEnrolled(tag, guild);

    /**
     * Check if the role the user specified is the enrolled guild's "verified goon" role
     */
    if (isEnrolled && guildData?.validated_role_id) {
      const gdnRole = guild.roles.cache.get(guildData.validated_role_id);

      if (gdnRole && gdnRole.id === role.id) {
        logger.info(tag, 'User tried to toggle authme role, exiting');
        return message.reply(oneLine`
          that role cannot be toggled, please try again.
        `);
      } else {
        logger.info(tag, 'Role is not authme role and is safe to toggle');
      }
    }

    logger.info(
      tag,
      oneLine`
        Toggling role "${role.name}" in ${guild.name} (${guild.id}) on
        ${member.user.tag} (${member.id})
      `,
    );

    const hasRole = member.roles.cache.has(role.id);

    try {
      let reply;
      if (hasRole) {
        logger.info(tag, 'Member has role, removing role');
        await member.roles.remove(role, 'GDN: Toggled role off');
        reply = `you no longer have the ${role.name} role`;
      } else {
        logger.info(tag, 'Member does not have role, adding role');
        await member.roles.add(role, 'GDN: Toggled role on');
        reply = `you now have the ${role.name} role`;
      }

      return message.reply(reply);
    } catch (err) {
      if (err.code === API_ERROR.MISSING_PERMISSIONS) {
        logger.info(tag, 'User tried to toggle a role above them');
        return message.reply('that role cannot be toggled, please try again.');
      } else {
        logger.info({ ...tag, err }, 'Error toggling role');
        throw err;
      }
    }
  }
}
