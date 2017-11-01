/* eslint-disable no-underscore-dangle */
const moment = require('moment');
const LeaveMdl = require('../schemas/leave');
const HolidayMdl = require('../schemas/holiday');
// const ChannelMsgMdl = require('../schemas/channelMessage');
const mongoose = require('mongoose');
const log = require('../helper/logger');

function genRand() {
	return Math.floor((Math.random() * 89999999) + 10000000);
}
function getDays(fromDate, toDate) {
	return new Promise((resolve, reject) => {
		let totalLeaveDays = Math.floor((toDate - fromDate) / 86400000) + 1;
		module.exports.getHolidayByRange(fromDate, toDate)
		.then((holidays) => {
			const filteredHoliday = holidays.filter((holiday) => {
				return holiday.day !== 'Sunday';
			});
			totalLeaveDays -= filteredHoliday.length;
			let totalSundays = 0;
			const startDate = new Date(fromDate);
			const endDate = new Date(toDate);
			for (let i = startDate; i <= endDate;) {
				// console.log(i);
				if (i.getDay() === 0) {
					totalSundays += 1;
				}
				i.setTime(i.getTime() + (1000 * 60 * 60 * 24));
			}
			totalLeaveDays -= totalSundays;
			if (totalLeaveDays === 0) {
				resolve(false);
			} else {
				resolve({ totalLeaveDays, totalHolidays: filteredHoliday.length, totalSundays });
			}
		})
		.catch((err) => {
			resolve(0);
		});
	});
}

module.exports = {
	saveLeaveRequest: (user, toDate, fromDate, reason) => {
		return new Promise((resolve, reject) => {
			getDays(fromDate, toDate)
			.then((days) => {
				let leaveRequest = {
					name: user.name,
					id: user.id,
					real_name: user.real_name,
					toDate,
					fromDate,
					reason,
					days: days.totalLeaveDays,
					leaveCode: genRand()
				};
				leaveRequest = new LeaveMdl(leaveRequest);
				leaveRequest.save((err, response) => {
					if (err) {
						log.saveLogs(response.username, err, moment());
						reject(err);
					}
					resolve({ response, days });
				});
			})
			.catch((err) => {
				reject(err);
			});
		});
	},

	getLeaveRequest: (leaveCode) => {
		return new Promise((resolve, reject) => {
			const query = LeaveMdl.findOne({
				leaveCode
			});
			query.exec((err, timesheet) => {
				if (err) reject(err);
				resolve(timesheet);
			});
		});
	},

	updateLeaveRequest: (docId, isApproved, note, actionBy) => {
		return new Promise((resolve, reject) => {
			LeaveMdl.update({ _id: docId }, { isApproved, note, actionBy }, (err, leaveReqest) => {
				if (err) reject(err);
				resolve(leaveReqest);
			});
		});
	},

	getLeaveRequestByDate: (fromDate) => {
		const tomorrow = moment(fromDate).add(1, 'days');
		const dayAfterTommorow = moment(tomorrow).add(1, 'days');

		return new Promise((resolve, reject) => {
			const query = LeaveMdl.find({
				fromDate: {
					$gte: tomorrow.toDate(),
					$lt: dayAfterTommorow.toDate()
				},
				isApproved: true
			});
			query.exec((err, timesheet) => {
				if (err) reject(err);
				resolve(timesheet);
			});
		});
	},

	getLeaveRequestByDateRange: (fromDate) => {
		const dateToSearch = fromDate.toDate();
		return new Promise((resolve, reject) => {
			const query = LeaveMdl.find({
				fromDate: {
					$lte: dateToSearch,
				},
				toDate: {
					$gte: dateToSearch,
				},
				isApproved: true
			});
			query.exec((err, timesheet) => {
				if (err) reject(err);
				resolve(timesheet);
			});
		});
	},

	isHoliday: (date) => {
		return new Promise((resolve, reject) => {
			const query = HolidayMdl.find({
				leaveDate: date
			});
			query.exec((err, holiday) => {
				if (err) reject(err);
				resolve(holiday.length ? holiday[0] : false);
			});
		});
	},

	getHolidays: (date) => {
		return new Promise((resolve, reject) => {
			const query = HolidayMdl.find({
				isoDate: { $gte: date },
			});
			query.sort('isoDate').exec((err, holiday) => {
				if (err) reject(err);
				resolve(holiday.length ? holiday : false);
			});
		});
	},

	getHolidayList: (date) => {
		return new Promise((resolve, reject) => {
			const query = HolidayMdl.find({
				isoDate: {
					$lt: new Date(new Date().getFullYear() + 1, 0, 1),
					$gte: new Date(new Date().getFullYear(), 0, 1)
				},
			});
			query.sort('isoDate').exec((err, holidays) => {
				if (err) reject(err);
				resolve(holidays.length ? holidays : false);
			});
		});
	},

	getHolidayByRange: (fromDate, toDate) => {
		return new Promise((resolve, reject) => {
			const query = HolidayMdl.find({
				isoDate: {
					$lte: toDate,
					$gte: fromDate
				},
			});
			query.sort('isoDate').exec((err, holidays) => {
				if (err) reject(err);
				resolve(holidays);
			});
		});
	},

	checkForLeaveForUser: (user, date) => {
		const dateToSearch = date.toDate();
		return new Promise((resolve, reject) => {
			const query = LeaveMdl.find({
				fromDate: {
					$lte: date,
				},
				toDate: {
					$gte: date,
				},
				isApproved: true,
				id: user,
			});
			query.exec((err, leavesheet) => {
				if (err) reject(err);
				resolve(leavesheet);
			});
		});
	},

	updateLeave: (leaveId, fromDate, toDate) => {
		return new Promise((resolve, reject) => {
			LeaveMdl.update({ _id: leaveId }, { toDate, fromDate, days: Math.floor((toDate - fromDate) / 86400000) + 1, }, (err, leaveReqest) => {
				if (err) reject(err);
				resolve(leaveReqest);
			});
		});
	}
};
