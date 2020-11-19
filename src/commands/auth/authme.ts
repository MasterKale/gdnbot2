import { DMChannel } from 'discord.js';
import { CommandoClient, CommandoMessage } from 'discord.js-commando';
import { stripIndents, oneLine } from 'common-tags';

// Helpers
import GDNCommand from '../../helpers/GDNCommand';
import logger, { getLogTag } from '../../helpers/logger';
import cleanupMessages from '../../helpers/cleanupMessages';
import {
  CMD_GROUPS,
  CMD_NAMES,
  API_ERROR,
  AUTH_MIN_ACCOUNT_AGE_DAYS,
} from '../../helpers/constants';

// Checks
import isMemberBlacklisted from '../../checks/isMemberBlacklisted';

// Auth helpers
import startAuthCheck from '../../helpers/auth/startAuthCheck';
import confirmHashPlacementCollector from '../../helpers/auth/confirmHashPlacementCollector';

// Auth actions
import getHash from '../../helpers/auth/getHash';
import confirmHash from '../../helpers/auth/confirmHash';
import getSAProfile from '../../helpers/auth/getSAProfile';
import getSAID from '../../helpers/auth/getSAID';
import getSAAge from '../../helpers/auth/getSAAge';
import addRoleAndLog from '../../helpers/auth/addRoleAndLog';
import addUserToDB from '../../helpers/auth/addUserToDB';
import logCommandStart from '../../helpers/logCommandStart';

interface AuthmeCommandArgs {
  username: string;
}

export default class AuthmeCommand extends GDNCommand {
  constructor (client: CommandoClient) {
    super(client, {
      name: CMD_NAMES.AUTHME,
      group: CMD_GROUPS.AUTH,
      memberName: 'authme',
      description: 'Authenticate your membership to the SA forums',
      details: stripIndents`
        ${oneLine`
          To confirm that you have an active SA account, type
          **${client.commandPrefix}${CMD_NAMES.AUTHME} SA-Username-Here**. You will be DM'd with
          further instructions :bee:
        `}
      `,
      examples: [
        'authme IAmKale',
        'authme Tempus Thales',
      ],
      guildOnly: true,
      args: [
        {
          key: 'username',
          label: 'SA Username',
          prompt: 'what is your SA username?',
          type: 'string',
        },
      ],
    });
  }

  async run (message: CommandoMessage, { username }: AuthmeCommandArgs) {
    const { guild, member } = message;

    // Prepare a tag for logging
    const tag = getLogTag(message.id);

    logCommandStart(tag, message);

    /**
     * PERFORMING AUTH CHECKS
     */
    const {
      canProceed,
      reason: checkReason,
      alreadyAuthed,
      validatedRole,
      validatedChannel,
    } = await startAuthCheck(
      tag,
      guild,
      member,
      true,
    );

    if (!canProceed) {
      return message.reply(`${checkReason}`);
    }

    if (alreadyAuthed) {
      logger.info(tag, 'User has already authed, bypassing hash check');

      await addRoleAndLog(
        tag,
        member,
        username,
        // Role will be valid by the time we get here
        validatedRole!,
        validatedChannel,
        message,
      );

      return null;
    }

    /**
     * GENERATING A VERIFICATION HASH
     */
    const { hash, reason: hashReason } = await getHash(tag, member, username);

    if (!hash) {
      return message.say(hashReason);
    }

    /**
     * SENDING HASH AND INSTRUCTIONS AS PM
     */
    logger.info(tag, 'Sending hash + instructions to member');

    let hashMessage;
    try {
      hashMessage = await member.send(stripIndents`
        ${oneLine`
          You want access? You have **five minutes** to get this string into your SA profile
          (anywhere in the **Additional Information** section here
          https://forums.somethingawful.com/member.php?action=editprofile):
        `}

        **${hash}**

        ${oneLine`
          After you've completed this, return **here** and respond with **done** to verify
          your SA membership.
        `}
      `);
    } catch (err) {
      if (err.code === API_ERROR.CANNOT_MESSAGE_USER) {
        return message.reply(stripIndents`
          ${oneLine`
            your privacy settings prevent me from sending you further instructions as DM's. Please
            temporarily toggle on "Allow direct messages from server members" for this server from
            your privacy settings before trying the command again :bee:
          `}

          ${oneLine`
            If you need help with this, please check out the
            "**Selective Hearing: Direct Message Edition**" section of this Discord support article:
            https://support.discordapp.com/hc/en-us/articles/217916488-Blocking-Privacy-Settings-
          `}
        `);
      } else {
        logger.error({ ...tag, err }, 'Error sending hash to user');
        throw err;
      }
    }

    /**
     * WAITING FOR USER RESPONSE TO TRIGGER HASH PLACEMENT VERIFICATION
     */
    logger.info(tag, 'Awaiting response from member');

    const confirmation = await confirmHashPlacementCollector((hashMessage.channel as DMChannel));

    // We're done with the hash, so remove it
    cleanupMessages([hashMessage]);

    if (confirmation.cancelled) {
      logger.warn(tag, 'User did not confirm hash placement, exiting');

      return member.send(oneLine`
        You have not been authenticated. Please feel free to try again back in **${guild.name}**.
      `);
    }

    /**
     * VERIFYING HASH PLACEMENT
     */
    logger.info(tag, 'Member responded, continuing');

    // Check SA profile for hash
    const { confirmed, reason: confirmReason } = await confirmHash(tag, member, username);

    if (!confirmed) {
      return member.send(`${confirmReason}`);
    }

    /**
     * Get SA profile for analysis
     */
    const { profile, reason: reasonErrorProfileLoad } = await getSAProfile(tag, username);

    if (!profile) {
      return member.send(`${reasonErrorProfileLoad}`);
    }

    /**
     * RETRIEVING SA ID FROM USER PROFILE
     */
    const { id: saID, reason: reasonNoID } = await getSAID(tag, profile);

    if (!saID) {
      return member.send(`${reasonNoID}`);
    }

    /**
     * CALCULATING ACCOUNT AGE FROM USER PROFILE
     */
    const { age, reason: reasonNoRegDate } = await getSAAge(tag, profile);

    // Reg dates in the past will have a negative age
    if (age === undefined) {
      return member.send(`${reasonNoRegDate}`);
    }

    if (age < AUTH_MIN_ACCOUNT_AGE_DAYS) {
      logger.info(tag, 'User account age in days is below minimum, exiting');
      return member.send(oneLine`
        Your SA account must be at least ${AUTH_MIN_ACCOUNT_AGE_DAYS} days old. Please try again
        later.
      `);
    }

    /**
     * CHECKING IF USER IS BLACKLISTED BY SA ID
     */
    const { isBlacklisted, reason: blacklistedReason } = await isMemberBlacklisted(tag, saID);

    if (isBlacklisted) {
      // Purposefully send this to the Guild channel so that admins can notice blacklisted users
      return message.say(blacklistedReason);
    }

    /**
     * ADDING AUTH ROLE AND LOGGING MESSAGE
     */
    await addRoleAndLog(
      tag,
      member,
      username,
      // Role will be valid by the time we get here
      validatedRole!,
      validatedChannel,
      message,
    );

    /**
     * INSERTING USER INTO DATABASE
     */
    await addUserToDB(
      tag,
      member,
      saID,
      username,
    );

    return null;
  }
}
