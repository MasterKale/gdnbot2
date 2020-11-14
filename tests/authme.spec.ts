import moxios from 'moxios';
import { oneLine, stripIndents } from 'common-tags';

import AuthmeCommand from '../src/commands/auth/authme';

// jest.unmock('../src/helpers/logger');
import logger from '../src/helpers/logger';
import { axiosGDN, GDN_URLS } from '../src/helpers/axiosGDN';
import { axiosGoonAuth, GOON_AUTH_URLS } from '../src/helpers/axiosGoonAuth';
import { SA_URLS } from '../src/helpers/axiosSA';
import { CommandoClient, CommandoMessage } from 'discord.js-commando';
import { Role, TextChannel, GuildMember, HTTPError } from 'discord.js';

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
} as unknown as Role;
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

// An instance of a Member
const member = {
  id: memberID,
  user: {
    tag: 'foobar',
  },
  roles: {
    cache: {
      get: () => [],
    },
    add: jest.fn(),
  },
  edit: jest.fn(),
  send: jest.fn().mockImplementation(() => ({
    channel: userDM,
    delete: jest.fn(),
  })),
} as unknown as GuildMember;

// An instance of a Guild
const _guildRoles = [authRole];
const _guildChannels = [logChannel];
const guild = {
  id: guildID,
  name: 'Test Guild',
  roles: {
    fetch: jest.fn().mockImplementation(
      (_id) => Promise.resolve(_id === roleID ? _guildRoles[0] : null),
    ),
    cache: {
      get () { return _guildRoles; },
      set () {},
    },
  },
  channels: {
    cache: {
      get: jest.fn().mockImplementation(
        (_id) => _id === channelID ? _guildChannels[0] : null,
      ),
    },
  },
};

// An instance of a Message
const message = {
  id: 'messageIdHere',
  guild,
  member,
  say: jest.fn(),
  reply: jest.fn(),
  client: { commandPrefix: '!' },
  command: { name: 'authme' },
} as unknown as CommandoMessage;

// Good Profile
const goodSAProfileHTML = oneLine`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Document</title>
</head>
<body>
  <table>
    <tr>
      <td class="info">
        <p>
          There have been <b>123</b> posts made by <i>${saUsername}</i>, an
          average of 0.00 posts per day, since registering on <b>Apr 11, 2012</b>.
          <i>Goon API</i> claims to be a porpoise.
        </p>
      </td>
      <td><dd class="registered">Aug 28, 2008</td>
    </tr>
  </table>
  <input type="hidden" name="userid" value="${saID}" />
</body>
</html>
`;

// Bad Profile: Changed user ID SA input
const badUserIDSAProfileHTML = oneLine`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Document</title>
</head>
<body>
  <table>
    <tr>
      <td class="info">
        <p>
          There have been <b>123</b> posts made by <i>${saUsername}</i>, an
          average of 0.00 posts per day, since registering on <b>Apr 11, 2012</b>.
          <i>Goon API</i> claims to be a porpoise.
        </p>
      </td>
      <td><dd class="registered">Aug 28, 2008</td>
    </tr>
  </table>
  <input type="hidden" name="id" value="${saID}" />
</body>
</html>
`;

// Bad Profile: Insufficient user post count
const badPostCountSAProfileHTML = oneLine`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Document</title>
</head>
<body>
  <table>
    <tr>
      <td class="info">
        <p>
          There have been <b>12</b> posts made by <i>${saUsername}</i>, an
          average of 0.00 posts per day, since registering on <b>Apr 11, 2012</b>.
          <i>Goon API</i> claims to be a porpoise.
        </p>
      </td>
      <td><dd class="registered">Aug 28, 2008</td>
    </tr>
  </table>
  <input type="hidden" name="userid" value="${saID}" />
</body>
</html>
`;

// Bad Profile: Profile page markup changed significantly
const badChangedMarkupSAProfileHTML = oneLine`
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Document</title>
</head>
<body>
  <table>
    <tr>
      <td class="post-count">
        <p>
          There have been <b>12</b> posts made by <i>${saUsername}</i>, an
          average of 0.00 posts per day, since registering on <b>Apr 11, 2012</b>.
        </p>
      </td>
      <td class="genderInfo">
        <p>
          <i>Goon API</i> claims to be a porpoise.
        </p>
      </td>
      <td><dd class="registered">Aug 28, 2008</td>
    </tr>
  </table>
  <input type="hidden" name="userid" value="${saID}" />
</body>
</html>
`;

const GDN_GUILD = `${axiosGDN.defaults.baseURL}${GDN_URLS.GUILDS}/${guildID}`;
const GDN_MEMBER = `${axiosGDN.defaults.baseURL}${GDN_URLS.MEMBERS}/${memberID}`;
const GDN_SA = `${axiosGDN.defaults.baseURL}${GDN_URLS.SA}/${saID}`;
const GDN_DB = `${axiosGDN.defaults.baseURL}${GDN_URLS.MEMBERS}`;

const GAUTH_GET = `${axiosGoonAuth.defaults.baseURL}/${GOON_AUTH_URLS.GET_HASH}`;
const GAUTH_CONFIRM = `${axiosGoonAuth.defaults.baseURL}/${GOON_AUTH_URLS.CONFIRM_HASH}`;

const SA_PROFILE = `${SA_URLS.PROFILE}&username=${saUsername}`;

const authme = new AuthmeCommand({} as unknown as CommandoClient);

/**
 * Test cases testing the entire !authme command flow
 */
test('[HAPPY PATH] adds role to user that has never authed before', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 200,
    response: {
      validated: true,
    },
  });

  // SA username returns a valid SA profile
  moxios.stubRequest(SA_PROFILE, {
    status: 200,
    response: goodSAProfileHTML,
  });

  // SA ID hasn't been used by another account
  moxios.stubRequest(GDN_SA, {
    status: 404,
  });

  // DB accepts new user
  moxios.stubRequest(GDN_DB, {
    status: 200,
  });

  await authme.run(message, { username: saUsername });

  expect(member.roles.add).toHaveBeenCalledWith(authRole, 'GDN: Successful Auth');
  expect(logChannel.send).toHaveBeenCalledWith(`${member.user} (SA: ${saUsername}) successfully authed`);
});

test('skips hash check for user that has authed before and is not blacklisted', async () => {
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
    },
  });

  // SA ID is not blacklisted
  moxios.stubRequest(GDN_SA, {
    status: 200,
    response: {
      blacklisted: false,
    },
  });

  await authme.run(message, { username: saUsername });

  expect(member.roles.add).toHaveBeenCalledWith(authRole, 'GDN: Successful Auth');
  expect(logChannel.send).toHaveBeenCalledWith(`${member.user} (SA: ${saUsername}) successfully authed`);
});

test('messages channel when Guild is not enrolled', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 404,
  });

  await authme.run(message, { username: saUsername });

  expect(message.reply).toHaveBeenCalledWith('This server is not enrolled in the Goon Discord Network. Please have an admin enroll the server and then enable auth.');
});

test('messages channel and logs error when error occurs when checking Guild enrollment', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 500,
  });

  await authme.run(message, { username: saUsername });

  expect(message.say).toHaveBeenLastCalledWith('A system error occurred while attempting to verify guild enrollment in GDN. The bot owner has been notified. Thank you for your patience while they get this fixed!');
  expect(logger.error).toHaveBeenCalledWith({ req_id: message.id, err: new Error('Request failed with status code 500') }, 'Error checking for server info, exiting');
});

test('messages channel with blacklist rejection when user is blacklisted', async () => {
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
    },
  });

  // SA ID is blacklisted
  moxios.stubRequest(GDN_SA, {
    status: 200,
    response: {
      blacklisted: true,
    },
  });

  await authme.run(message, { username: saUsername });

  expect(message.say).toHaveBeenCalledWith('You are blacklisted from the Goon Discord Network. You may appeal this decision here: https://discord.gg/vH8uVUE');
});

test('messages channel with invalid role reason when role registered by admin is no good', async () => {
  // Guild is enrolled in GDN but has bad Role ID
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: 'badRoleID',
      logging_channel_id: channelID,
    },
  });

  // Member has authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 200,
    response: {
      sa_id: saID,
    },
  });

  // SA ID is not blacklisted
  moxios.stubRequest(GDN_SA, {
    status: 200,
    response: {
      blacklisted: false,
    },
  });

  await authme.run(message, { username: saUsername });

  expect(message.say).toHaveBeenCalledWith("`!authme` doesn't appear to be enabled here, or is misconfigured. Please contact a server admin and ask them to run `!gdn_enable_authme`.");
});

test('logs message when no log channel is specified for auth success message', async () => {
  // Guild is enrolled in GDN but has no log channel ID
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: null,
    },
  });

  // Member has authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 200,
    response: {
      sa_id: saID,
    },
  });

  // SA ID is blacklisted
  moxios.stubRequest(GDN_SA, {
    status: 200,
    response: {
      blacklisted: false,
    },
  });

  await authme.run(message, { username: saUsername });

  expect(logger.info).toHaveBeenCalledWith({ req_id: message.id }, 'No channel ID provided');
});

test('logs message when an invalid log channel is specified for auth success message', async () => {
  // Guild is enrolled in GDN but has no log channel ID
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: 'badChannelId',
    },
  });

  // Member has authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 200,
    response: {
      sa_id: saID,
    },
  });

  // SA ID is blacklisted
  moxios.stubRequest(GDN_SA, {
    status: 200,
    response: {
      blacklisted: false,
    },
  });

  await authme.run(message, { username: saUsername });

  expect(logger.info).toHaveBeenCalledWith({ req_id: message.id }, 'No text channel found by that ID');
});

test('messages user when hash could not be confirmed in their profile', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 200,
    response: {
      validated: false,
    },
  });

  await authme.run(message, { username: saUsername });

  expect(member.send).toHaveBeenLastCalledWith(`The hash could not be found. Enter **!authme ${saUsername}** back in the server to try again :getout:`);
});

test('messages user that an error occurred when an unexpected hash request response is returned', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth errors out while generating hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 500,
  });

  await authme.run(message, { username: saUsername });

  expect(message.say).toHaveBeenLastCalledWith('A system error occurred while generating a hash to help you to verify your SA membership. The bot owner has been notified. Thank you for your patience while they get this fixed!');
});

test('messages user that an error occurred when an unexpected hash confirmation response is returned', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 500,
  });

  await authme.run(message, { username: saUsername });

  expect(member.send).toHaveBeenLastCalledWith("A system error occurred while confirming the hash's existence in your SA profile. The bot owner has been notified. Thank you for your patience while they get this fixed!");
});

test('messages user and logs error when an SA ID could not be retrieved for their given username', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 200,
    response: {
      validated: true,
    },
  });

  // SA username returns an unexpected SA profile page structure
  moxios.stubRequest(SA_PROFILE, {
    status: 200,
    response: badUserIDSAProfileHTML,
  });

  await authme.run(message, { username: saUsername });

  expect(member.send).toHaveBeenLastCalledWith('I could not find an ID on the SA profile page for the username you provided. The bot owner has been notified. Thank you for your patience while they get this fixed!');
  expect(logger.error).toHaveBeenCalledWith({ req_id: message.id }, 'No user ID was found');
});

test('messages channel that member is blacklisted when their SA ID is linked to a blacklisted GDN account', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 200,
    response: {
      validated: true,
    },
  });

  // SA username returns a valid SA profile
  moxios.stubRequest(SA_PROFILE, {
    status: 200,
    response: goodSAProfileHTML,
  });

  // SA ID hasn't been used by another account
  moxios.stubRequest(GDN_SA, {
    status: 200,
    response: {
      blacklisted: true,
    },
  });

  await authme.run(message, { username: saUsername });

  expect(message.say).toHaveBeenLastCalledWith('You are blacklisted from the Goon Discord Network. You may appeal this decision here: https://discord.gg/vH8uVUE');
});

test('messages channel and logs error when an error occurs while checking if user has authed before', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 500,
  });

  await authme.run(message, { username: saUsername });

  expect(message.say).toHaveBeenLastCalledWith('A system error occurred while attempting to verify if you had authed before. The bot owner has been notified. Thank you for your patience while they get this fixed!');
  expect(logger.error).toHaveBeenCalledWith({ req_id: message.id, err: new Error('Request failed with status code 500') }, 'Error checking if member has authed');
});

test('messages channel when user post count is too low', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 200,
    response: {
      validated: true,
    },
  });

  // SA username returns a valid SA profile
  moxios.stubRequest(SA_PROFILE, {
    status: 200,
    response: badPostCountSAProfileHTML,
  });

  await authme.run(message, { username: saUsername });

  expect(message.say).toHaveBeenLastCalledWith('Your SA account has an insufficient posting history. Please try again later.');
});

test('messages user and logs error when an error occurs while retrieving SA profile', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 200,
    response: {
      validated: true,
    },
  });

  // Error occurs while checking retrieving SA profile
  moxios.stubRequest(SA_PROFILE, {
    status: 500,
  });

  await authme.run(message, { username: saUsername });

  expect(member.send).toHaveBeenLastCalledWith('A system error occurred while reading your SA profile. The bot owner has been notified. Thank you for your patience while they get this fixed!');
  expect(logger.error).toHaveBeenCalledWith({ req_id: message.id, err: new Error('Request failed with status code 500') }, 'Error retrieving SA profile page');
});

test('messages user when bot is unable to parse post count from profile', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 200,
    response: {
      validated: true,
    },
  });

  // SA username returns a valid SA profile
  moxios.stubRequest(SA_PROFILE, {
    status: 200,
    response: badChangedMarkupSAProfileHTML,
  });

  await authme.run(message, { username: saUsername });

  expect(member.send).toHaveBeenLastCalledWith('I could not find a post count on the SA profile page for the username you provided. The bot owner has been notified. Thank you for your patience while they get this fixed!');
  expect(logger.error).toHaveBeenCalledWith({ req_id: message.id }, 'No post count was found');
});

test('logs error when error occurs while adding user to database', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 200,
    response: {
      validated: true,
    },
  });

  // SA username returns a valid SA profile
  moxios.stubRequest(SA_PROFILE, {
    status: 200,
    response: goodSAProfileHTML,
  });

  // SA ID hasn't been used by another account
  moxios.stubRequest(GDN_SA, {
    status: 404,
  });

  // DB accepts new user
  moxios.stubRequest(GDN_DB, {
    status: 500,
  });

  await authme.run(message, { username: saUsername });

  expect(logger.error).toHaveBeenCalledWith({ req_id: message.id, err: new Error('Request failed with status code 500') }, 'Error inserting user');
});

test('logs error 50013 error occurs while assigning role to authed user', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 200,
    response: {
      validated: true,
    },
  });

  // SA username returns a valid SA profile
  moxios.stubRequest(SA_PROFILE, {
    status: 200,
    response: goodSAProfileHTML,
  });

  // SA ID hasn't been used by another account
  moxios.stubRequest(GDN_SA, {
    status: 404,
  });

  // DB accepts new user
  moxios.stubRequest(GDN_DB, {
    status: 200,
  });

  message.member.roles.add = jest.fn().mockImplementation(() => {
    throw new HTTPError('API Error could not add role to user', 'Error', 50013, 'PUT', '/userroles');
  });

  await authme.run(message, { username: saUsername });

  expect(logger.error).toHaveBeenCalledWith(
    { req_id: message.id, err: new Error('API Error could not add role to user') },
    `Error in guild ${authRole.guild.name} adding role ${authRole.name} to member ${member.user.tag} (${member.id})`,
  );
});

test('reports misconfiguration in channel when 50013 error occurs while assigning role to authed user', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: channelID,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 200,
    response: {
      validated: true,
    },
  });

  // SA username returns a valid SA profile
  moxios.stubRequest(SA_PROFILE, {
    status: 200,
    response: goodSAProfileHTML,
  });

  // SA ID hasn't been used by another account
  moxios.stubRequest(GDN_SA, {
    status: 404,
  });

  // DB accepts new user
  moxios.stubRequest(GDN_DB, {
    status: 200,
  });

  message.member.roles.add = jest.fn().mockImplementation(() => {
    throw new HTTPError('API Error could not add role to user', 'Error', 50013, 'PUT', '/userroles');
  });

  await authme.run(message, { username: saUsername });

  expect(logChannel.send).toHaveBeenCalledWith(stripIndents`
    @here An attempt was made to apply the **${authRole.name}** role to ${member.user}, but none of the bot's own roles are higher than the **${authRole.name}** role. Alternatively, if this member is an admin then they may be assigned a role that is positioned higher in the Roles hierarchy than any of the bot's roles.

    To fix this for future members, please go into **Server Settings > Roles** and apply a role to GDNBot that is _above_ the **${authRole.name}** role.

    Afterwards you will need to manually apply the **${authRole.name}** role to ${member.user}.
  `);
});

test('logs error when 50013 error occurs while assigning role to authed user but no log channel specified', async () => {
  // Guild is enrolled in GDN
  moxios.stubRequest(GDN_GUILD, {
    status: 200,
    response: {
      validated_role_id: roleID,
      logging_channel_id: undefined,
    },
  });

  // Member has never authed before
  moxios.stubRequest(GDN_MEMBER, {
    status: 404,
  });

  // GoonAuth generates hash for user
  moxios.stubRequest(GAUTH_GET, {
    status: 200,
    response: {
      hash: 'abc',
    },
  });

  // User responds with "done"
  userDM.awaitMessages.mockResolvedValue(['done']);

  // GoonAuth is able to find hash in SA profile
  moxios.stubRequest(GAUTH_CONFIRM, {
    status: 200,
    response: {
      validated: true,
    },
  });

  console.log(SA_PROFILE);

  // SA username returns a valid SA profile
  moxios.stubRequest(SA_PROFILE, {
    status: 200,
    response: goodSAProfileHTML,
  });

  // SA ID hasn't been used by another account
  moxios.stubRequest(GDN_SA, {
    status: 404,
  });

  // DB accepts new user
  moxios.stubRequest(GDN_DB, {
    status: 200,
  });

  message.member.roles.add = jest.fn().mockImplementation(() => {
    throw new HTTPError('API Error could not add role to user', 'Error', 50013, 'PUT', '/userroles');
  });

  await authme.run(message, { username: saUsername });

  expect(logger.error).toHaveBeenCalledWith({ req_id: message.id }, oneLine`
    Unable to send diagnostic message to Guild because no auth logging channel was
    configured. Manual intervention will be required.
  `);
});
