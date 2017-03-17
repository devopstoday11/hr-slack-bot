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
const DateHelper = require('./helper/date_parser');
const taskReminder = require('./scheduler');

mongoose.connect(config.mongoURL);

const bot = slack.rtm.client();
const token = config.token;
const timeRegex = new RegExp('^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');
const users = [];
const app = apiai(config.apiai);

let time;
let	spaceIndex;
let	userId;
let userTemp;
let	commands;
let attachment = [];
let attach;
let payloadIms;
let leaveDays = 0;
let reminder = false;
let leaveReasons;
let qod = '';
bot.started((payload) => {
	const payloadUsers = payload.users;
	payloadIms = payload.ims;
	payloadUsers.forEach((user) => {
		if (!user.is_bot && user.name !== 'slackbot') {
			user.image_192 = user.profile.image_192;
			const dbUser = new UserMdl(user);
			users.push(dbUser);
			UserMdl.update({ id: user.id }, user, { upsert: true, setDefaultsOnInsert: true }, (err, result) => {
			});
		}
	});
	// store ims of each user, to send messages at every 9:00 AM
	// direct sending messages using IMS array,so ims schema is not required
	// payloadIms.forEach((ims) => {
	// 	const newIms = {
	// 		userId: ims.user,
	// 		channelId: ims.id
	// 	};
	// 	const imsAdd = new ImsMdl(newIms);
	// 	imsAdd.save((err, resp) => {
	// 		if (err) log.saveLogs(resp.userid, err, moment());
	// 	});
	// });
});

const userCheckIn = new CronJob({
	cronTime: '0 30 8,18 * * 1-6',
	// cronTime: '*/20 * * * * *',
	onTick() {
		let text = '';
		let onLeaveUserList = '';
		let leaveDeclare = '';
		const todayLeaveuserList = [];
		request('http://quotes.rest/qod.json', (error, response, body) => {
			body = JSON.parse(body);
			qod = `*\`Quote of the day :\`* \n*${body.contents.quotes[0].quote}* - \`${body.contents.quotes[0].author}\``;
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
					tommorowLeaveList.forEach((leave) => {
						onLeaveUserList = `${onLeaveUserList}\n*\`${leave.real_name || leave.name}\`* is on leave from \`tommorow\`\n*From date: * ${moment(leave.fromDate).format('Do MMM gggg (ddd)')}\n*To Date: * ${moment(leave.toDate).format('Do MMM gggg (ddd)')}\n*Days : * ${leave.days} Days\n*Reason: * ${leave.reason}\n`;
					});
				}
				todayLeaveList.forEach((leave) => {
					todayLeaveuserList.push(leave.id);
				});
				if (reminder === true) {
					leaveDeclare = `\n:santa: :confetti_ball: :tada:\n\n*\`Hey We have holiday for next ${(leaveDays - 1) / 2} day(s) due to ${leaveReasons}\`*\n\n I will miss you. enjoy holiday:confetti_ball::tada:`;
					reminder = false;
					leaveDays -= 1;
				}
				if (tommorowHoliday) {
					leaveDeclare = `\n:santa: :confetti_ball: :tada:\n\n*\`Hey We have holiday for next ${tommorowHoliday.leaveDays} day(s) due to ${tommorowHoliday.reason}\`*\n\n I will miss you. enjoy holiday:confetti_ball::tada:`;
				}
				payloadIms.forEach((ims) => {
					let user = _.find(users, { id: ims.user });
					const isUserOnLeave = todayLeaveuserList.indexOf(ims.user);
					user = isUserOnLeave === -1 ? user : null;
					if (user) {
						if (moment().format('HH').toString() === '08') {
							text = `Good Morning *\`${user.real_name}\`*:city_sunrise::sun_small_cloud:\n\nLet's check you in.\n proceed by entering *\`in\`* command`;
							// if (_.find(config.admin, (o) => { return o === user.id; })) {
							text = `${text}\n${onLeaveUserList}`;
							// }
						} else {
							text = `A Gentle reminder for you *\`${user.real_name}\`*\nDon't forget to checkout when you leave the office by entering *\`out\`* command\n${leaveDeclare}`;
						}
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
					}
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
				if (message.text.toLowerCase() === 'in' || message.text.toLowerCase().indexOf('in ') === 0) {
					testCase = 'IN';
				} else if (message.text.toLowerCase() === 'out' || message.text.toLowerCase().indexOf('out ') === 0) {
					testCase = 'OUT';
				} else if (message.text.toLowerCase() === 'week' || message.text.toLowerCase().indexOf('week ') === 0) {
					if (message.text.toLowerCase().indexOf('week <@') === 0) {
						if (_.find(config.admin, (o) => { return o === message.user; })) {
							testCase = 'WEEK_REPORT';
						} else {
							testCase = 'UNAUTHORIZED';
						}
					} else {
						testCase = 'WRONG';
					}
				} else if (message.text.toLowerCase() === 'month' || message.text.toLowerCase().indexOf('month ') === 0) {
					if (message.text.toLowerCase().indexOf('month <@') === 0) {
						if (_.find(config.admin, (o) => { return o === message.user; })) {
							testCase = 'MONTH_REPORT';
						} else {
							testCase = 'UNAUTHORIZED';
						}
					} else {
						testCase = 'WRONG';
					}
				} else if (message.text.toLowerCase() === 'help' || message.text.toLowerCase().indexOf('help ') === 0) {
					testCase = 'HELP';
				} else if (message.text.toLowerCase() === 'excel' || message.text.toLowerCase().indexOf('excel ') === 0) {
					if (message.text.toLowerCase().indexOf('excel <@') === 0) {
						if (_.find(config.admin, (o) => { return o === message.user; })) {
							testCase = 'EXCEL';
						} else {
							testCase = 'UNAUTHORIZED';
						}
					} else {
						testCase = 'WRONG';
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
					} else if (message.text.toLowerCase().indexOf('leavereport ') === 0) {
						if (message.text.toLowerCase().indexOf('leavereport <@') === 0) {
							if (_.find(config.admin, (o) => { return o === message.user; })) {
								testCase = 'LEAVEREPORT';
							} else {
								testCase = 'UNAUTHORIZED';
							}
						} else {
							testCase = 'WRONG';
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
				} else if (message.text.toLowerCase() === 'holiday') {
					testCase = 'HOLIDAY';
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
				DB.getTodayTimesheet(message.user)
			.then((timesheet) => {
				if (timesheet) {
					if (timesheet.outTime) {
						throw new Error('Seems like you already left office cya tommorow:wink:');
					}
					throw new Error('You have already checked in so please concentrate on your work :wink::unamused:');
				} else {
					if (message.text.toLowerCase() === 'in') {
						time = moment().format('HH:mm');
					} else {
						spaceIndex = message.text.indexOf(' ');
						if (message.text.substr(0, spaceIndex).toLowerCase() === 'in') {
							time = message.text.substr(spaceIndex + 1);
							if (!timeRegex.test(time)) {
								throw new Error('Please enter valid time in HH:MM format.\nThe 24-hour clock was developed by ancient Egyptians, So please don\'t disrespect them and please enter valid time');
							}
						} else {
							throw new Error('Invalid Command');
						}
					}
					DB.saveTimesheet(user, time)
					.then((data) => {
						return data;
					})
					.catch((err) => {
						log.saveLogs(message.user, err, moment());
						Message.postErrorMessage(message, err);
					});
				}
			}).then((data) => {
				taskReminder.setReminder(message, data, new Date().getTime());
				Message.postMessage(message, 'What are the tasks that you are going to perform today?');
			}).catch((err) => {
				log.saveLogs(message.user, err, moment());
				Message.postErrorMessage(message, err);
			});
				break;

			case 'OUT':
				DB.getTodayTimesheet(message.user)
				.then((timesheet) => {
					if (!timesheet) {
						throw new Error('Not in');
					} else if (timesheet.outTime !== null) {
						throw new Error('Seems like you already left office cya tommorow:wink:');
					} else {
						if (message.text.toLowerCase() === 'out') {
							time = moment().format('HH:mm');
						} else {
							spaceIndex = message.text.indexOf(' ');
							time = message.text.substr(spaceIndex + 1);
							if (timeRegex.test(time)) {
								//
							} else {
								throw new Error('Invalid time format, Its `HH:MM` so please be kind in entering valid time and save your time and ours too ...  ');
							}
						}
						DB.outUser(timesheet, time)
							.then((data) => {
								return true;
							}).then(() => {
								Message.postMessageWithAttachment(message, '\nWhich of the below tasks you have completed today?\n', timesheet.tasks);
							});
					}
				}).catch((err) => {
					log.saveLogs(message.user, err, moment());
					Message.postErrorMessage(message, err);
				});
				break;
			case 'TASK_IN_OUT':
			// console.log('In Out Message :',message);
				DB.getTodayTimesheet(message.user)
					.then((timesheet) => {
						const task = message.text;
						if (timesheet) {
							if (!timesheet.outTime && !timesheet.tasks) {
								DB.saveTask(timesheet, task, message.ts)
										.then((updatedTime) => {
											Message.postMessage(message, 'You have successfully checked in and your tasks are posted in `daily-scrum`\n All the best for the day');
											Message.postChannelInMessage(message, updatedTime, user, 'msgTs');
										}).catch((err) => {
											log.saveLogs(message.user, err, moment());
										});
							} else if (timesheet.outTime && !timesheet.taskDone) {
								DB.saveTaskDone(timesheet, task, message.ts)
									.then((updatedTime) => {
										const linkIndex = Math.floor(Math.random() * links.length);
										Message.postMessage(message, `You have successfully checked out and your completed tasks are posted in \`daily-scrum\`\n Have a good night\n\n ${qod}`);
										Message.postChannelOutMessage(message, updatedTime, user, 'msgDoneTs');
									}).catch((err) => {
										log.saveLogs(message.user, err, moment());
									});
							} else {
								const request1 = app.textRequest(message.text, {
									sessionId: message.user
								});

								request1.on('response', (response) => {
									Message.postMessage(message, response.result.fulfillment.speech);
								});

								request1.on('error', (error) => {
									console.log(error);
								});

								request1.end();
							}
						} else {
							throw new Error('You first need to enter in the office to start conversation :wink:');
						}
					}).catch((err) => {
						log.saveLogs(message.user, err, moment());
						Message.postErrorMessage(message, err);
					});
				break;
			case 'MESSAGE_EDIT':
				DB.getTodayTimesheet(message.message.user)
						.then((timesheet) => {
							if (message.previous_message.ts === timesheet.taskTs) {
								DB.saveTask(timesheet, message.message.text, timesheet.taskTs)
								.then(() => {
									Message.updateChannelInMessage(timesheet, timesheet.msgTs, user, message.message.text);
									Message.updateChannelOutMessage(timesheet, timesheet.msgDoneTs, message.message.text, user, timesheet.taskDone);
								});
							} else if (message.previous_message.ts === timesheet.taskDoneTs) {
								DB.saveTaskDone(timesheet, message.message.text, timesheet.taskDoneTs)
								.then(() => {
									Message.updateChannelOutMessage(timesheet, timesheet.msgDoneTs, timesheet.tasks, user, message.message.text);
								});
							}
						});
				break;
			case 'WEEK_REPORT':
				specificReport(message, 'week', 1, 7);
				break;
			case 'MONTH_REPORT':
				specificReport(message, 'month', 1, 30);
				break;
			case 'HELP':
				if (_.find(config.admin, (o) => { return o === message.user; })) {
					Message.postAdminHelpMessage(message);
				} else {
					Message.postHelpMessage(message);
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
							LeaveMdl.saveLeaveRequest(user, toDate, fromDate, reason)
							.then((newLeaveReport) => {
								Message.postMessage(message, `Your leave request has been sent to admins for approval\n*Request Id : * *\`${newLeaveReport.leaveCode}\`*\n Sit back and relax I will notify you when I get update on this request.`);
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
							})
							.catch((e) => {
								Message.postErrorMessage(message, new Error('\nThere is some problem serving you request. Please try again till then I will repair myself.'));
							});
						} else {
							Message.postErrorMessage(message, new Error(`I think ${DateHelper.getDateAsDDMMYYYY(fromDate)} is larger than ${DateHelper.getDateAsDDMMYYYY(toDate)} or you are doing something wrong\n I thought you are inteligent ,Sorry my mistake :wink:`));
						}
					} else {
						Message.postErrorMessage(message, new Error('You are not a good reader. Help command clearly says DD-MM-YYYY format :wink:'));
					}
				}
				break;
			case 'LEAVEACCEPT':
				let leaveDoc;
				let acceptCommand = [];
				acceptCommand = message.text.split(' ');
				const note = acceptCommand.slice(2, acceptCommand.length).join(' ');
				LeaveMdl.getLeaveRequest(acceptCommand[1])
				.then((leaveDataDoc) => {
					leaveDoc = leaveDataDoc;
					if (leaveDoc.isApproved) {
						Message.postErrorMessage(message, new Error(`\n${leaveDoc.actionBy || 'Someone'} have alreay accepted this request`));
						return false;
					} else {
						return LeaveMdl.updateLeaveRequest(leaveDoc._id, true, note, user.real_name);
					}
				})
				.then((leaveDataDoc) => {
					if (leaveDataDoc) {
						leaveDoc.isApproved = true;
						leaveDoc.note = note;
						const userChannel = _.find(payloadIms, { user: leaveDoc.id });
						Message.postLeaveStatusMessage(userChannel.id, leaveDoc);
						Message.postMessage(message, 'Leave has been *`accepted`*');
					}
				})
				.catch((e) => {
					Message.postErrorMessage(message, new Error('\nThere is some problem serving you request. Please try again till then I will repair myself.'));
				});
				break;
			case 'LEAVEREJECT':
				let leaveDocument;
				let rejectCommand = [];
				rejectCommand = message.text.split(' ');
				const rejectNote = rejectCommand.slice(2, rejectCommand.length).join(' ');
				LeaveMdl.getLeaveRequest(rejectCommand[1])
				.then((leaveDataDoc) => {
					leaveDocument = leaveDataDoc;
					if (leaveDocument.isApproved === false) {
						Message.postErrorMessage(message, new Error(`\n${leaveDocument.actionBy || 'Someone'} have alreay rejected this request`));
						return false;
					} else {
						return LeaveMdl.updateLeaveRequest(leaveDocument._id, false, rejectNote, user.real_name);
					}
				})
				.then((leaveDataDoc) => {
					if (leaveDataDoc) {
						leaveDocument.isApproved = false;
						leaveDocument.note = rejectNote;
						const userChannel = _.find(payloadIms, { user: leaveDocument.id });
						Message.postLeaveStatusMessage(userChannel.id, leaveDocument);
						Message.postMessage(message, 'Leave has been *`rejected`*');
					}
				})
			.catch((e) => {
				Message.postErrorMessage(message, new Error('\nThere is some problem serving you request. Please try again till then I will repair myself.'));
			});
				break;
			case 'LEAVEREPORT':
				leaveReport(message);
				break;
			case 'LEAVESET':
				const setLeaveCommand = message.text.split(' ');
				if (setLeaveCommand.length >= 4) {
					if (isNaN(setLeaveCommand[1]) || isNaN(setLeaveCommand[2])) {
						if (!DateHelper.isValidDate(setLeaveCommand[1])) {
							Message.postErrorMessage(message, new Error('Invalid Date or leave days'));
						} else {
							const parseDate = DateHelper.parseDate(setLeaveCommand[1]);
							const holiday = new HolidayMdl({
								leaveDate: DateHelper.getDateAsDDMMYYYY(parseDate),
								reason: setLeaveCommand.slice(3, setLeaveCommand.length).join(' '),
								addedBy: user.real_name,
								leaveDays: setLeaveCommand[2],
								isoDate: parseDate
							});
							holiday.save((err, response) => {
								if (err) {
									log.saveLogs(response.username, err, moment());
									Message.postErrorMessage(message, new Error('\nThere is some problem serving you request. Please try again till then I will repair myself.'));
								} else {
									Message.postMessage(message, `Leave has been set on *${response.leaveDate}* for *${response.reason}*`);
								}
							});
						}
					} else if (parseInt(moment().format('HH'), 10) < 18) {
						leaveDays = (parseInt(setLeaveCommand[1], 10) * 2) + 1;
						leaveReasons = setLeaveCommand.slice(2, setLeaveCommand.length).join(' ');
						reminder = true;
						Message.postMessage(message, 'Leave has been set');
					} else {
						Message.postErrorMessage(message, new Error(':confused: \nCan not add holiday after 18:00'));
					}
				} else {
					Message.postErrorMessage(message, new Error(':confused: \nInvalid Command'));
				}

				break;
			case 'HOLIDAY':
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
				break;
			case 'EXCEL':
				try {
					const styles = {
						headerDark: {
							fill: {
								fgColor: {
									rgb: 'C0C0C0'
								},
								sz: 15,
								height: 20
							},
							font: {
								color: {
									rgb: '000000'
								},
								sz: 14,
								bold: true,
								underline: true
							}
						}
					};
				// Array of objects representing heading rows (very top)
				// Here you specify the export structure
					const specification = {
						date: {
							displayName: 'Date',
							headerStyle: styles.headerDark,
							width: '20'
						},
						inTime: {
							displayName: 'Checked in time',
							headerStyle: styles.headerDark,
							width: '20'
						},
						outTime: {
							displayName: 'Checked out time',
							headerStyle: styles.headerDark,
							width: '20'
						},
						actualInTime: {
							displayName: 'Actual in time',
							headerStyle: styles.headerDark,
							width: '20'
						},
						tasksPlanned: {
							displayName: 'Planned tasks',
							headerStyle: styles.headerDark,
							width: '30'
						},
						tasksCompleted: {
							displayName: 'Completed tasks',
							headerStyle: styles.headerDark,
							width: '30'
						},
					};
					const dataset = [];
					let datasetTemp = [];
					spaceIndex = message.text.indexOf(' ');
					if (message.text.substr(0, spaceIndex) === 'excel') {
						userId = message.text.substr(spaceIndex + 3, 9);
					}
					DB.getSpecificTimesheet(userId, 1, 30)
				.then((timesheet) => {
					if (typeof timesheet[0] === 'undefined') {
						throw new Error('No data to fetch!');
					}
					const heading = [
					[{ value: 'Name', style: styles.headerDark }, { value: 'User Name', style: styles.headerDark }],
					[`${timesheet[0].userRealname}\t`, `${timesheet[0].username}`]
					];
					timesheet.forEach((t, index) => {
						datasetTemp = {
							date: t.createdAt,
							inTime: t.inTime,
							outTime: t.outTime,
							actualInTime: t.actualInTime,
							tasksPlanned: t.tasks,
							tasksCompleted: t.taskDone
						};
						dataset.push(datasetTemp);
					});
					const report = excel.buildExport(
						[
							{
								name: 'User Report',
								heading,
								specification,
								data: dataset
							}
						]
					);

					fs.writeFile(`${__dirname}/sheets/${timesheet[0].username}.xlsx`, report, (res2, err) => {
						if (err) log.saveLogs(message.user, err, moment());
						request.post({
							url: 'https://slack.com/api/files.upload',
							formData: {
								token: config.token,
								title: 'User Report',
								filename: `${timesheet[0].username}.xlsx`,
								filetype: 'auto',
								channels: message.channel,
								file: fs.createReadStream(`${__dirname}/sheets/${timesheet[0].username}.xlsx`),
							},
						}, (error, response) => {
							if (error) log.saveLogs(message.user, err, moment());
						});
					});
				}).catch((err) => {
					log.saveLogs(message.user, err, moment());
					Message.postErrorMessage(message, err);
				});
				} catch (err) {
					log.saveLogs(message.user, err, moment());
					Message.postErrorMessage(message, err);
				}
				break;
			default:
				break;
		}
	}
});

function specificReport(message, timePeriod, start, end) {
	try {
		spaceIndex = message.text.indexOf(' ');
		if (message.text.substr(0, spaceIndex).toLowerCase() === timePeriod) {
			userId = message.text.substr(spaceIndex + 3, 9);
		}
		userTemp = _.find(users, (o) => { return o.id === userId; });
		if (userTemp.id !== userId) {
			Message.postErrorMessage(message, new Error('USER NOT FOUND'));
		} else {
			DB.getSpecificTimesheet(userId, start, end)
			.then((timesheet) => {
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
				Message.postSpecificReport(timesheet, attachment, timePeriod, message);
				attachment = [];
			});
		}
	} catch (e) {
		log.saveLogs(message.user, e, moment());
	}
}

function leaveReport(message) {
	try {
		spaceIndex = message.text.indexOf(' ');
		userId = message.text.substr(spaceIndex + 3, 9);
		userTemp = _.find(users, (o) => { return o.id === userId; });
		if (userTemp.id !== userId) {
			Message.postErrorMessage(message, new Error('USER NOT FOUND'));
		} else {
			Message.postLeaveReport(message, userId);
		}
	} catch (e) {
		log.saveLogs(message.user, e, moment());
	}
}

bot.listen({ token });

userCheckIn.start();
