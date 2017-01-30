const slack = require('slack');
const DB = require('../models');
const config = require('../config');
const log = require('../helper/logger');

module.exports = {
	postSpecificReport: (timesheet, attachment, timePeriod, message) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			fallback: `*${timesheet[0].userRealname} ${timePeriod} Report*`,
			text: `*${timesheet[0].userRealname} ${timePeriod} Report*`,
			attachments: attachment,
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, new Date());
			}
		});
	},

	postMessage: (message, textMessage) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			text: `${textMessage}`,
			fallback: `${textMessage}`
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, new Date());
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
			attachments: [{
				color: '#36a64f',
				text: `${tasks}`,
			}]
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, new Date());
			}
		});
	},

	postErrorMessage: (message, error) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			text: '',
			fallback: `${error.message}`,
			attachments: [{
				color: '#ff0000',
				text: `${error.message}`,
			}]
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, new Date());
			}
		});
	},

	postChannelMessage: (message, updatedTime, time, text, param, inOut) => {
		slack.chat.postMessage({
			token: config.token,
			channel: config.postChannelId,
			title: 'Title',
			fallback: `${updatedTime.userRealname} checked ${inOut} at ${time} `,
			text: `*${updatedTime.userRealname} checked ${inOut} at* \`${time}\` `,
			attachments: [
				{
					color: '#36a64f',
					author_name: `${updatedTime.userRealname}`,
					title: text,
					text: `${message.text}`,
					ts: `${message.ts}`
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, new Date());
			}
			DB.saveChannelMessageRecord(updatedTime, data.ts, param)
			.then((dataNew) => {
				return true;
			});
		});
	},

	updateChannelMessage: (timesheet, oldTs, updatedTask, text) => {
		slack.chat.update({
			token: config.token,
			channel: config.postChannelId,
			ts: oldTs,
			title: 'Title',
			text: `${timesheet.userRealname} checked in at ${timesheet.inTime} `,
			fallback: `${timesheet.userRealname} checked in at ${timesheet.inTime} `,
			attachments: [
				{
					color: '#36a64f',
					author_name: `${timesheet.userRealname}`,
					title: text,
					text: `${updatedTask}`,
					ts: `${timesheet.msgTs}`
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(data.message.username, errSave, new Date());
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
				log.saveLogs(data.message.username, errSave, new Date());
			}
		});
	},
};
