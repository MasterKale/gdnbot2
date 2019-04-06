const { oneLine } = require('common-tags');

const logger = require('../../logger');
const { axiosGDN, GDN_URLS } = require('../../axiosGDN');

const reasonBlacklisted = oneLine`
  You are blacklisted from the Goon Discord Network. You may appeal this decision here:
  https://discord.gg/vH8uVUE
`;

const reasonCatchError = oneLine`
  A system error occurred while attempting to verify whether you are blacklisted from GDN. The bot
  owner has been notified. Thank you for your patience while they get this fixed!
`;

/**
 *
 * @param {object} tag - The output from a call to logger.getLogTag()
 * @param {string} saID - The user's SA ID
 * @returns {object} - { isBlacklisted, reason? }
 */
const isMemberBlacklisted = async ({ tag, saID }) => {
  logger.info(tag, 'Checking if member is blacklisted');
  try {
    logger.info(tag, 'Requesting internal GDN member profile by SA ID');
    const { data } = await axiosGDN.get(`${GDN_URLS.SA}/${saID}`);

    if (data.blacklisted) {
      logger.warn(tag, 'Member is BLACKLISTED, ignoring');
      return {
        isBlacklisted: true,
        reason: reasonBlacklisted
      };
    }

    logger.info(tag, 'Member is not blacklisted');
    return {
      isBlacklisted: false
    };
  } catch (err) {
    logger.error({ ...tag, err }, 'Error checking if member is blacklisted');
    return {
      isBlacklisted: true,
      reason: reasonCatchError
    };
  }
};

module.exports = isMemberBlacklisted;
