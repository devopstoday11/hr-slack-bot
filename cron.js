const CronJob = require('cron').CronJob;
const Message = require('./messages');
const config = require('../config');
const mongoose = require('mongoose');
const imsMdl = require('./schemas/ims');
const slack = require('slack');
const log = require('./helper/logger');

mongoose.connect(config.mongoURL);

const userCheckIn = new CronJob({
	cronTime: '*/10 * * * * *',
	onTick() {
		console.log(1);
		imsMdl.find({}, (err, result) => {
			if (err) {
				console.log(err);
			}
			result.forEach((ims) => {
				slack.chat.postMessage({
					token: config.token,
					channel: config.postChannelId,
					title: 'Title',
					text: 'let\'s check you in',
				}, (errSave, data) => {
					if (errSave) {
						console.log(errSave);
					}
				});
			});
		});
	},
	start: false,
	timeZone: 'America/Los_Angeles'
});

userCheckIn.start();
