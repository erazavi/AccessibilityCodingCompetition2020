//imports
require('dotenv').config()
const Discord = require('discord.js')
const config = require('./config')
const { RichEmbed } = require('discord.js');

const discordClient = new Discord.Client();
const { Readable } = require('stream');
const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);


//global bot variables
//List of users currently opted in to receive transcripts via DMs.
var optin = {};

//Name of the voice channel bot is currently in.
var currentChannelName = '';

//Bot's ID to prevent losing it in certain scopes due to caching errors on Discord's part
var lookatme = '';

//Has the Google API service been started up?
var joined = false;

//ID of voice channel the bot is currently in.
var memberVoiceChannel;

//Time to delete DMed transcript
var deleteTime = 25000;

//T
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


//Event listeners
/*
* Listens for a message, the content of which is parsed for commands to react to.
*/
discordClient.on('message', async (msg) => {

  
//!join summons the bot into the voice channel that the user who called it in and initiates speech to text
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
  //this prevents multiple requests per speech snippet to the google API
  if (joined) {
    return;
  }

  
  const receiver = connection.receiver

  //due to a restriction on Discords part, a bot cannot receive audio from a call until it plays audio. To circumvent this,
  //our bot continuously plays a clip of silence.
  connection.play(new Silence(), { type: 'opus' });
  connection.on('speaking', (user, speaking) => {
    if (!speaking || !user) {
      return
    }
    joined = true;
    // this creates a 16-bit signed PCM, stereo 48KHz stream
    const audioStream = receiver.createStream(user, { mode: 'pcm' })

    //Configuring stream to pipe data out to the Google API.
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

        //Sets the current channel's name for transcript purposes.
        currentChannelName = connection.channel.name;
        //Goes through the opt in list and sends a private message to each user present containing the transcription.
        Object.keys(optin).forEach(u => discordClient.users.get(u).send(createEmbedFromUserTranscript(user, transcription)).then(msg=>{msg.delete({timeout:deleteTime})}));
      
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
else if(msg.content === "!opt out"){    //method to stop the dm of transcriptions
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
else if(msg.content === "!opt list"){ //retrieve a list of opted in users
  var optList = 'Currently, the following users are opted in: \n';
  Object.keys(optin).forEach(u => optList += `${discordClient.users.get(u).username} \n`);
  msg.channel.send(optList);
}
else if(msg.content.split(':')[0] === "!delete time"){ //set time to delete a transcript after sent to an opted in user
  var time = msg.content.split(':')[1];
  time = parseInt(time);
  if (time){
    msg.channel.send(`<@${msg.author.id}> Time before transcription deletion set to ${time} miliseconds.`);
    deleteTime = time;
  }else{
    msg.channel.send(`<@${msg.author.id}> Invalid input, please provide time as an integer.`);
  }
}


});

//Generates an embedded message from the transcript and user information
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
  //Finds the first channel in the guild to announce the bot coming on-line
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