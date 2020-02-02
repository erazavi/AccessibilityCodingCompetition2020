const Discord = require('discord.js');
const auth = require('./auth.json');
const client = new Discord.Client();
var followingUser = '';

client.once('ready', () => {
	console.log('Ready!');
	client.guilds.array().forEach(guild =>{
		let channelID;
		let channels = guild.channels;
		for (let c of channels){
			let channelType = c[1].type;
			if (channelType === "text") {
				channelID = c[0];
				break;
			}
		}

		let channel = client.channels.get(guild.systemChannelID || channelID);
		channel.send("PING PONG I AM ONLINE!");});
});

client.on('message', msg => {
	if (msg.content === 'www.follow!') {
		followingUser = msg.member.user.id;
		console.log("Following user: " + followingUser);
	}
})

client.on('voiceStateUpdate', (oldMember, newMember) => {
  let newUserChannel = newMember.voiceChannel
  let oldUserChannel = oldMember.voiceChannel
  console.log("USER VOICE CHANNEL STATE CHANGE!");
  console.log("user " + oldMember.user.id);
  console.log("previous channel: " + oldMember.voiceChannelID);
  console.log("new channel: " + newMember.voiceChannelID);
if (newMember.user.id === followingUser){
  if((oldUserChannel === undefined && newUserChannel !== undefined) 
  	|| (oldUserChannel !== undefined && newUserChannel !== undefined && oldUserChannel !== newUserChannel)){
     // User Joins a voice channel
 	console.log("Joined " + newUserChannel.id);
 	newUserChannel.join();
 	

  } else if(newUserChannel === undefined){
  	console.log("User left the channel");
  	oldUserChannel.leave();
    // User leaves a voice channel

  }
}})

client.login(auth.token);



