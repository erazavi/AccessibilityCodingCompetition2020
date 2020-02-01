const Discord = require('discord.io');
const logger = require('winston');
const auth = require('./auth.json');
//const client = new Discord.Client();

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';
// Initialize Discord Bot
const bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});
bot.on('voiceStateUpdate', function(oldMember, newMember){
    bot.joinVoiceChannel("673003771160166438"); //this works
    let newUserChannel = undefined;//newMember.voiceChannel; //cannot get newmember to be defined
    let oldUserChannel = oldMember.voiceChannel;
  
  
    if(oldUserChannel === undefined && newUserChannel !== undefined) {
       // bot.joinVoiceChannel("673003771160166438");
       // User Joins a voice channel
  
    } else if(newUserChannel == undefined){
  //bot.leaveVoiceChannel("673003771160166438"); //this works but its broken if I hardcode newmember to be undefined
      // User leaves a voice channel
    }
  

    //bot.joinVoiceChannel(voiceChannelID);
  })
bot.on("message", function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
       
        args = args.splice(1);
        switch(cmd) {
            // !ping
            case 'ping':
                bot.sendMessage({
                    to: channelID,
                    message: 'Pong!',
                    tts: true
                });
            break;
	        case 'plink':
		        bot.sendMessage({
                    to:channelID,
                    message: "Plonk",
                    tts: true
                })
                bot.joinVoiceChannel(channelID);
            break;
	// Just add any case commands if you want to..
         }
     }
});
