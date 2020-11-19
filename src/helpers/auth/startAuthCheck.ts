import { Guild, GuildMember, Role, TextChannel } from 'discord.js';

import logger, { LogTag } from '../logger';

import hasGuildEnrolled from '../../checks/hasGuildEnrolled';
import canMemberAuth from '../../checks/canMemberAuth';
import isValidAuthRole from '../../checks/isValidAuthRole';
import isValidLogChannel from '../../checks/isValidLogChannel';

export interface AuthCheckDecision {
  canProceed: boolean;
  reason?: string;
  alreadyAuthed?: boolean;
  saUsername?: string;
  validatedRole?: Role;
  validatedChannel?: TextChannel;
}

/**
 * A series of checks to perform any time an intent to authenticate is registered
 *
 * An "intent to authenticate" can be one of the following scenarios:
 *
 * - User invokes !authme
 * - User joins a server in which GDNBot resides
 */
export default async function startAuthCheck (
  tag: LogTag,
  guild: Guild,
  member: GuildMember,
  isAuthMe: boolean,
): Promise<AuthCheckDecision> {
  logger.info(
    tag,
    `Beginning auth checks for ${member.user.tag} (${member.id}) in ${guild.name} (${guild.id})`,
  );

  /**
   * Ensure that server is in GDN
   */
  const {
    isEnrolled,
    reason: guildReason,
    guildData,
  } = await hasGuildEnrolled(tag, guild);

  logger.debug({ ...tag, guildData }, 'Guild data from DB');

  if (!isEnrolled) {
    logger.info(tag, 'Guild is not enrolled, exiting');
    return {
      canProceed: false,
      reason: guildReason,
    };
  }

  if (!guildData) {
    logger.error(tag, 'Server is enrolled, but there\'s no guild data???');
    throw new Error('Server is enrolled, but no guild data available');
  }

  /**
   * Check that member can proceed with authentication
   */
  const {
    canAuth,
    reason: memberAuthReason,
    alreadyAuthed,
    saUsername,
  } = await canMemberAuth(tag, member, isAuthMe);

  if (!canAuth) {
    logger.info(tag, 'Member cannot proceed with auth, exiting');
    return {
      canProceed: false,
      reason: memberAuthReason,
    };
  }

  /**
   * Ensure that server has specified a role for auth'd users
   */
  const {
    isValid: isValidRole,
    reason: roleReason,
    guildRole: validatedRole,
  } = await isValidAuthRole(tag, guild, guildData.validated_role_id);

  if (!isValidRole) {
    logger.info(tag, 'Auth role is not valid, exiting');
    return {
      canProceed: false,
      reason: roleReason,
    };
  }

  /**
   * Check for (optional) logging channel and validate it
   */
  const {
    logChannel: validatedChannel,
  } = await isValidLogChannel(tag, guild, guildData.logging_channel_id);

  logger.info(tag, 'Auth checks passed, continuing');
  return {
    canProceed: true,
    alreadyAuthed,
    saUsername,
    validatedRole,
    validatedChannel,
  };
}
