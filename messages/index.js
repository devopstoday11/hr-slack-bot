const slack = require('slack');
const DB = require('../models');
const config = require('../config');
const log = require('../helper/logger');
const moment = require('moment');

module.exports = {
	postSpecificReport: (timesheet, attachment, timePeriod, message) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			as_user: true,
			fallback: `${timesheet[0].userRealname} ${timePeriod} Report`,
			text: `*${timesheet[0].userRealname} ${timePeriod} Report*`,
			attachments: attachment,
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, moment());
			}
		});
	},

	postMessage: (message, textMessage) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			text: `${textMessage}`,
			as_user: true,
			fallback: `${textMessage}`
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, moment());
			}
		});
	},

	postMessageWithAttachment: (message, textMessage, tasks) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			text: textMessage,
			fallback: textMessage,
			as_user: true,
			attachments: [{
				color: '#36a64f',
				text: `${tasks || 'No task provided'}`,
			}]
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, moment());
			}
		});
	},

	postErrorMessage: (message, error) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			text: '',
			as_user: true,
			attachments: [{
				color: '#ff0000',
				fallback: `${error.message}`,
				text: `${error.message}`,
			}]
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, moment());
			}
		});
	},

	postChannelInMessage: (message, updatedTime, param) => {
		slack.chat.postMessage({
			token: config.token,
			channel: config.postChannelId,
			title: 'Title',
			text: `*${updatedTime.userRealname}* checked in at \`${updatedTime.inTime}\` `,
			as_user: true,
			attachments: [
				{
					color: '#36a64f',
					fallback: `${updatedTime.userRealname} checked in at ${updatedTime.outTime} `,
					author_name: `${updatedTime.userRealname}`,
					title: 'Today\'s Tasks',
					text: `${message.text}`,
					ts: `${message.ts}`
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs('data.message.username', errSave, moment());
			}
			DB.saveChannelMessageRecord(updatedTime, data.ts, param)
			.then((dataNew) => {
				return true;
			});
		});
	},
	postChannelOutMessage: (message, updatedTime, param) => {
		slack.chat.postMessage({
			token: config.token,
			channel: config.postChannelId,
			title: 'Title',
			text: `*${updatedTime.userRealname}* checked out at \`${updatedTime.outTime}\` `,
			as_user: true,
			attachments: [
				{
					color: '#36a64f',
					fallback: `${updatedTime.userRealname} checked out at ${updatedTime.inTime} `,
					title: 'Planned Tasks',
					text: `${updatedTime.tasks}`,
					ts: `${updatedTime.taskTs}`
				},
				{
					color: '#808000',
					fallback: `${updatedTime.userRealname} checked out at ${updatedTime.outTime} `,
					title: 'Completed Tasks',
					text: `${message.text}`,
					ts: `${message.ts}`
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs('data.message.username', errSave, moment());
			}
			DB.saveChannelMessageRecord(updatedTime, data.ts, param)
			.then((dataNew) => {
				return true;
			});
		});
	},

	updateChannelInMessage: (timesheet, oldTs, updatedTask) => {
		slack.chat.update({
			token: config.token,
			channel: config.postChannelId,
			ts: oldTs,
			title: 'Title',
			text: `*${timesheet.userRealname}* checked in at \`${timesheet.inTime}\` `,
			as_user: true,
			fallback: `${timesheet.userRealname} checked in at ${timesheet.inTime} `,
			attachments: [
				{
					color: '#36a64f',
					author_name: `${timesheet.userRealname}`,
					title: 'Todays\'s Tasks',
					text: `${updatedTask}`,
					ts: `${timesheet.msgTs}`
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, moment());
			}
		});
	},
	updateChannelOutMessage: (timesheet, oldTs, updateInTask, updatedOutTask) => {
		slack.chat.update({
			token: config.token,
			channel: config.postChannelId,
			ts: oldTs,
			title: 'Title',
			text: `*${timesheet.userRealname}* checked out at \`${timesheet.inTime}\` `,
			as_user: true,
			fallback: `${timesheet.userRealname} checked out at ${timesheet.inTime} `,
			attachments: [
				{
					color: '#808000',
					title: 'Planned Tasks',
					text: `${updateInTask}`,
					ts: `${timesheet.msgTs}`
				},
				{
					color: '#36a64f',
					title: 'Completed Tasks',
					text: `${updatedOutTask}`,
					ts: `${timesheet.msgDoneTs}`
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, moment());
			}
		});
	},

	postHelpMessage: (message, error) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'HELP DESK',
			fallback: 'HELP DESK',
			text: 'Alway ready to help',
			as_user: true,
			attachments: [
				{
					fallback: 'IN',
					color: '#36a64f',
					pretext: 'Entering in the office',
					author_name: 'Command',
					title: 'IN / IN HH:MM',
					text: 'If you are entering in command and want to keep in time as the current time then enter only IN and if you want to change in time than current time then please provide  time in HH:MM formate after IN'
				},
				{
					fallback: 'OUT',
					color: '#0000ff',
					pretext: 'While Leaving in the office',
					author_name: 'Command',
					title: 'OUT / OUT HH:MM',
					text: 'Timing rules are same as IN command'
				}
			]
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, moment());
			}
		});
	},
};
