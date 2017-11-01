const request = require('request');
const moment = require('moment');
const fs = require('fs');
const _ = require('lodash');
const Message = require('../messages');
const log = require('./logger');
const DB = require('../models');

module.exports = {
	leaveReport: (message, users) => {
		try {
			const spaceIndex = message.text.indexOf(' ');
			let userId;
			if (spaceIndex != -1) {
				userId = message.text.substr(spaceIndex + 3, 9);
			} else {
				userId = message.user;
			}
			const userTemp = _.find(users, (o) => { return o.id === userId; });
			if (userTemp.id !== userId) {
				Message.postErrorMessage(message, new Error('USER NOT FOUND'));
			} else {
				Message.postLeaveReport(message, userId);
				userId = '';
			}
		} catch (e) {
			log.saveLogs(message.user, e, moment());
		}
	},
	specificReport: (message, timePeriod, start, end, users) => {
		try {
			const spaceIndex = message.text.indexOf('@');
			let userId;
			let attach;
			let attachment = [];
			if (spaceIndex === -1) {
				userId = message.user;
			} else {
				userId = message.text.substr(spaceIndex + 1, 9);
			}
			const userTemp = _.find(users, (o) => { return o.id === userId; });
			if (userTemp && userTemp.id !== userId) {
				Message.postErrorMessage(message, new Error('USER NOT FOUND'));
			} else {
				DB.getSpecificTimesheet(userId, start, end)
				.then((timesheet) => {
					if (timesheet[0]) {
						let i = 0;
						const colorCode = ['#0000FF', '#36a64f', '#cc0066', '#808000', '#b33c00', '#00cccc', '#669900'];
						timesheet.forEach((t, index) => {
							attach = {
								color: colorCode[i % 6],
								title: `${moment(t.createdAt).format('DD-MM-YYYY')}`,
								text: `Time : ${t.inTime} - ${t.outTime}\n\nTasks planned : \n${t.tasks} \n\nCompleted task: \n${t.taskDone}  `,
								ts: `${t.taskDone}`
							};
							attachment.push(attach);
							i += 1;
						});
						userId = '';
						Message.postSpecificReport(timesheet, attachment, timePeriod, message);
						attachment = [];
					} else {
						Message.postErrorMessage(message, new Error('NO DATA TO FETCH!!'));
					}
				});
			}
		} catch (e) {
			log.saveLogs(message.user, e, moment());
		}
	}
};
