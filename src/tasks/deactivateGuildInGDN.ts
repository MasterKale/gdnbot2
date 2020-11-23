import { Guild } from 'discord.js';
import { AxiosError } from 'axios';

import logger, { LogTag } from '../helpers/logger';
import { axiosGDN, GDN_URLS } from '../helpers/axiosGDN';

/**
 * Soft-delete a Discord Guild in GDN
 */
export default function deactivateGuildInGDN (tag: LogTag, guild: Guild) {
  return axiosGDN.delete(`${GDN_URLS.GUILDS}/${guild.id}`)
    .then(() => {
      logger.info(tag, `Deactivated guild ${guild.name} (${guild.id}) in GDN`);
    })
    .catch((err: AxiosError) => {
      // 404 means we tried to delete a server not enrolled in GDN
      if (err.response?.status !== 404) {
        logger.error(
          { ...tag, err },
          `Error deactivating guild ${guild.name} (${guild.id}) in GDN`,
        );
      }
    });
}
