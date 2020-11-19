import { SnowflakeUtil } from 'discord.js';

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

export const getLogTag = (id: string) => ({ req_id: id || SnowflakeUtil.generate() });

export default loggerMock;
