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
	addSkills: (message) => {
		const skillsCommand = message.text.split(' ');
		if (message.text.indexOf('skill add level') === 0) {
			let masterSkill = skillsCommand[4];
			const value = skillsCommand[skillsCommand.length - 1];
			for (let i = 5; i < skillsCommand.length - 1; i += 1) {
				masterSkill += ` ${skillsCommand[i]}`;
			}
			if (skillsCommand[3] === 'of') {
				UserMdl.find({ id: message.user, 'skills.masterSkill': masterSkill }, (e, r) => {
					if (e) {
						log.saveLogs(message.user, e, moment());
						Message.postSomethingWrongMessage(message);
					} else if (r[0]) {
						if (_.find(config.skillLevels, (l) => { return l.toLowerCase() === value; })) {
							UserMdl.update({ id: message.user, 'skills.masterSkill': masterSkill },
							{ 'skills.$.level': value }, (err, res) => {
								if (err) {
									log.saveLogs(message.user, err, moment());
									Message.postSomethingWrongMessage(message);
								} else {
									Message.postMessage(message, `Your skill level of \`${masterSkill}\` has been changed to \`${value}\` :+1:`);
								}
							});
						} else {
							Message.postErrorMessage(message, new Error(`${value} is not allowed to be a skill level!!\nAllowed levels are : ${config.skillLevels}`));
						}
					} else {
						Message.postErrorMessage(message, new Error(`You don't have a skill with name ${masterSkill}!!\nAdd it first by typing SKILL ADD ${masterSkill.toUpperCase()}`));
					}
				});
			} else {
				Message.postErrorMessage(message, new Error('No..!No..!No..!Wrong Command!!\nPlease type SKILL ADD LEVEL OF SKILL_NAME LEVEL'));
			}
		} else if (message.text.indexOf('skill add ') === 0 && skillsCommand.length >= 3) {
			let value = message.text.substr(10);
			value = value.split(',').filter(Boolean);
			Message.postMessage(message, 'Great!! You have added your technical skills!!It can help others!! :blush:');
			value.forEach((v) => {
				UserMdl.update({ id: message.user, 'skills.masterSkill': { $ne: v.trim().toLowerCase() } }, { $addToSet: { skills: { masterSkill: v.trim().toLowerCase() } } }, (e, r) => {
					if (e) {
						log.saveLogs(message.user, e, moment());
					}
				});
			});
		} else {
			Message.postErrorMessage(message, new Error('No!..No!..No!..Wrong Command.\nPlease type HELP PROFILE to get help!!'));
		}
	},
	removeSkills: (message) => {
		const skillsCommand = message.text.split(' ');
		if (skillsCommand.length < 3) {
			Message.postErrorMessage(message, new Error('No!..No!..No!..Wrong Command.Please type SKILLS REMOVE SKILL1 SKILL2 SKILL3 (list of space separated skills) to remove a skill'));
		} else {
			let value = message.text.substr(13);
			value = value.split(',').filter(Boolean);
			Message.postMessage(message, 'Okay!! So, you have removed some of your skills!!\nFrom now, they won\'t appear in your profile!! :+1: ');
			value.forEach((v) => {
				UserMdl.update({ id: message.user, 'skills.masterSkill': v.trim().toLowerCase() }, { $pull: { skills: { masterSkill: v.trim().toLowerCase() } } }, (e, r) => {
					if (e) {
						log.saveLogs(message.user, e, moment());
					}
				});
			});
		}
	},
	getSkills: (message, users, payloadIms) => {
		let skillsCommand = message.text.split(' ');
		skillsCommand = skillsCommand.filter(Boolean);
		if (skillsCommand.length !== 2) {
			Message.postErrorMessage(message, new Error('No!..No!..No!..Wrong Command.Please type SKILLS @USERNAME to take a look at any user\'s technical skills'));
		} else {
			const userId = skillsCommand[1].substr(skillsCommand[1].indexOf('@') + 1, 9);
			UserMdl.find({ id: userId }, (e, r) => {
				if (e) {
					log.saveLogs(message.user, e, moment());
					Message.postSomethingWrongMessage(message);
				} else if (r[0]) {
					let msg1 = '';
					if (r[0].skills[0]) {
						msg1 += `\`${r[0].real_name}\` has added these skills : \n            `;
						r[0].skills.forEach((s) => {
							msg1 += `Skill: *${s.masterSkill}*    level: *${s.level}*\n            `;
						});
					} else {
						msg1 += `Seems like \`${r[0].real_name}\` hasn't added any skills in his profile!!`;
					}
					Message.postMessage(message, msg1);
				} else {
					Message.postErrorMessage(message, new Error('Seems like either user may have been removed from channel or does not exist!'));
				}
			});
		}
	}
};
