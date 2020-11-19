import { Guild, RoleManager } from 'discord.js';

/**
 * List all of the guild's Roles
 */
export default function listRoles (guild: Guild): RoleManager {
  return guild.roles;
}
