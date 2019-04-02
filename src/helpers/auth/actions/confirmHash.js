const { oneLine } = require('common-tags');

const { axiosGoonAuth, GOON_AUTH_URLS } = require('../../axiosGoonAuth');
const logger = require('../../logger');

const reasonNotValidated = oneLine`
  Lowtax is disappointed in you. Enter **!authme {0}** back in the server to try again :getout:
`;

const errorNoValidate = oneLine`
  An error occurred while confirming the hash's existence in your SA profile. The bot owner has
  been notified. Thank you for your patience while they get this fixed!
`;

/**
 * Confirm via GoonAuth that the user placed the hash in their profile
 *
 * @param {object} tag - The output from a call to logger.getLogTag()
 * @param {Member} member - The Discord member attempting to auth
 * @param {string} username - The Discord member's SA username
 * @returns {object} - { validated, reason? }
 */
const confirmHash = async ({ tag, member, username }) => {
  try {
    logger.info(`Confirming hash placement for ${member.name} (SA: ${username})`);
    const { data } = await axiosGoonAuth.post(GOON_AUTH_URLS.CONFIRM_HASH, { username });
    const { validated } = data;

    if (!validated) {
      logger.warn(tag, 'Hash missing from SA profile');
      return {
        validated,
        reason: reasonNotValidated
      };
    }

    logger.info(tag, 'Confirmed hash in SA profile');
    return {
      validated
    };
  } catch (err) {
    logger.error({ ...tag, err }, 'Error confirming hash');
    return {
      validated: false,
      reason: errorNoValidate
    };
  }
};

module.exports = confirmHash;