/* eslint-disable no-case-declarations, no-param-reassign */
const slack = require('slack');
const config = require('./config');


const bot = slack.rtm.client();
const token = config.token;
bot.listen({ token });

bot.started((payload) => {
	const payloadUsers = payload.users;
	// payloadIms = payload.ims;
	payloadUsers.forEach((user) => {
		if (!user.is_bot && user.name !== 'slackbot') {
			console.log(user);
			// user.image_192 = user.profile.image_192;
			// const dbUser = new UserMdl(user);
			// users.push(dbUser);
			// UserMdl.update({ id: user.id }, user, { upsert: true, setDefaultsOnInsert: true }, (err, result) => {
			// });
		}
	});
	// store ims of each user, to send messages at every 9:00 AM
	// direct sending messages using IMS array,so ims schema is not required
	// payloadIms.forEach((ims) => {
	// 	const newIms = {
	// 		userId: ims.user,
	// 		channelId: ims.id
	// 	};
	// 	const imsAdd = new ImsMdl(newIms);
	// 	imsAdd.save((err, resp) => {
	// 		if (err) log.saveLogs(resp.userid, err, moment());
	// 	});
	// });
});
