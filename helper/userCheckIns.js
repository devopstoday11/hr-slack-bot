const request = require('request');
const excel = require('node-excel-export');
const moment = require('moment');
const fs = require('fs');
const _ = require('lodash');
const apiai = require('apiai');
const CronJob = require('cron').CronJob;

const Message = require('../messages');
const log = require('./logger');
const DB = require('../models');
const config = require('../config');
const links = require('../messages/links');
const LeaveMdl = require('../models/leave_model');
const taskReminder = require('../scheduler');

const app = apiai(config.apiai);


const timeRegex = new RegExp('^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');

module.exports = {
	in: (message, payloadIms, user) => {
		let time;
		let spaceIndex;
		DB.getTodayTimesheet(message.user)
		.then((timesheet) => {
			if (timesheet) {
				if (timesheet.outTime && timesheet.taskDone) {
					throw new Error('Seems like you already left office cya tommorow:wink:');
				}
				throw new Error('You have already checked in so please concentrate on your work :wink::unamused:');
			} else {
				if (message.text.toLowerCase() === 'in') {
					time = moment().format('HH:mm');
				} else {
					spaceIndex = message.text.indexOf(' ');
					if (message.text.substr(0, spaceIndex).toLowerCase() === 'in') {
						time = message.text.substr(spaceIndex + 1);
						if (!timeRegex.test(time)) {
							throw new Error('Please enter valid time in HH:MM format.\nThe 24-hour clock was developed by ancient Egyptians, So please don\'t disrespect them and please enter valid time');
						}
					} else {
						throw new Error('Invalid Command');
					}
				}
				DB.saveTimesheet(user, time)
				.then((data) => {
					return data;
				})
				.catch((err) => {
					log.saveLogs(message.user, err, moment());
					Message.postErrorMessage(message, err);
				});
			}
		})
		.then((data) => {
			taskReminder.setReminder(message, data, new Date().getTime());
			Message.postMessage(message, 'What are the tasks that you are going to perform today?');
			return LeaveMdl.checkForLeaveForUser(message.user, moment().startOf('day'));
		})
		.then((leave) => {
			if (leave.length) {
				Message.postMessage(message, 'Looks Like `you were on leave` today \nNo problem you can proceed with check-ins but as my duty I have informed all the admins about your presence\nAnd one more `important thing` , I have cancelled you today\'s leave and all the concurrent days leave(if any)');
				const adminIMS = [];
				config.admin.forEach((admin) => {
					const ims = _.find(payloadIms, { user: admin });
					if (ims) {
						adminIMS.push(ims.id);
					}
				});
				adminIMS.forEach((channelId) => {
					Message.postLeavePresentMessageToAdmin(channelId, leave[0], user);
				});
				LeaveMdl.updateLeave(leave[0]._id, leave[0].fromDate, moment().subtract(1, 'days').toDate());
			}
		})
		.catch((err) => {
			log.saveLogs(message.user, err, moment());
			Message.postErrorMessage(message, err);
		});
	},
	out: (message) => {
		let time;
		let spaceIndex;
		DB.getTodayTimesheet(message.user).then((timesheet) => {
			if (!timesheet) {
				throw new Error('Not in');
			} else if (timesheet.outTime !== null) {
				throw new Error('Seems like you already left office cya tommorow:wink:');
			} else {
				if (message.text.toLowerCase() === 'out') {
					time = moment().format('HH:mm');
				} else {
					spaceIndex = message.text.indexOf(' ');
					time = message.text.substr(spaceIndex + 1);
					if (timeRegex.test(time)) {
						const inTimeHour = parseInt(timesheet.inTime.substr(0, timesheet.inTime.indexOf(':')));
						const outTimeHour = parseInt(time.substr(0, time.indexOf(':')));
						const inTimeMinute = parseInt(timesheet.inTime.substr(timesheet.inTime.indexOf(':') + 1));
						const outTimeMinute = parseInt(time.substr(time.indexOf(':') + 1));
						if (inTimeHour > outTimeHour || (inTimeHour === outTimeHour && inTimeMinute >= outTimeMinute)) {
							throw new Error('Please enter out time in 24 HOUR FORMAT!!');
						}
					} else {
						throw new Error('Invalid time format, Its `HH:MM` in 24 HOUR FORMAT!! So please be kind in entering valid time and save your time and ours too ...  ');
					}
				}
				DB.outUser(timesheet, time).then((data) => {
					return true;
				}).then(() => {
					Message.postMessageWithAttachment(message, '\nWhich of the below tasks you have completed today?\n', timesheet.tasks);
				});
			}
		}).catch((err) => {
			log.saveLogs(message.user, err, moment());
			Message.postErrorMessage(message, err);
		});
	},
	tasksInOut: (message, qod, user) => {
		DB.getTodayTimesheet(message.user).then((timesheet) => {
			const task = message.text;
			if (timesheet) {
				if (!timesheet.outTime && !timesheet.tasks) {
					DB.saveTask(timesheet, task, message.ts).then((updatedTime) => {
						Message.postMessage(message, 'You have successfully checked in and your tasks are posted in `daily-scrum`\n All the best for the day');
						Message.postChannelInMessage(message, updatedTime, user, 'msgTs');
					}).catch((err) => {
						log.saveLogs(message.user, err, moment());
					});
				} else if (timesheet.outTime && !timesheet.taskDone) {
					DB.saveTaskDone(timesheet, task, message.ts).then((updatedTime) => {
						const linkIndex = Math.floor(Math.random() * links.length);
						Message.postMessage(message, `You have successfully checked out and your completed tasks are posted in \`daily-scrum\`\n Have a good night\n\n ${qod}`);
						Message.postChannelOutMessage(message, updatedTime, user, 'msgDoneTs');
					}).catch((err) => {
						log.saveLogs(message.user, err, moment());
					});
				} else {
					const request1 = app.textRequest(message.text, {
						sessionId: message.user
					});

					request1.on('response', (response) => {
						Message.postMessage(message, response.result.fulfillment.speech);
					});

					request1.on('error', (error) => {
						console.log(error);
					});

					request1.end();
				}
			} else if (message.text.toLowerCase().indexOf('in ') === 0) {
				throw new Error('Invalid time format, Its `HH:MM` so please be kind in entering valid time and save your time and ours too ...  ');
			} else {
				throw new Error('You first need to enter in the office to start conversation :wink:');
			}
		}).catch((err) => {
			log.saveLogs(message.user, err, moment());
			Message.postErrorMessage(message, err);
		});
	},
	editTasks: (message, user) => {
		DB.getTodayTimesheet(message.message.user).then((timesheet) => {
			if (timesheet && timesheet !== null && message.previous_message && message.previous_message !== null && message.previous_message.ts === timesheet.taskTs) {
				DB.saveTask(timesheet, message.message.text, timesheet.taskTs).then(() => {
					Message.updateChannelInMessage(timesheet, timesheet.msgTs, user, message.message.text);
					if (timesheet.taskDoneTs) {
						Message.updateChannelOutMessage(timesheet, timesheet.msgDoneTs, message.message.text, user, timesheet.taskDone);
					}
					Message.postMessage(message, 'Your tasks are updated :+1:');
				});
			} else if (timesheet && timesheet !== null && message.previous_message && message.previous_message !== null && message.previous_message.ts === timesheet.taskDoneTs) {
				DB.saveTaskDone(timesheet, message.message.text, timesheet.taskDoneTs).then(() => {
					Message.updateChannelOutMessage(timesheet, timesheet.msgDoneTs, timesheet.tasks, user, message.message.text);
					Message.postMessage(message, 'Your tasks are updated :+1:');
				});
			} else {
				Message.postErrorMessage(message, new Error('you can edit only today\'s tasks!!'));
			}
		});
	}
};
