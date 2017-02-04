/* eslint-disable no-underscore-dangle */
const moment = require('moment');
const LeaveMdl = require('../schemas/leave');
// const ChannelMsgMdl = require('../schemas/channelMessage');
const mongoose = require('mongoose');
const log = require('../helper/logger');

function genRand() {
	return Math.floor((Math.random() * 89999) + 10000);
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
				isApproved: false,
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
	}
};
