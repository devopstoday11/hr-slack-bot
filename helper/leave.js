const request = require('request');
const excel = require('node-excel-export');
const moment = require('moment');
const fs = require('fs');
const _ = require('lodash');
const apiai = require('apiai');
const CronJob = require('cron').CronJob;

const HolidayMdl = require('../schemas/holiday');
const Message = require('../messages');
const log = require('./logger');
const DB = require('../models');
const config = require('../config');
const links = require('../messages/links');
const LeaveMdl = require('../models/leave_model');
const taskReminder = require('../scheduler');
const DateHelper = require('./date_parser');

const app = apiai(config.apiai);


const timeRegex = new RegExp('^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');

module.exports = {
	leave: (message, user, payloadIms) => {
		let res = [];
		res = message.text.split(' ');
		if (res.length < 4) {
			Message.postErrorMessage(message, new Error('\nNo No No !!! Invalid command :rage: Type help to get exact command that I understand'));
		} else {
			const fromDate = DateHelper.parseDate(res[1]);
			const toDate = DateHelper.parseDate(res[2]);
			const reason = res.slice(3, res.length).join(' ');
			if (toDate && fromDate) {
				if (fromDate.getTime() <= toDate.getTime()) {
					LeaveMdl.saveLeaveRequest(user, toDate, fromDate, reason).then((leaveData) => {
						if (!leaveData.days) {
							Message.postMessage(message, 'No leave Needed for this period may be already holiday during this period');
						} else {
							const newLeaveReport = leaveData.response;
							Message.postMessage(message, `Your leave request has been sent to admins for approval\n*Request Id : * *\`${newLeaveReport.leaveCode}\`*\n Sit back and relax I will notify you when I get update on this request.\n\n
*Number of days :* ${leaveData.days.totalLeaveDays}\n
*Number of Sundays :* ${leaveData.days.totalSundays}\n
*Number of public holidays :* ${leaveData.days.totalHolidays}\n
                `);
							const adminIMS = [];
							config.admin.forEach((admin) => {
								const ims = _.find(payloadIms, { user: admin });
								if (ims) {
									adminIMS.push(ims.id);
								}
							});
							adminIMS.forEach((channelId) => {
								Message.postLeaveMessageToAdmin(channelId, user, newLeaveReport);
							});
						}
					})
					.catch((e) => {
						log.saveLogs(user.real_name, e, moment());
						Message.postErrorMessage(message, new Error('\nThere is some problem serving you request. Please try again till then I will repair myself.'));
					});
				} else {
					Message.postErrorMessage(message, new Error(`I think ${DateHelper.getDateAsDDMMYYYY(fromDate)} is larger than ${DateHelper.getDateAsDDMMYYYY(toDate)} or you are doing something wrong\n I thought you are inteligent ,Sorry my mistake :wink:`));
				}
			} else {
				Message.postErrorMessage(message, new Error('You are not a good reader. Help command clearly says DD-MM-YYYY format :wink:'));
			}
		}
	},
	leaveAccept: (message, user, payloadIms) => {
		let leaveDoc;
		let acceptCommand = [];
		acceptCommand = message.text.split(' ');
		const note = acceptCommand.slice(2, acceptCommand.length).join(' ');
		LeaveMdl.getLeaveRequest(acceptCommand[1]).then((leaveDataDoc) => {
			leaveDoc = leaveDataDoc;
			if (leaveDoc.isApproved) {
				Message.postErrorMessage(message, new Error(`\n${leaveDoc.actionBy || 'Someone'} has alreay accepted this request`));
				return false;
			} else {
				return LeaveMdl.updateLeaveRequest(leaveDoc._id, true, note, user.real_name);
			}
		}).then((leaveDataDoc) => {
			if (leaveDataDoc) {
				leaveDoc.actionBy = user.real_name;
				leaveDoc.isApproved = true;
				leaveDoc.note = note;
				const userChannel = _.find(payloadIms, { user: leaveDoc.id });
				// Message.postLeaveStatusMessage(userChannel.id, leaveDoc);
				const adminIMS = [];
				config.admin.forEach((admin) => {
					const ims = _.find(payloadIms, { user: admin });
					if (ims) {
						adminIMS.push(ims.id);
					}
				});
				adminIMS.forEach((channelId) => {
					Message.postLeaveStatusMessageToAdmin(channelId, leaveDoc);
				});
			}
		}).catch((e) => {
			log.saveLogs(user.real_name, e, moment());
			Message.postErrorMessage(message, new Error('\nThere is some problem serving you request. Please try again till then I will repair myself.'));
		});
	},
	leaveReject: (message, user, payloadIms) => {
		let leaveDocument;
		let rejectCommand = [];
		rejectCommand = message.text.split(' ');
		const rejectNote = rejectCommand.slice(2, rejectCommand.length).join(' ');
		LeaveMdl.getLeaveRequest(rejectCommand[1])
		.then((leaveDataDoc) => {
			leaveDocument = leaveDataDoc;
			if (leaveDocument.isApproved === false) {
				Message.postErrorMessage(message, new Error(`\n${leaveDocument.actionBy || 'Someone'} has alreay rejected this request`));
				return false;
			} else {
				return LeaveMdl.updateLeaveRequest(leaveDocument._id, false, rejectNote, user.real_name);
			}
		})
		.then((leaveDataDoc) => {
			if (leaveDataDoc) {
				leaveDocument.actionBy = user.real_name;
				leaveDocument.isApproved = false;
				leaveDocument.note = rejectNote;
				const userChannel = _.find(payloadIms, { user: leaveDocument.id });
				Message.postLeaveStatusMessage(userChannel.id, leaveDocument);
				const adminIMS = [];
				config.admin.forEach((admin) => {
					const ims = _.find(payloadIms, { user: admin });
					if (ims) {
						adminIMS.push(ims.id);
					}
				});
				adminIMS.forEach((channelId) => {
					Message.postLeaveStatusMessageToAdmin(channelId, leaveDocument);
				});
			}
		})
		.catch((e) => {
			log.saveLogs(user.real_name, e, moment());
			Message.postErrorMessage(message, new Error('\nThere is some problem serving you request. Please try again till then I will repair myself.'));
		});
	},
	leaveSet: (message, user) => {
		const setLeaveCommand = message.text.split(' ');
		if (setLeaveCommand.length >= 4) {
			if (!isNaN(setLeaveCommand[2]) && DateHelper.isValidDate(setLeaveCommand[1])) {
				const parseDate = DateHelper.parseDate(setLeaveCommand[1]);
				const holiday = new HolidayMdl({
					leaveDate: DateHelper.getDateAsDDMMYYYY(parseDate),
					reason: setLeaveCommand.slice(3, setLeaveCommand.length).join(' '),
					addedBy: user.real_name,
					leaveDays: setLeaveCommand[2],
					isoDate: parseDate,
					day: moment(parseDate).format('dddd')
				});
				holiday.save((err, response) => {
					if (err) {
						log.saveLogs(user.real_name, err, moment());
						Message.postErrorMessage(message, new Error('\nThere is some problem serving you request. Please try again till then I will repair myself.'));
					} else {
						Message.postMessage(message, `Leave has been set on *${response.leaveDate}* for *${response.reason}*`);
					}
				});
			} else {
				Message.postErrorMessage(message, new Error('Invalid Date or leave days'));
			}
		} else {
			Message.postErrorMessage(message, new Error(':confused: \nInvalid Command'));
		}
	},
	holiday: (message) => {
		LeaveMdl.getHolidays(new Date())
		.then((holidays) => {
			if (holidays) {
				Message.postHolidays(message, holidays);
			} else {
				Message.postErrorMessage(message, new Error('No further holiday data available'));
			}
		})
		.catch((err) => {
			Message.postErrorMessage(message, new Error('\nThere is some problem serving you request. Please try again till then I will repair myself.'));
		});
	},
	holidayList: (message) => {
		LeaveMdl.getHolidayList(new Date())
			.then((holidays) => {
				if (holidays) {
					Message.postHolidayList(message, holidays);
				} else {
					Message.postErrorMessage(message, new Error('No data available'));
				}
			})
			.catch((err) => {
				Message.postErrorMessage(message, new Error('\nThere is some problem serving you request. Please try again till then I will repair myself.'));
			});
	}
};
