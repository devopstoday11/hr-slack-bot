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

module.exports = {
	saveLeaveRequest: (user, toDate, fromDate, reason) => {
		return new Promise((resolve, reject) => {
			let leaveRequest = {
				name: user.name,
				id: user.id,
				real_name: user.real_name,
				toDate,
				fromDate,
				reason,
				days: Math.floor((toDate - fromDate) / 86400000) + 1,
				leaveCode: genRand()
			};
			leaveRequest = new LeaveMdl(leaveRequest);
			leaveRequest.save((err, response) => {
				if (err) {
					log.saveLogs(response.username, err, moment());
					reject(err);
				}
				resolve(response);
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
					$gte: dateToSearch,
				},
				toDate: {
					$lte: dateToSearch,
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
	}
};
