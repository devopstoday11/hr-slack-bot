/* eslint-disable no-case-declarations, no-param-reassign */
const slack = require('slack');
const fs = require('fs');
const request = require('request');
const moment = require('moment');
const _ = require('lodash');
const excel = require('node-excel-export');
const CronJob = require('cron').CronJob;
const apiai = require('apiai');

const config = require('./config');
const mongoose = require('mongoose');
const UserMdl = require('./schemas/user');
const ImsMdl = require('./schemas/ims');
const TimeMdl = require('./schemas/timesheet');
const HolidayMdl = require('./schemas/holiday');
const LeaveMdl = require('./models/leave_model');
const DB = require('./models');
const Message = require('./messages');
const log = require('./helper/logger');
const links = require('./messages/links');
const birthDayMsgs = require('./messages/birthdayMsgs');
const DateHelper = require('./helper/date_parser');
const taskReminder = require('./scheduler');
const dateFormat = require('dateformat');

mongoose.connect(config.mongoURL);
console.log(config.mongoURL, 'mongo url of attendance bot');

const bot = slack.rtm.client();
const token = config.token;
const timeRegex = new RegExp('^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');
const users = [];
const app = apiai(config.apiai);
const reportHelper = require('./helper/report');
const excelHelper = require('./helper/excelReport');
const userCheckIns = require('./helper/userCheckIns');
const leaveHelper = require('./helper/leave');
const profileHelper = require('./helper/profile');
const skillHelper = require('./helper/skills');

let payloadIms;
let leaveDays = 0;
let reminder = false;
let leaveReasons;
let qod = '';
bot.started((payload) => {
	const payloadUsers = payload.users;
	payloadIms = payload.ims;
	let u;
	// UserMdl.updateMany({ birthDay: null }, { $set: { birthDay: new Date('1970-01-01') } }, (e, r) => {
	// });
	payloadUsers.forEach((user) => {
		if (!user.is_bot && user.name !== 'slackbot') {
			user.image_192 = user.profile.image_192;
			if (!user.deleted) {
				const dbUser = {
					name: user.name,
					id: user.id,
					real_name: user.real_name,
					image_192: user.image_192,
				};
				users.push(dbUser);
				UserMdl.update({ id: user.id }, dbUser, { upsert: true, setDefaultsOnInsert: true }, (err, result) => {
				});
			}
		}
	});
});


/**
 *
 * Message Object
 * {
 * 	type: 'message',
 *  channel: 'C3G5DHZT6',
 *  user: 'U397MPB4M',
 *  text: 'in',
 *  ts: '1482401538.000011',
 *  team: 'T397BDMS8'
 * }
 */
bot.message((message) => {
	let user = {};
	if (!message.subtype) {
		user = _.find(users, { id: message.user });
	} else if (message.subtype === 'message_changed') {
		user = _.find(users, { id: message.previous_message.user });
	}
	if (message.channel !== config.postChannelId) {
		let testCase = '';
		if (message.type === 'message' && !message.subtype && !message.bot_id) {
			try {
				// User entry
				if (message.text.toLowerCase() === 'in' || (message.text.toLowerCase().indexOf('in ') === 0 && timeRegex.test(message.text.toLowerCase().substr(message.text.indexOf(' ') + 1)))) {
					testCase = 'IN';
				} else if (message.text.toLowerCase() === 'out' || (message.text.toLowerCase().indexOf('out ') === 0 && timeRegex.test(message.text.toLowerCase().substr(message.text.indexOf(' ') + 1)))) {
					testCase = 'OUT';
				} else if (message.text.toLowerCase() === 'week' || message.text.toLowerCase().indexOf('week ') === 0) {
					if (_.find(config.admin, (o) => { return o === message.user; }) || message.text === 'week' || message.text.substr(message.text.indexOf('@') + 1, 9) === message.user) {
						testCase = 'WEEK_REPORT';
					} else {
						testCase = 'UNAUTHORIZED';
					}
				} else if (message.text.toLowerCase() === 'month' || message.text.toLowerCase().indexOf('month ') === 0) {
					if (_.find(config.admin, (o) => { return o === message.user; }) || message.text === 'month' || message.text.substr(message.text.indexOf('@') + 1, 9) === message.user) {
						testCase = 'MONTH_REPORT';
					} else {
						testCase = 'UNAUTHORIZED';
					}
				} else if (message.text.toLowerCase() === 'help' || message.text.toLowerCase().indexOf('help ') === 0) {
					testCase = 'HELP';
				} else if (message.text.toLowerCase() === 'excel' || message.text.toLowerCase().indexOf('excel ') === 0) {
					if (_.find(config.admin, (o) => { return o === message.user; }) || message.text === 'excel' || message.text.substr(message.text.indexOf('@') + 1, 9) === message.user) {
						testCase = 'EXCEL';
					} else {
						testCase = 'UNAUTHORIZED';
					}
				} else if (message.text.toLowerCase() === 'leave' || message.text.toLowerCase().indexOf('leave') === 0) {
					if (message.text.toLowerCase().indexOf('leave ') === 0) {
						testCase = 'LEAVE';
					} else if (message.text.toLowerCase().indexOf('leaveaccept ') === 0) {
						if (_.find(config.admin, (o) => { return o === message.user; })) {
							testCase = 'LEAVEACCEPT';
						} else {
							testCase = 'UNAUTHORIZED';
						}
					} else if (message.text.toLowerCase().indexOf('leavereject ') === 0) {
						if (_.find(config.admin, (o) => { return o === message.user; })) {
							testCase = 'LEAVEREJECT';
						} else {
							testCase = 'UNAUTHORIZED';
						}
					} else if (message.text.toLowerCase().indexOf('leavereport') === 0) {
						if (_.find(config.admin, (o) => { return o === message.user; })
							|| message.text === 'leavereport' || message.text.substr(message.text.indexOf('@') + 1, 9) === message.user) {
							testCase = 'LEAVEREPORT';
						} else {
							testCase = 'UNAUTHORIZED';
						}
					} else if (message.text.toLowerCase().indexOf('leaveset ') === 0) {
						if (_.find(config.admin, (o) => { return o === message.user; })) {
							testCase = 'LEAVESET';
						} else {
							testCase = 'UNAUTHORIZED';
						}
					} else {
						testCase = 'WRONG';
					}
				} else if ((message.text.toLowerCase() === 'holiday' || message.text.toLowerCase().indexOf('holiday') === 0)) {
					if (message.text.toLowerCase().trim() === 'holiday') {
						testCase = 'HOLIDAY';
					} else if (message.text.toLowerCase().trim() === 'holidaylist') {
						testCase = 'HOLIDAYLIST';
					}
				} else if (message.text.toLowerCase().indexOf('profile') === 0) {
					if (message.text.toLowerCase().indexOf('profile update ') === 0) {
						testCase = 'PROFILE_UPDATE';
					} else if (message.text.toLowerCase().indexOf('profile <@') === 0) {
						testCase = 'PROFILE_GET';
					} else if (message.text.toLowerCase().indexOf('profile set role ') === 0) {
						if (_.find(config.admin, (o) => { return o === message.user; })) {
							testCase = 'PROFILE_SET';
						} else { testCase = 'UNAUTHORIZED'; }
					} else { testCase = 'TASK_IN_OUT'; }
				} else if (message.text.toLowerCase().indexOf('skill') === 0) {
					if (message.text.toLowerCase().indexOf('skill add ') === 0) {
						testCase = 'SKILLS_ADD';
					} else if (message.text.toLowerCase().indexOf('skill remove ') === 0) {
						testCase = 'SKILLS_REMOVE';
					} else if (message.text.toLowerCase().indexOf('skill <@') === 0) {
						testCase = 'SKILLS_GET';
					} else { testCase = 'TASK_IN_OUT'; }
				} else if (message.text.toLowerCase().indexOf('set remainder') === 0
				&& message.user === 'U42GSR886') {
					taskReminder.setCustomRemind(message, payloadIms, message.text.substr(13));
				} else {
					testCase = 'TASK_IN_OUT';
				}
			} catch (err) {
				log.saveLogs(message.user, err, moment());
				Message.postErrorMessage(message, err);
			}
		} else if (message.subtype === 'message_changed') {
			if (message.previous_message.text.indexOf('in ') === 0 || message.previous_message.text === 'in' || message.previous_message.text === 'out' || message.previous_message.text.indexOf('out ') === 0) {
				testCase = 'NOTHING_TO_DO';
			} else {
				testCase = 'MESSAGE_EDIT';
			}
		}
		switch (testCase) {
			case 'IN' :
				userCheckIns.in(message, payloadIms, user);
				break;

			case 'OUT':
				userCheckIns.out(message);
				break;
			case 'TASK_IN_OUT':
				userCheckIns.tasksInOut(message, qod, user, '');
				break;
			case 'MESSAGE_EDIT':
				userCheckIns.editTasks(message, user);
				break;
			case 'WEEK_REPORT':
				reportHelper.specificReport(message, 'week', 1, 7, users);
				break;
			case 'MONTH_REPORT':
				reportHelper.specificReport(message, 'month', 1, 30, users);
				break;
			case 'PROFILE_UPDATE':
				profileHelper.updateProfile(message);
				break;
			case 'PROFILE_SET':
				profileHelper.updateRole(message, payloadIms);
				break;
			case 'PROFILE_GET':
				profileHelper.getProfile(message);
				break;
			case 'SKILLS_ADD':
				skillHelper.addSkills(message);
				break;
			case 'SKILLS_REMOVE':
				skillHelper.removeSkills(message);
				break;
			case 'SKILLS_GET':
				skillHelper.getSkills(message, users, payloadIms);
				break;
			case 'HELP':
				if (message.text.toLowerCase() === 'help') {
					Message.postHelpMessage(message);
				} else if (message.text.toLowerCase() === 'help report') {
					Message.postHelpReportMessage(message);
				} else if (message.text.toLowerCase() === 'help profile') {
					Message.postHelpProfileMessage(message);
				} else if (message.text.toLowerCase() === 'help leave') {
					Message.postHelpLeaveMessage(message);
				} else if (message.text.toLowerCase() === 'help admin') {
					if (_.find(config.admin, (o) => { return o === message.user; })) {
						Message.postAdminHelpMessage(message);
					} else {
						Message.postErrorMessage(message, new Error('No!..No!..No!..Restricted Area!!'));
					}
				} else {
					Message.postMessage(message, 'Help Commands:\n *help report*: to seek any type of help related to your week report, month report, leave report etc.' +
					'\n *help report*: to seek any type of help related to your week report, month report, leave report etc.' +
					'\n *help profile*: to seek any type of help related to your Profile' +
					'\n *help leave*: to seek any type of help related to LEAVE' +
					'\n *help admin*: If you are the admin');
				}
				break;
			case 'NOTHING_TO_DO':
				Message.postErrorMessage(message, new Error('You can only edit task listing messages! :sweat_smile:'));
				break;
			case 'WRONG':
				Message.postErrorMessage(message, new Error(':confused: \nInvalid Command'));
				break;
			case 'UNAUTHORIZED':
				Message.postErrorMessage(message, new Error('\nNo No No !!! It\'s Rescricted area ....!! :rage:'));
				break;
			case 'LEAVE':
				leaveHelper.leave(message, user, payloadIms);
				break;
			case 'LEAVEACCEPT':
				leaveHelper.leaveAccept(message, user, payloadIms);
				break;
			case 'LEAVEREJECT':
				leaveHelper.leaveReject(message, user, payloadIms);
				break;
			case 'LEAVEREPORT':
				reportHelper.leaveReport(message, users);
				break;
			case 'LEAVESET':
				leaveHelper.leaveSet(message, user);
				break;
			case 'HOLIDAY':
				leaveHelper.holiday(message);
				break;
			case 'HOLIDAYLIST':
				leaveHelper.holidayList(message);
				break;
			case 'EXCEL':
				excelHelper.makeExcelSheet(message);
				break;
			default:
				break;
		}
	}
});

const userCheckIn = new CronJob({
	cronTime: '0 35 8,18 * * 1-6',
	// cronTime: '*/5 * * * * *',
	onTick() {
		let text = '';
		let onLeaveUserList = '';
		let onTodayLeaveList = '';
		let onTodayBirthDayList = '';
		let onTodayBirthDayListCheckOut = '';
		let leaveDeclare = '';
		const todayLeaveuserList = [];
		request('http://quotes.rest/qod.json', (error, response, body) => {
			try {
				body = JSON.parse(body);
				qod = `*\`Quote of the day :\`* \n*${body.contents.quotes[0].quote}* - \`${body.contents.quotes[0].author}\``;
			} catch (e) {
				qod = '';
			}
		});
		if (reminder || leaveDays === 0) {
			const todayAsDMY = DateHelper.getDateAsDDMMYYYY(new Date());
			const tommorrowAsDMY = DateHelper.getDateAsDDMMYYYY(moment().add(1, 'days').toDate());
			LeaveMdl.isHoliday(todayAsDMY)
			.then((leave) => {
				if (leave) {
					throw new Error('Leave Day');
				}
				return Promise.all([LeaveMdl.getLeaveRequestByDate(moment().startOf('day')), LeaveMdl.getLeaveRequestByDateRange(moment().startOf('day')), LeaveMdl.isHoliday(tommorrowAsDMY)]);
			})
			.then(([tommorowLeaveList, todayLeaveList, tommorowHoliday]) => {
				if (tommorowLeaveList.length) {
					onLeaveUserList = `${onLeaveUserList}\n---------------------------------------------\n*Tommorow's leave(s) :*\n---------------------------------------------\n`;
					tommorowLeaveList.forEach((leave) => {
						onLeaveUserList = `${onLeaveUserList}\n*\`${leave.real_name || leave.name}\`* is on leave from \`tommorow\`\n*From date: * ${moment(leave.fromDate).format('Do MMM gggg (ddd)')}\n*To Date: * ${moment(leave.toDate).format('Do MMM gggg (ddd)')}\n*Days : * ${leave.days} Days\n*Reason: * ${leave.reason}\n`;
					});
				}
				// ignore who dont want notification (dual channel) - arpit (U2HG4B24R),dk (U1XM7QFKR)
				todayLeaveList = todayLeaveList.filter((leave) => {
					return (leave.id !== 'U2HG4B24R' && leave.id !== 'U17JYB073');
				});
				if (todayLeaveList.length) {
					onTodayLeaveList = `${onTodayLeaveList}\n---------------------------------------------\n*Today's leave(s) :*\n---------------------------------------------\n`;
					todayLeaveList.forEach((leave) => {
						onTodayLeaveList = `${onTodayLeaveList}\n*\`${leave.real_name || leave.name}\`* \n*From date: * ${moment(leave.fromDate).format('Do MMM gggg (ddd)')}\n*To Date: * ${moment(leave.toDate).format('Do MMM gggg (ddd)')}\n*Days : * ${leave.days} Days\n*Reason: * ${leave.reason}\n`;
						todayLeaveuserList.push(leave.id);
					});
				}
				if (reminder === true) {
					leaveDeclare = `\n:santa: :confetti_ball: :tada:\n\n*\`Hey We have holiday for next ${(leaveDays - 1) / 2} day(s) due to ${leaveReasons}\`*\n\n I will miss you. enjoy holiday:confetti_ball::tada:`;
					reminder = false;
					leaveDays -= 1;
				}
				if (tommorowHoliday) {
					leaveDeclare = `\n:santa: :confetti_ball: :tada:\n\n*\`Hey We have holiday for next ${tommorowHoliday.leaveDays} day(s) due to ${tommorowHoliday.reason}\`*\n\n I will miss you. enjoy holiday:confetti_ball::tada:`;
				}
				profileHelper.getTodayBirthDays().then((birthdays) => {
					if (birthdays[0]) {
						onTodayBirthDayList = `${onTodayBirthDayList}---------------------------------------------\n* Birthday(s) :*\n---------------------------------------------\n`;
						birthdays.forEach((b) => {
							const year = new Date(b.birthDay).getYear() + 1900;
							if ((((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0)) && b.daysTillBirthday !== 0) {
								b.daysTillBirthday -= 1;
							}
							if (b.daysTillBirthday === 0) {
								onTodayBirthDayList = `${onTodayBirthDayList}\nIt's *${b.real_name}*'s birthday Today!!`;
							} else if (b.daysTillBirthday === 1) {
								onTodayBirthDayListCheckOut = (onTodayBirthDayListCheckOut !== '') ? onTodayBirthDayListCheckOut : '\n\nDon\'t Forget...';
								onTodayBirthDayList = `${onTodayBirthDayList}\n*${b.real_name}* has birthday tomorrow :birthday:`;
								onTodayBirthDayListCheckOut = `${onTodayBirthDayListCheckOut}\n\n *${b.real_name}* has birthday tomorrow :birthday:`;
							} else {
								onTodayBirthDayList = `${onTodayBirthDayList}\n*${b.real_name}* has birthday on ${dateFormat(new Date(b.birthDay), 'mmmm dS')} :birthday:`;
							}
						});
					}
					payloadIms.forEach((ims) => {
						let user = _.find(users, { id: ims.user });
						const isUserOnLeave = todayLeaveuserList.indexOf(ims.user);
						user = isUserOnLeave === -1 ? user : null;
						if (user) {
							if (moment().format('HH').toString() === '08') {
								text = `Good Morning *\`${user.real_name}\`*:city_sunrise::sun_small_cloud:\n\nLet's check you in.\n proceed by entering *\`in\`* command`;
								text = `${text}\n${onLeaveUserList}${onTodayLeaveList}${onTodayBirthDayList}`;
								if (_.find(birthdays, (b) => { return b.id === ims.user && b.daysTillBirthday === 0; })) {
									slack.chat.postMessage({
										token: config.token,
										channel: config.postChannelId,
										// channel: 'D41UHUHS8',
										as_user: true,
										title: 'Title',
										text: `*${user.real_name}* has birthday today`,
										attachments: [
											{
												color: '#36a64f',
												fallback: `${user.real_name} has birthday today `,
												title: `Happy Birthday <@${user.id}> :birthday:`,
												text: `\n\n${birthDayMsgs[Math.floor((Math.random() * (birthDayMsgs.length - 1)))]} :cake: :cake:\n\nPS: When's Party?? :smile::yum: `,
												thumb_url: user.image_192,
											}
										]
									}, (errSave, data) => {
										if (errSave) {
											log.saveLogs('Cron JOB', errSave, moment());
										}
									});
								}
							} else {
								text = `A Gentle reminder for you *\`${user.real_name}\`*\nDon't forget to checkout when you leave the office by entering *\`out\`* command\n${leaveDeclare}${onTodayBirthDayListCheckOut}`;
							}
							// if (ims.id === 'D41UHUHS8') {
							slack.chat.postMessage({
								token: config.token,
								channel: ims.id,
								as_user: true,
								title: 'Title',
								text,
							}, (errSave, data) => {
								if (errSave) {
									log.saveLogs('Cron JOB', errSave, moment());
								}
							});
							// }
						}
					});
				});
			})
			.catch((e) => {
				log.saveLogs('Cron JOB(dailyReminder)', e, moment());
			});
		} else {
			leaveDays -= 1;
		}
	},
	start: false,
	timeZone: 'Asia/Kolkata'
});

bot.listen({ token });

userCheckIn.start();
