import { CommandoClient } from 'discord.js-commando';

import updateServerCountActivity from '../src/tasks/updateServerCountActivity';

// jest.unmock('../src/helpers/logger');
import logger, { getLogTag } from '../src/helpers/logger';

const bot = {
  guilds: {
    cache: {
      size: 4,
    },
  },
  user: {
    setActivity: jest.fn(),
  },
} as unknown as CommandoClient;

const tag = getLogTag('test');

test('set bot activity to reflect current number of joined guilds', async () => {
  await updateServerCountActivity(tag, bot);

  expect(bot.user?.setActivity).toHaveBeenCalledWith(`in ${bot.guilds.cache.size} servers`);
});

test('logs updated activity string', async () => {
  await updateServerCountActivity(tag, bot);

  expect(logger.info).toHaveBeenCalledWith({"req_id": "test"}, `setting activity to "in ${bot.guilds.cache.size} servers"`);
});
