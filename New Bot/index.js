require('dotenv').config()
const Discord = require('discord.js')
const config = require('./config')

const discordClient = new Discord.Client()

const { Readable } = require('stream');

const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);

var optin = {};

class Silence extends Readable {
  _read() {
    this.push(SILENCE_FRAME);
  }
}

const { Transform } = require('stream')

function convertBufferTo1Channel(buffer) {
  const convertedBuffer = Buffer.alloc(buffer.length / 2)

  for (let i = 0; i < convertedBuffer.length / 2; i++) {
    const uint16 = buffer.readUInt16LE(i * 4)
    convertedBuffer.writeUInt16LE(uint16, i * 2)
  }

  return convertedBuffer
}

class ConvertTo1ChannelStream extends Transform {
  constructor(source, options) {
    super(options)
  }

  _transform(data, encoding, next) {
    next(null, convertBufferTo1Channel(data))
  }
}

const googleSpeech = require('@google-cloud/speech')

const googleSpeechClient = new googleSpeech.SpeechClient()

discordClient.on('message', async (msg) => {
if (msg.content === "!join"){
  const member = msg.member
  const memberVoiceChannel = member.voice.channel

  if (!memberVoiceChannel || discordClient.voice.channel === memberVoiceChannel) {
    return
  }

  const connection = await memberVoiceChannel.join()
  const receiver = connection.receiver
  connection.play(new Silence(), { type: 'opus' });
  connection.on('speaking', (user, speaking) => {
    if (!speaking) {
      return
    }

    //npconsole.log(`I'm listening to ${user.username}`)

    // this creates a 16-bit signed PCM, stereo 48KHz stream
    const audioStream = receiver.createStream(user, { mode: 'pcm' })
    const requestConfig = {
      encoding: 'LINEAR16',
      sampleRateHertz: 48000,
      languageCode: 'en-US'
    }
    const request = {
      config: requestConfig
    }
    const recognizeStream = googleSpeechClient
      .streamingRecognize(request)
      .on('error', console.error)
      .on('data', response => {
        const transcription = response.results
          .map(result => result.alternatives[0].transcript)
          .join('\n')
          .toLowerCase()
        Object.keys(optin).forEach(u => discordClient.users.get(u).send(`${user.username}: ${transcription}`));
        console.log(`${user.username}: ${transcription}`)
      })

    const convertTo1ChannelStream = new ConvertTo1ChannelStream()

    audioStream.pipe(convertTo1ChannelStream).pipe(recognizeStream)

    audioStream.on('end', async () => {
      console.log('audioStream end')
    })
  })
}
else if(msg.content === "!opt in"){
  optin[msg.author.id] = msg.author.id;
  msg.channel.send(`User ${msg.author.username} has opted in to received transcriptions from voice channel.`);
  console.log(optin[msg.author.id]);
}
else if(msg.content === "!opt out"){
  delete optin[msg.author.id]
  msg.channel.send(`User ${msg.author.username} has opted out of receiving transcriptions from voice channel.`);
  console.log(optin[msg.author.id]);
}


})

discordClient.on('ready', () => {
  console.log(`Logged in as ${discordClient.user.tag}!`)
})


discordClient.login(config.discordApiToken)