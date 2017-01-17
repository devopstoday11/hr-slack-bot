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
			text: `${timesheet[0].userRealname} ${timePeriod} Report`,
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
			text: textMessage,
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

	postChannelMessage: (message, updatedTime, time, text, param) => {
		slack.chat.postMessage({
			token: config.token,
			channel: config.postChannelId,
			title: 'Title',
			text: `${updatedTime.userRealname} checked in at ${time} `,
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
	}
};
