import { oneLine } from 'common-tags';
import { DateTime } from 'luxon';

import logger, { LogTag } from '../logger';

interface SAAge {
  age?: number;
  reason?: string;
}

/**
 * Calculate how long the user has been a member of SA via their reg date
 */
export default async function getSAAge (tag: LogTag, profile: CheerioStatic): Promise<SAAge> {
  logger.info(tag, 'Calculating SA account age from reg date');

  // Prepare to parse it
  const $ = profile;

  // Try to grab the reg date
  const regDateText = $('dd.registered').text();

  /**
   * Note to self: If no reg date is found, then perhaps:
   *
   * 1) the cookies above are invalid (maybe the account is banned)
   * 2) Something about the profile page HTML changed
   * 3) Maybe the username WAS mis-spelled
   */
  if (!regDateText) {
    logger.error(tag, 'No reg date was found');
    return {
      age: undefined,
      reason: oneLine`
        I could not find a reg date on your SA profile page. The bot owner has been notified. Thank
        you for your patience while they get this fixed!
      `,
    };
  }

  logger.debug(tag, `Reg date: ${regDateText}`);

  const regDate = DateTime.fromFormat(regDateText, 'LLL d, y');
  const age = regDate.diffNow('day').days;

  logger.info(tag, `Age in days: ${age}`);
  return {
    // Reg dates in the past return from Luxon as negative numbers, so flip it to positive
    age: age * -1,
  };
}
