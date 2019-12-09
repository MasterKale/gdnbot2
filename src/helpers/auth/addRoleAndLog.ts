import { oneLine, stripIndents } from 'common-tags';
import { GuildMember, Role, TextChannel } from 'discord.js';

import logger, { LogTag } from '../logger';

/**
 * The guild admin screwed up and didn't place the GDN role above the "authed" role. Prepare a nice
 * message for the end user instructing them to harass the admin to rectify this situation.
 */
function error50013 (member: GuildMember, role: Role): string {
  const _role = `**${role.name}**`;
  const _username = `**${member.user.tag}**`;

  return stripIndents`
    @here GDNBot just now attempted to apply the ${_role} role to ${_username}, but none of the bot's own roles are higher than the ${_role} role. Alternatively, if this member is an admin then they may be assigned a role that is positioned higher in the Roles hierarchy than the **GDN** role.

    To fix this for future members, please apply a higher role to GDNBot, or go into **Server Settings > Roles** and click-and-drag the **GDN** role to _above_ the ${_role} role.

    Afterwards you will need to manually apply the ${_role} role to ${_username}.
  `;
}

/**
 * Add the role to the user, and optionally log a successful auth message
 */
export default async function addRoleAndLog (
  tag: LogTag,
  member: GuildMember,
  saUsername: string,
  role: Role,
  channel: TextChannel,
): Promise<void> {
  logger.info(tag, 'Adding role to member');

  try {
    await member.edit({ roles: [role] }, 'GDN: Successful Auth');
  } catch (err) {
    logger.error(
      { ...tag, err },
      oneLine`
        Error in guild ${role.guild.name} adding role ${role.name} to member ${member.user.tag}
        (${member.id})
      `);
    if (err.code === 50013) {
      if (channel) {
        await channel.send(error50013(member, role));
      } else {
        logger.error(tag, oneLine`
          Unable to send diagnostic message to Guild because no auth logging channel was
          configured. Manual intervention will be required.
        `);
      }
    }
  }

  if (channel) {
    logger.info(tag, 'logging successful auth message to logging channel');
    await channel.send(`${member.user.tag} (SA: ${saUsername}) successfully authed`);
  }

  logger.info(tag, 'Informing user of successful auth');
  await member.send('You did it :getin:');
}
