/* eslint-disable no-param-reassign, no-shadow , consistent-return*/
const kue = require('kue');
const moment = require('moment');
const request = require('request');
const DB = require('./models');
const log = require('./helper/logger');
const Message = require('./messages');
// create our job queue

const jobs = kue.createQueue({
	disableSearch: false
});
module.exports = {
	setReminder: (message, data, date) => {
		const currentDateTimeStamp = date;
		const job = jobs.create('reminder', { message, data })
			.delay(3600000)
			.priority('high')
			.save();
	},

	setDeadLine: (message, data) => {
		const job = jobs.create('deadline', { message, data })
			.delay(1800000)
			.priority('high')
			.save();
	}
};

jobs.process('reminder', 10, (job, done) => {
	DB.getTodayTimesheet(job.data.message.user)
	.then((timesheet) => {
		if (!timesheet.tasks) {
			Message.postMessage(job.data.message, 'Looks like you\'ve *tapped in hour before*, yet you\'ve not entered tasks for the day like a lazy chap around the block.\n\nIf you fail to do so in coming half an hour, I would post your check-in `with no tasks` in `#daily-scrum`, and , and *no deity would allow you to edit that*.');
			module.exports.setDeadLine(job.data.message, timesheet);
		}
		done();
	}).catch((err) => {
		log.saveLogs(job.data.message.user, err, moment());
		done();
	});
});

jobs.process('deadline', 10, (job, done) => {
	DB.getTodayTimesheet(job.data.message.user)
	.then((timesheet) => {
		if (!timesheet.tasks) {
			return DB.saveTask(timesheet, 'No Task Provided', job.data.message.ts);
		}
	})
	.then((timesheet) => {
		job.data.message.text = 'NO TASK PROVIDED (User didn\'t enter tasks even after 1 hour reminder time and half hour buffer time. He/She must be sleeping)';
		Message.postMessage(job.data.message, 'I have posted your *Check-In* with `no task provided` in `#daily-scrum` channel and `now you can not edit the task`.\n *`#warning`*');
		Message.postChannelInMessage(job.data.message, timesheet, job.data.message.user, 'msgTs', '#ff0000');
	})
	.catch((err) => {
		log.saveLogs(job.data.message.user, err, moment());
	});
	done();
});

// kue.app.listen(3005);
