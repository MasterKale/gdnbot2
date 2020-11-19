/* eslint-disable import/first */
import { Collection, Role, TextChannel, VoiceChannel, Guild } from 'discord.js';
import { CommandoClient, CommandoMessage } from 'discord.js-commando';

// Mock GDNEmbed so we can check its methods
jest.mock('../src/helpers/GDNEmbed');

import GDNEmbed from '../src/helpers/GDNEmbed';

import ListCommand from '../src/commands/gdn/list';

const list = new ListCommand({} as unknown as CommandoClient);

const ROLE_1 = {
  id: 123,
  name: 'Role 1',
} as unknown as Role;
const ROLE_2 = {
  id: 456,
  name: 'Role 2',
} as unknown as Role;
const roles = new Collection([
  [ROLE_1, ROLE_1],
  [ROLE_2, ROLE_2],
]);

const TEXT_CHANNEL_1 = {
  id: 123,
  name: 'Text Channel 1',
  type: 'text',
} as unknown as TextChannel;
const VOICE_CHANNEL = {
  id: 456,
  name: 'Voice Channel',
  type: 'voice',
} as unknown as VoiceChannel;
const TEXT_CHANNEL_2 = {
  id: 789,
  name: 'Text Channel 2',
  type: 'text',
} as unknown as TextChannel;
const channels = new Collection<TextChannel | VoiceChannel, TextChannel | VoiceChannel>([
  [TEXT_CHANNEL_1, TEXT_CHANNEL_1],
  [VOICE_CHANNEL, VOICE_CHANNEL],
  [TEXT_CHANNEL_2, TEXT_CHANNEL_2],
]);

const guild = {
  name: 'testGuild',
  roles: {
    cache: roles,
  },
  channels: {
    cache: channels,
  },
}as unknown as Guild;

const message = {
  command: {
    name: 'list',
  },
  member: {
    user: {
      tag: 'IAmKale#9999'
    },
  },
  guild,
  embed: jest.fn(),
  client: { commandPrefix: '!' },
} as unknown as CommandoMessage;

test('return a GDNEmbed', () => {
  list.run(message, { option: 'roles' });

  expect((message.embed as jest.Mock).mock.calls[0][0]).toBeInstanceOf(GDNEmbed);
});

test('add all guild roles to embed', () => {
  list.run(message, { option: 'roles' });

  const embed = (message.embed as jest.Mock).mock.calls[0][0];

  expect(embed.addField).toHaveBeenCalledTimes(2);
});

test('add only text channels to embed', () => {
  list.run(message, { option: 'channels' });

  const embed = (message.embed as jest.Mock).mock.calls[0][0];

  expect(embed.addField).toHaveBeenCalledTimes(2);
});
