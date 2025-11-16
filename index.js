/*
Hydra-Classic (minimal) - index.js
Requirements:
- Node 18+
- Lavalink available (host/port/password in env)
Environment variables (Railway):
TOKEN - Discord bot token
PREFIX - command prefix (e.g. !)
LAVALINK_HOST - lavalink host (default: lavalink.reiyu.space)
LAVALINK_PORT - lavalink port (default: 2333)
LAVALINK_PASSWORD - lavalink password (default: yusie)

This bot accepts commands even if the message author is a bot (so BotGhost can send commands).
Commands: !join, !play <url or search>, !skip, !stop, !leave, !volume <0-100>
*/

require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Manager } = require('erela.js');
const fetch = require('node-fetch');

const TOKEN = process.env.TOKEN;
const PREFIX = process.env.PREFIX || '!';
const LAVALINK_HOST = process.env.LAVALINK_HOST || 'lavalink.reiyu.space';
const LAVALINK_PORT = process.env.LAVALINK_PORT || 2333;
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || 'yusie';

if(!TOKEN) {
  console.error('Missing TOKEN in environment variables.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const manager = new Manager({
  nodes: [
    { host: LAVALINK_HOST, port: Number(LAVALINK_PORT), password: LAVALINK_PASSWORD }
  ],
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  manager.init(client.user.id);
});

client.on('raw', (d) => manager.updateVoiceState(d));

manager.on('nodeConnect', node => {
  console.log(`Lavalink node "${node.options.identifier}" connected`);
});

manager.on('nodeError', (node, error) => {
  console.error(`Node ${node.options.identifier} error: ${error.message}`);
});

manager.on('trackStart', (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send(`▶ Now playing: **${track.title}**`);
});

manager.on('queueEnd', player => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) {
    channel.send('Queue ended, leaving voice channel.');
    player.destroy();
  }
});

async function search(query, requester) {
  const node = manager.nodes.first();
  if (!node) throw new Error('No lavalink node available');
  // Use lavalink REST search - fallback to ytsearch
  const source = query.startsWith('http') ? query : `ytsearch:${query}`;
  const res = await fetch(`http://${node.options.host}:${node.options.port}/loadtracks?identifier=${encodeURIComponent(source)}`, {
    headers: { Authorization: node.options.password }
  });
  const data = await res.json();
  return data;
}

client.on('messageCreate', async (message) => {
  try {
    if (!message.content) return;

    // Accept commands even from bots (so BotGhost can trigger)
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();

    // find voice channel from mentioned user or message author
    let voiceChannel;
    // if message mentions a user, use their voice channel
    if (message.mentions.users.size) {
      const m = message.mentions.users.first();
      const member = message.guild.members.cache.get(m.id);
      if (member && member.voice.channel) voiceChannel = member.voice.channel;
    }
    // else use the message author (works if BotGhost mentions the user)
    if (!voiceChannel) {
      const authorMember = message.guild.members.cache.get(message.author.id);
      if (authorMember && authorMember.voice.channel) voiceChannel = authorMember.voice.channel;
    }

    if (cmd === 'join') {
      if (!voiceChannel) return message.channel.send('You must be in a voice channel (or mention a user in a voice channel).');
      const player = manager.create({
        guild: message.guild.id,
        voiceChannel: voiceChannel.id,
        textChannel: message.channel.id
      });
      player.connect();
      return message.channel.send(`Joined ${voiceChannel.name}`);
    }

    if (cmd === 'play') {
      const query = args.join(' ');
      if (!query) return message.channel.send('Provide a YouTube URL or search term.');
      if (!voiceChannel) return message.channel.send('User must be in a voice channel or be mentioned.');

      let player = manager.players.get(message.guild.id);
      if (!player) {
        player = manager.create({
          guild: message.guild.id,
          voiceChannel: voiceChannel.id,
          textChannel: message.channel.id,
          volume: 100
        });
        player.connect();
      } else {
        // move player if different channel
        if (player.voiceChannel !== voiceChannel.id) {
          await player.voiceChannel = voiceChannel.id;
          player.connect();
        }
      }

      const res = await search(query, message.author);
      if (!res || !res.tracks || res.tracks.length === 0) return message.channel.send('No tracks found.');

      if (res.loadType === 'PLAYLIST_LOADED') {
        for (const t of res.tracks) player.queue.add(t);
        message.channel.send(`Added playlist **${res.playlistInfo.name}** with ${res.tracks.length} tracks to the queue.`);
      } else {
        const track = res.tracks[0];
        player.queue.add(track);
        message.channel.send(`Added **${track.info ? track.info.title || track.title : track.title}** to the queue.`);
      }

      if (!player.playing && !player.paused && player.queue.totalSize > 0) player.play();
      return;
    }

    if (cmd === 'skip') {
      const player = manager.players.get(message.guild.id);
      if (!player) return message.channel.send('No music playing.');
      player.stop();
      return message.channel.send('⏭ Skipped.');
    }

    if (cmd === 'stop') {
      const player = manager.players.get(message.guild.id);
      if (!player) return message.channel.send('No music playing.');
      player.queue.clear();
      player.stop();
      player.destroy();
      return message.channel.send('⏹ Stopped and left voice channel.');
    }

    if (cmd === 'leave') {
      const player = manager.players.get(message.guild.id);
      if (player) player.destroy();
      return message.channel.send('Left the voice channel.');
    }

    if (cmd === 'volume') {
      const player = manager.players.get(message.guild.id);
      if (!player) return message.channel.send('No music playing.');
      const vol = parseInt(args[0]);
      if (isNaN(vol) || vol < 0 || vol > 100) return message.channel.send('Volume must be between 0 and 100.');
      player.setVolume(vol);
      return message.channel.send(`🔊 Volume set to ${vol}%`);
    }

  } catch (err) {
    console.error('Error handling message:', err);
    if (message && message.channel) message.channel.send('An error occurred: ' + err.message);
  }
});

client.login(TOKEN);
