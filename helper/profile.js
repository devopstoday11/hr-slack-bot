const request = require('request');
const excel = require('node-excel-export');
const moment = require('moment');
const fs = require('fs');
const _ = require('lodash');
const UserMdl = require('../schemas/user');

const HolidayMdl = require('../schemas/holiday');
const Message = require('../messages');
const log = require('./logger');
const DB = require('../models');
const config = require('../config');
const links = require('../messages/links');
const DateHelper = require('./date_parser');
const dateFormat = require('dateformat');

module.exports = {
	updateProfile: (message) => {
		try {
			let profileCommand = message.text.split(' ');
			profileCommand = profileCommand.filter(Boolean);
			if (profileCommand.length >= 4) {
				const field = profileCommand[2];
				let value = '';
				for (let i = 3; i < profileCommand.length; i += 1) {
					value += `${profileCommand[i]} `;
				}
				value = value.trim();
				if (_.find(config.profileFields, (o) => { return o.toLowerCase() === field; })) {
					if (field.toLowerCase() === 'birthday') {
						let parseDate = DateHelper.parseDate(value);
						if (parseDate) {
							parseDate.setUTCHours(24);
							parseDate.setUTCMinutes(0);
							parseDate.setUTCSeconds(0);
							parseDate = parseDate.toISOString();
							UserMdl.update({ id: message.user }, { birthDay: parseDate }, (e, r) => {
								if (e) {
									log.saveLogs(message.user, e, moment());
									Message.postSomethingWrongMessage(message);
								} else {
									Message.postMessage(message, `Great!! You have added birthday to your profile! Now, I can also wish you on ${value} :blush:`);
								}
							});
						} else {
							Message.postErrorMessage(message, new Error('No!..No!..No!.. wrong date format!! \n Please give your birthday in DD-MM-YYYY Format!!'));
						}
					} else if (field.toLowerCase() === 'intro') {
						UserMdl.update({ id: message.user }, { shortIntro: value }, (e, r) => {
							if (e) {
								log.saveLogs(message.user, e, moment());
								Message.postSomethingWrongMessage(message);
							} else {
								Message.postMessage(message, 'Great!! Your introduction can tell who you are! :blush:');
							}
						});
					} else if (field.toLowerCase() === 'bio') {
						UserMdl.update({ id: message.user }, { bio: value }, (e, r) => {
							if (e) {
								log.saveLogs(message.user, e, moment());
								Message.postSomethingWrongMessage(message);
							} else {
								Message.postMessage(message, 'Great!! You now have added your bio.bio includes personal touches that make you more human! :blush:');
							}
						});
					} else if (field.toLowerCase() === 'quote') {
						UserMdl.update({ id: message.user }, { quote: value }, (e, r) => {
							if (e) {
								log.saveLogs(message.user, e, moment());
								Message.postSomethingWrongMessage(message);
							} else {
								Message.postMessage(message, 'Great!! You now have added your favourite quote.The quotes you like identifies your attitude!! :blush:');
							}
						});
					} else if (field.toLowerCase() === 'hobby') {
						value = message.text.substr(20).trim().split(',').filter(Boolean);
						let v1 = [];
						value.forEach((v) => {
							v1.push(v.trim().toLowerCase());
						});
						v1 = _.uniq(v1);
						UserMdl.update({ id: message.user }, { $addToSet: { hobbies: { $each: v1 } } }, (e, r) => {
							if (e) {
								log.saveLogs(message.user, e, moment());
								Message.postSomethingWrongMessage(message);
							} else {
								Message.postMessage(message, 'Great!! You have added you hobbies in your profile.\nMake your hobby your profession :blush:');
							}
						});
					}
				} else if (field === 'role') {
					Message.postErrorMessage(message, new Error('You, youself can\'t edit your role. Please contact your administrator!'));
				} else {
					Message.postErrorMessage(message, new Error(`${field} is not something you can edit in your profile`));
				}
			} else {
				Message.postErrorMessage(message, new Error('invalid command for profile update'));
			}
		} catch (e) {
			log.saveLogs(message.user, e, moment());
			Message.postSomethingWrongMessage(message);
		}
	},
	updateRole: (message, payloadIms) => {
		try {
			let profileCommand = message.text.split(' ');
			profileCommand = profileCommand.filter(Boolean);
			if (profileCommand.length === 6 && profileCommand[4] === 'of') {
				const value = profileCommand[3];
				const user = message.text.substr(message.text.indexOf('@') + 1, 9);
				const ims = _.find(payloadIms, { user });
				if (_.find(config.userRoles, (o) => { return o.toLowerCase() === value; })) {
					if (ims) {
						UserMdl.update({ id: user }, { role: value }, (e, r) => {
							if (e) {
								log.saveLogs(message.user, e, moment());
								Message.postSomethingWrongMessage(message);
							} else {
								Message.postMessage(message, `Great!! You have updated <@${user}>'s role as ${value}!Let me notify <@${user}> :smile:`);
								Message.postMessageToSpecificUser(ims.id, `Greetings!! Admin has updated your role as ${value}! :tada:`);
							}
						});
					} else {
						Message.postErrorMessage(message, new Error('seems like the user you specified does not exist!'));
					}
				} else {
					Message.postErrorMessage(message, new Error(`${value} is not allowed as a role`));
				}
			} else {
				Message.postErrorMessage(message, new Error('invalid command for updating role'));
			}
		} catch (e) {
			log.saveLogs(message.user, e, moment());
			Message.postSomethingWrongMessage(message);
		}
	},
	getProfile: (message) => {
		try {
			const user = message.text.substr(message.text.indexOf('@') + 1, 9);
			if (user) {
				UserMdl.find({ id: user }, (e, r) => {
					if (e) {
						Message.postSomethingWrongMessage(message);
					} else if (r[0]) {
						const u = {
							id: r[0].id,
							image_192: r[0].image_192,
							real_name: r[0].real_name,
							name: r[0].name,
							role: r[0].role.toUpperCase(),
							shortIntro: r[0].shortIntro,
							bio: r[0].bio,
							quote: r[0].quote,
							hobbies: _.join(r[0].hobbies, ', '),
							birthDay: '',
							skills: '\n            '
						};
						if (r[0].birthDay) {
							u.birthDay = dateFormat(new Date(r[0].birthDay), 'dddd, mmmm dS, yyyy');
						}
						if (r[0].skills[0]) {
							r[0].skills.forEach((s) => {
								u.skills += `Skill: ${s.masterSkill}    level: ${s.level}\n            `;
							});
						}
						Message.postUserProfileMessage(message, u);
					} else {
						Message.postErrorMessage(message, new Error('seems like user was removed from channel'));
					}
				});
			} else {
				Message.postErrorMessage(message, new Error('seems like user does not exist'));
			}
		} catch (e) {
			log.saveLogs(message.user, e, moment());
			Message.postSomethingWrongMessage(message);
		}
	},
	getTodayBirthDays: () => {
		return new Promise((resolve, reject) => {
			try {
				const today = new Date();
				const m1 = { $match: { birthDay: { $exists: true, $ne: null }, real_name: { $ne: null } } };
				const p1 = {
					$project: {
						_id: 0,
						name: 1,
						real_name: 1,
						id: 1,
						birthDay: 1,
						todayDayOfYear: { $dayOfYear: today },
						dayOfYear: { $dayOfYear: '$birthDay' }
					}
				};
				const p2 = {
					$project:
					{
						name: 1,
						real_name: 1,
						id: 1,
						birthDay: 1,
						daysTillBirthday: {
							$subtract: [{
								$add: ['$dayOfYear',
									{ $cond: [{ $lt: ['$dayOfYear', '$todayDayOfYear'] }, 365, 0] }]
							},
								'$todayDayOfYear']
						}
					}
				};
				const m2 = { $match: { daysTillBirthday: { $lt: 3 } } };
				UserMdl.aggregate([m1, p1, p2, m2]).sort({ daysTillBirthday: 1 }).exec((e, r) => {
					if (e) {
						resolve([]);
					} else {
						resolve(r);
					}
				});
			} catch (e) {
				log.saveLogs('', e, moment());
				resolve([]);
			}
		});
	}
};
