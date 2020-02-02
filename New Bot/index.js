require('dotenv').config()
const Discord = require('discord.js')
const config = require('./config')
const { RichEmbed } = require('discord.js');

const discordClient = new Discord.Client();
const { Readable } = require('stream');
const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);


//global bot variables
var optin = {};
var currentChannelName = '';
var lookatme = '';
var joined = false;
var memberVoiceChannel;


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
//Command locations
discordClient.on('message', async (msg) => {
if (msg.content === "!join"){
  const member = msg.member
  memberVoiceChannel = member.voice.channel;

  if (!memberVoiceChannel) {
    return
  }

  const connection = await memberVoiceChannel.join()
  currentChannelName = memberVoiceChannel.name;
  discordClient.channels.get("673003771160166434").send("The FBI has joined the voice channel: " +
                          currentChannelName + " . Please be aware that your voice chat is being recorded for accessibility purposes. ");
                          memberVoiceChannel.members.forEach(member => {
                            if(member.id!==msg.member.id&&member.id!==lookatme.id){
                            discordClient.channels.get("673003771160166434").send('<@'+member.id+'>');
                            }
                          });
                    
  if (joined) {
    return;
  }

  
  const receiver = connection.receiver
  connection.play(new Silence(), { type: 'opus' });
  connection.on('speaking', (user, speaking) => {
    if (!speaking || !user) {
      return
    }
    joined = true;
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
          .toLowerCase();


        currentChannelName = connection.channel.name;
        Object.keys(optin).forEach(u => discordClient.users.get(u).send(createEmbedFromUserTranscript(user, transcription)).then(msg=>{msg.delete({timeout:25000})}));
      
        console.log(`${user.username}: ${transcription}`);

      })

    const convertTo1ChannelStream = new ConvertTo1ChannelStream()

    audioStream.pipe(convertTo1ChannelStream).pipe(recognizeStream)

    audioStream.on('end', async () => {
      console.log('audioStream end')
      
    })
  })
}
else if(msg.content === "!opt in"){     //method to allow dm of transcriptions
  optin[msg.author.id] = msg.author.id;
  msg.channel.send("Hello", {files: ["./hello.gif"]});
  msg.channel.send(`User <@${msg.author.id}> has opted in to receiving transcriptions from the active voice channel.`);
  console.log(optin[msg.author.id]);
}
else if(msg.content === "!opt out"){    //method to stop the dm of stranscriptions
  delete optin[msg.author.id]
    msg.channel.send("Goodbye", {files: ["./goodbye.gif"]})
  
  msg.channel.send(`User <@${msg.author.id}> has opted out of receiving transcriptions from the active voice channel.`);
  console.log(optin[msg.author.id]);
}else if(msg.content === "!help"){        //dm commands to user
  msg.author.send(`Here is a list of my commands: 
		!join - I will join your voice channel
		!opt in - get a DM of my transcriptions
    !opt out - Stop recieving my transcriptions
    !help - DM you my commands`
		)
}

});

function createEmbedFromUserTranscript(user, transcription){
  var embed = new Discord.MessageEmbed()
	.setColor('#0099ff')
  .setFooter('Transcription from #' + currentChannelName)
  .setDescription(transcription)
  .setTimestamp();
  discordClient.users.fetch(user.id).then(myUser => {embed.setAuthor(`${myUser.username}`, myUser.avatarURL())});
  return embed;
}

//functions that run on the initialization of the bot
discordClient.on('ready', () => {
  console.log(`Logged in as ${discordClient.user.tag}!`)
  lookatme = discordClient.user;
  discordClient.user.setActivity('!help for commands');
  discordClient.guilds.array().forEach(guild =>{
		let channelID;
		let channels = guild.channels;
		for (let c of channels){
			let channelType = c[1].type;
			if (channelType === "text") {
				channelID = c[0];
				break;
			}
		}

		let channel = discordClient.channels.get(guild.systemChannelID || channelID);
  channel.send("The FBI is here please be aware that voice channels are being recorded for accessibilitly, type `!opt in` to recieve DM transcriptions! ")
})});

discordClient.login(config.discordApiToken)