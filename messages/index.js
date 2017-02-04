const slack = require('slack');
const DB = require('../models');
const config = require('../config');
const log = require('../helper/logger');
const DateHelper = require('../helper/date_parser');

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
				log.saveLogs(timesheet[0].userRealname, errSave, new Date());
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
				log.saveLogs(message.user, errSave, new Date());
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
				log.saveLogs(message.user, errSave, new Date());
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
				log.saveLogs(message.user, errSave, new Date());
			}
		});
	},

	postChannelInMessage: (message, updatedTime, user, param) => {
		slack.chat.postMessage({
			token: config.token,
			channel: config.postChannelId,
			title: 'Title',
			text: `*${updatedTime.userRealname}* checked in at \`${updatedTime.inTime}\` `,
			as_user: true,
			attachments: [
				{
					color: '#36a64f',
					fallback: `${updatedTime.userRealname} checked in at ${updatedTime.inTime} `,
					author_name: updatedTime.userRealname,
					title: 'Today\'s Tasks',
					text: message.text,
					ts: message.ts,
					thumb_url: user.image_192,
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(updatedTime.userRealname, errSave, new Date());
			}
			DB.saveChannelMessageRecord(updatedTime, data.ts, param)
			.then((dataNew) => {
				return true;
			});
		});
	},

	postChannelOutMessage: (message, updatedTime, user, param) => {
		slack.chat.postMessage({
			token: config.token,
			channel: config.postChannelId,
			title: 'Title',
			text: `*${updatedTime.userRealname}* has checked out`,
			as_user: true,
			attachments: [
				{
					color: '#439FE0',
					fallback: `${updatedTime.userRealname} checked out at ${updatedTime.outTime}`,
					mrkdwn_in: ['text', 'fields'],
					fields: [
						{
							title: 'Check-In Time',
							value: `*\`${updatedTime.inTime}\`*`,
							short: true
						},
						{
							title: 'Check-Out Time',
							value: `*\`${updatedTime.outTime}\`*`,
							short: true
						}
					],
					thumb_url: user.image_192,
				},
				{
					color: '#ff4d4d',
					fallback: `${updatedTime.userRealname} checked out at ${updatedTime.outTime} `,
					title: 'Planned Tasks',
					text: updatedTime.tasks,
					ts: updatedTime.taskTs,
				},
				{
					color: '#36a64f',
					fallback: `${updatedTime.userRealname} checked out at ${updatedTime.outTime} `,
					title: 'Completed Tasks',
					text: message.text,
					ts: message.ts
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(updatedTime.userRealname, errSave, new Date());
			}
			DB.saveChannelMessageRecord(updatedTime, data.ts, param)
			.then((dataNew) => {
				return true;
			});
		});
	},

	updateChannelInMessage: (timesheet, oldTs, user, updatedTask) => {
		slack.chat.update({
			token: config.token,
			channel: config.postChannelId,
			title: 'Title',
			text: `*${timesheet.userRealname}* checked in at \`${timesheet.inTime}\` `,
			as_user: true,
			ts: oldTs,
			attachments: [
				{
					color: '#36a64f',
					fallback: `${timesheet.userRealname} checked in at ${timesheet.inTime} `,
					author_name: timesheet.userRealname,
					title: 'Today\'s Tasks',
					text: updatedTask,
					ts: timesheet.msgTs,
					thumb_url: user.image_192,
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(timesheet.userRealname, errSave, new Date());
			}
		});
	},
	updateChannelOutMessage: (timesheet, oldTs, updateInTask, user, updatedOutTask) => {
		slack.chat.update({
			token: config.token,
			channel: config.postChannelId,
			ts: oldTs,
			title: 'Title',
			text: `*${timesheet.userRealname}* has checked out`,
			as_user: true,
			attachments: [
				{
					color: '#439FE0',
					fallback: `${timesheet.userRealname} checked out at ${timesheet.outTime}`,
					mrkdwn_in: ['text', 'fields'],
					fields: [
						{
							title: 'Check-In Time',
							value: `*\`${timesheet.inTime}\`*`,
							short: true
						},
						{
							title: 'Check-Out Time',
							value: `*\`${timesheet.outTime}\`*`,
							short: true
						}
					],
					thumb_url: user.image_192,
				},
				{
					color: '#ff4d4d',
					fallback: `${timesheet.userRealname} checked out at ${timesheet.outTime} `,
					title: 'Planned Tasks',
					text: updateInTask,
					ts: timesheet.taskTs,
				},
				{
					color: '#36a64f',
					fallback: `${timesheet.userRealname} checked out at ${timesheet.outTime} `,
					title: 'Completed Tasks',
					text: updatedOutTask,
					ts: timesheet.taskDoneTs
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(timesheet.userRealname, errSave, new Date());
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
				log.saveLogs('Undefined', errSave, new Date());
			}
		});
	},

	postLeaveMessageToAdmin: (channelId, user, leaveReport) => {
		slack.chat.postMessage({
			token: config.token,
			channel: config.postChannelId,
			title: 'Title',
			text: `*${user.real_name}* has requested for leave.\n*Accept :* \`leaveaccept ${leaveReport.leaveCode}\`\n*Report :* \`leavereject ${leaveReport.leaveCode}\``,
			as_user: true,
			attachments: [
				{
					color: '#439FE0',
					mrkdwn_in: ['text', 'fields'],
					fields: [
						{
							title: 'Leave From',
							value: `*\`${DateHelper.getDateAsDDMMYYYY(leaveReport.fromDate)}\`*`,
							short: true
						},
						{
							title: 'Leave To',
							value: `*\`${DateHelper.getDateAsDDMMYYYY(leaveReport.toDate)}\`*`,
							short: true
						},
						{
							title: 'Reason',
							value: `${leaveReport.reason}`,
							short: false
						}
					],
					thumb_url: user.image_192,
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(user.userRealname, errSave, new Date());
			}
		});
	},
};
