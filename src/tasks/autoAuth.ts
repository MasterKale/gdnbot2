import { GuildMember } from 'discord.js';

import logger, { getLogTag } from '../helpers/logger';

import startAuthCheck, { AuthCheckDecision } from '../helpers/auth/startAuthCheck';
import addRoleAndLog from '../helpers/auth/addRoleAndLog';

/**
 * A handler for the "guildMemberAdd" event, when a member joins a server the bot is on
 */
export default function autoAuth (member: GuildMember) {
  const { guild } = member;

  const tag = getLogTag();

  logger.info(tag, `[EVENT START: User joined ${guild.name}]`);

  // Wait a second before proceeding with auto-auth
  setTimeout(async () => {
    let decision: AuthCheckDecision;
    try {
      decision = await startAuthCheck(tag, guild, member, false);
    } catch (err) {
      logger.error(
        { ...tag, err },
        `Error executing autoAuth in guild ${guild.name} (${guild.id})`,
      );
      return;
    }

    if (decision.canProceed) {
      const {
        saUsername,
        validatedRole,
        validatedChannel,
      } = decision;

      await addRoleAndLog(
        tag,
        member,
        // These values will always be defined by this point
        saUsername!,
        validatedRole!,
        validatedChannel,
      );
    } else {
      logger.info(tag, 'Did not proceed with auto-auth');
    }
  }, 1000);
}
