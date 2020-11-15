/* eslint-disable import/first */
import moxios from 'moxios';
import { SnowflakeUtil, GuildMember, TextChannel } from 'discord.js';

import autoAuth from '../src/tasks/autoAuth';

/**
 * User synchronous timeouts
 *
 * Requires the use of `(setTimeout as any).mock` because Jest doesn't seem to expose a convenient
 * way of typing its stubbed version of `setTimeout`
 */
jest.useFakeTimers();

// Set up SnowflakeUtil to return a constant value for easier testing
const testTag = 'test';
SnowflakeUtil.generate = jest.fn().mockImplementation(() => testTag);

// jest.unmock('../src/helpers/logger');
import logger from '../src/helpers/logger';
import { axiosGDN, GDN_URLS } from '../src/helpers/axiosGDN';

// Discord IDs
const guildID = '123';
const memberID = '456';
const roleID = '789';
const channelID = '987';

// Role and Channel
const authRole = {
  id: roleID,
  name: 'Auth Role',
  guild: {
    name: 'Test Guild',
  },
};
const logChannel = {
  id: channelID,
  name: 'Log Channel',
  send: jest.fn(),
  type: 'text',
} as unknown as TextChannel;
const userDM = {
  awaitMessages: jest.fn(),
};

// SomethingAwful user
const saUsername = 'TestGoon';
const saID = 789;

// An instance of a Guild
const _guildRoles = [authRole];
const _guildChannels = [logChannel];
const guild = {
  id: guildID,
  name: 'Test Guild',
  roles: {
    get () { return _guildRoles; },
    set () {},
    fetch: jest.fn().mockImplementation(
      (_id) => Promise.resolve(_id === roleID ? _guildRoles[0] : null),
    ),
  },
  channels: {
    cache: {
      get: jest.fn().mockImplementation(
        (_id) => _id === channelID ? _guildChannels[0] : null,
      ),
    },
  },
};

// An instance of a Member
const member = {
  id: memberID,
  user: {
    tag: 'foobar',
    get: () => memberID,
  },
  roles: {
    get: () => [],
    add: jest.fn(),
  },
  edit: jest.fn(),
  send: jest.fn().mockImplementation(() => ({
    channel: userDM,
    delete: jest.fn(),
  })),
  guild,
} as unknown as GuildMember;

const GDN_GUILD = `${axiosGDN.defaults.baseURL}${GDN_URLS.GUILDS}/${guildID}`;
const GDN_MEMBER = `${axiosGDN.defaults.baseURL}${GDN_URLS.MEMBERS}/${memberID}`;
const GDN_SA = `${axiosGDN.defaults.baseURL}${GDN_URLS.SA}/${saID}`;

test('[HAPPY PATH] add auth role to authed user when they join a GDN server', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 200,
    response: {
      sa_id: saID,
      sa_username: saUsername,
    },
  });

  // SA ID hasn't been blacklisted
  moxios.stubRequest(GDN_SA, {
    status: 200,
    response: {
      blacklisted: false,
    },
  });

  autoAuth(member);

  const timeoutFn = (setTimeout as any).mock.calls[0][0];

  await timeoutFn();

  expect(member.roles.add).toHaveBeenCalledWith(authRole, 'GDN: Successful Auth');
  expect(logChannel.send).toHaveBeenCalledWith(`${member.user} (SA: ${saUsername}) successfully authed`);
});

test('delays auto-auth by 1 second from when the member joins', () => {
  autoAuth(member);
  const timeout = (setTimeout as any).mock.calls[0][1];

  expect(timeout).toEqual(1000);
});

test('logs event noting "user joined" trigger', () => {
  autoAuth(member);

  const logMessage = (logger as jest.Mocked<typeof logger>).info.mock.calls[0][1];

  expect(logMessage).toMatch(/EVENT START: User joined/i);
});

test('does not proceed when guild is not enrolled', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 404,
  });

  autoAuth(member);

  const timeoutFn = (setTimeout as any).mock.calls[0][0];

  await timeoutFn();

  expect(logger.info).toHaveBeenLastCalledWith({ req_id: testTag }, 'Did not proceed with auto-auth');
});

test('does not proceed when user has not authed before', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has not authed
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  autoAuth(member);

  const timeoutFn = (setTimeout as any).mock.calls[0][0];

  await timeoutFn();

  expect(logger.info).toHaveBeenLastCalledWith({ req_id: testTag }, 'Did not proceed with auto-auth');
});

test('does not proceed when error occurs while checking if user has authed before', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Server errors out
  moxios.stubRequest(GDN_MEMBER, {
    status: 500,
  });

  autoAuth(member);

  const timeoutFn = (setTimeout as any).mock.calls[0][0];

  await timeoutFn();

  expect((logger.error as jest.Mock).mock.calls[0][1]).toEqual(
    /error executing autoAuth in guild/i
  );
});

test('does not proceed when user is blacklisted', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 200,
    response: {
      sa_id: saID,
      sa_username: saUsername,
    },
  });

  // SA ID has been blacklisted
  moxios.stubRequest(GDN_SA, {
    status: 200,
    response: {
      blacklisted: true,
    },
  });

  autoAuth(member);

  const timeoutFn = (setTimeout as any).mock.calls[0][0];

  await timeoutFn();

  expect(logger.info).toHaveBeenLastCalledWith({ req_id: testTag }, 'Did not proceed with auto-auth');
});

test('does not proceed when an error occurs while checking if user is blacklisted', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 200,
    response: {
      sa_id: saID,
      sa_username: saUsername,
    },
  });

  // Error occurs while checking if SA ID has been blacklisted
  moxios.stubRequest(GDN_SA, {
    status: 500,
  });

  autoAuth(member);

  const timeoutFn = (setTimeout as any).mock.calls[0][0];

  await timeoutFn();

  expect(logger.error).toHaveBeenLastCalledWith(
    { req_id: testTag, err: new Error('Request failed with status code 500') },
    `Error executing autoAuth in guild ${guild.name} (${guild.id})`,
  );
});
