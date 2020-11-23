import { Guild } from 'discord.js';
import { AxiosError } from 'axios';

import logger, { LogTag } from '../helpers/logger';
import { axiosGDN, GDN_URLS } from '../helpers/axiosGDN';

/**
 * Reset a Discord Guild's deactivated status in GDN
 */
export default function reactivateGuildInGDN (tag: LogTag, guild: Guild) {
  return axiosGDN.patch(`${GDN_URLS.GUILDS}/${guild.id}`, { deactivated: false })
    .then(() => {
      logger.info(tag, `Reactivated guild ${guild.name} (${guild.id}) in GDN`);
    })
    .catch((err: AxiosError) => {
      // 404 means we tried to reactivate a server that was never enrolled in GDN
      if (err.response?.status !== 404) {
        logger.error(
          { ...tag, err },
          `Error reactivating guild ${guild.name} (${guild.id}) in GDN`,
        );
      }
    });
}
