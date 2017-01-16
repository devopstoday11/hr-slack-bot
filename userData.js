/* eslint-disable no-case-declarations */
const slack = require('slack');
const config = require('./config');
const mongoose = require('mongoose');
const UserMdl = require('./schemas/user');
const TimeMdl = require('./schemas/timesheet');
const DB = require('./models');
const Message = require('./messages');
const moment = require('moment');
const _ = require('lodash');
const excel = require('node-excel-export');
const fs = require('fs');
const request = require('request');
const log = require('./helper/logger');

const temp = [];

const bot = slack.rtm.client();
const token = config.token;

const timeRegex = new RegExp('^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');

mongoose.connect(config.mongoURL);

const users = [];
let time;
let	spaceIndex;
let	userId;
let userTemp;
let	commands;
let attachment = [];
let attach;

function specificReport(message, timePeriod, start, end) {
	spaceIndex = message.text.indexOf(' ');
	if (message.text.substr(0, spaceIndex) === timePeriod) {
		userId = message.text.substr(spaceIndex + 3, 9);
	}
	userTemp = _.find(users, (o) => { return o.id === userId; });
	if (userTemp.id !== userId) {
		Message.postErrorMessage(message, new Error('USER NOT FOUND'));
	} else {
		DB.getSpecificTimesheet(userId, start, end)
		.then((timesheet) => {
			let i = 1;
			timesheet.forEach((t, index) => {
				const colorCode = ['#0000FF', '#36a64f'];
				attach = {
					color: colorCode[i % 2],
					title: `${moment(t.createdAt).format('DD-MM-YYYY')}`,
					text: `check in time : ${t.inTime} \ncheck out time : ${t.outTime}\n\nTasks planned : \n${t.tasks} \n\nCompleted task: \n${t.taskDone}  `,
					ts: `${t.taskDone}`
				};
				attachment.push(attach);
				i += 1;
			});
			Message.postSpecificReport(timesheet, attachment, timePeriod);
			attachment = [];
		});
	}
}
// do something with the rtm.start payload
bot.started((payload) => {
	const payloadUsers = payload.users;
	payloadUsers.forEach((user) => {
		if (!user.is_bot && user.name !== 'slackbot') {
			const dbUser = new UserMdl(user);
			users.push(dbUser);
			UserMdl.update({ id: user.id }, user, { upsert: true, setDefaultsOnInsert: true }, (err, result) => {
				console.log(user.real_name, user.id);
			});
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
	// console.log('\n******************************\n', message, '\n******************************\n');
	const user = _.find(users, { id: message.user });
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
			} else {
				testCase = 'TASK_IN_OUT';
			}
		} catch (err) {
			log.saveLogs(message.user, err, new Date());
		}
	} else if (message.subtype === 'message_changed') {
		if (message.previous_message.text.indexOf('in ') === 0 || message.previous_message.text === 'in' || message.previous_message.text === 'out' || message.previous_message.text.indexOf('out ') === 0) {
			testCase = 'NOTHING_TO_DO';
		} else {
			testCase = 'MESSAGE_EDIT';
		}
	}
	switch (testCase) {
		case 'IN' : console.log('----------------------- IN -------------------------\n');
			DB.getTodayTimesheet(message.user)
		.then((timesheet) => {
			if (timesheet) {
				console.log('----------------------- ALREADY IN -------------------------\n');
				throw new Error('Already in :unamused:');
			} else {
				console.log('----------------------- FIRST TIME IN -------------------------\n');
				if (message.text.toLowerCase() === 'in') {
					time = moment().format('HH:mm');
					console.log('----------------------- NO TIME -------------------------\n');
				} else {
					console.log('----------------------- WITH TIME -------------------------\n');
					spaceIndex = message.text.indexOf(' ');
					if (message.text.substr(0, spaceIndex) === 'in') {
						time = message.text.substr(spaceIndex + 1);
						if (timeRegex.test(time)) {
							console.log('----------------------- VALID TIME -------------------------\n');
						} else {
							console.log('----------------------- INVALID TIME -------------------------\n');
							throw new Error('Please enter valid time in HH:MM format ... :face_with_rolling_eyes:');
						}
					} else {
						throw new Error('Invalid time');
					}
				}
				DB.saveTimesheet(user, time)
				.then((data) => {
					console.log('----------------------- USER IS IN -------------------------\n');
					return true;
				})
				.catch((err) => {
					log.saveLogs(message.user, err, new Date());
					Message.postErrorMessage(message, err);
				});
			}
		}).then(() => {
			Message.postMessage(message, 'What are the tasks you are going to complete today?');
		}).catch((err) => {
			log.saveLogs(message.user, err, new Date());
			Message.postErrorMessage(message, err);
		});
			break;
		case 'OUT':
			console.log('----------------------- OUT -------------------------\n');
			DB.getTodayTimesheet(message.user)
			.then((timesheet) => {
				if (!timesheet) {
					console.log('----------------------- NOT IN -------------------------\n');
					throw new Error('Not in');
				} else if (timesheet.outTime !== null) {
					console.log('----------------------- ALREADY OUT -------------------------\n');
					throw new Error('Already Out :unamused:');
				} else {
					console.log('----------------------- FIRST TIME OUT -------------------------\n');
					if (message.text.toLowerCase() === 'out') {
						time = moment().format('HH:mm');
						console.log('----------------------- NO TIME -------------------------\n');
					} else {
						console.log('----------------------- WITH TIME -------------------------\n');
						spaceIndex = message.text.indexOf(' ');
						time = message.text.substr(spaceIndex + 1);
						if (timeRegex.test(time)) {
							console.log('----------------------- VALID TIME -------------------------\n');
						} else {
							console.log('----------------------- INVALID TIME -------------------------\n');
							throw new Error('Please enter valid time in HH:MM format ... :face_with_rolling_eyes: ');
						}
					}
					DB.outUser(timesheet, time)
						.then((data) => {
							console.log('----------------------- USER IS OUT -------------------------\n');
							return true;
						}).then(() => {
							Message.postMessageWithAttachment(message, '\nWhich of the below tasks you have completed today?\n', timesheet.tasks);
						});
				}
			}).catch((err) => {
				log.saveLogs(message.user, err, new Date());
				Message.postErrorMessage(message, err);
			});
			break;
		case 'TASK_IN_OUT':
			DB.getTodayTimesheet(message.user)
				.then((timesheet) => {
					const task = message.text;
					if (timesheet) {
						if (!timesheet.outTime && !timesheet.tasks) {
							DB.saveTask(timesheet, task, message.ts)
									.then((updatedTime) => {
										Message.postChannelMessage(message, updatedTime, updatedTime.inTime, 'Today\'s Tasks', 'msgTs');
										Message.postMessage(message, ':thumbsup_all:');
										console.log('-----------------tasks added------------------\n');
									}).catch((err) => {
										log.saveLogs(message.user, err, new Date());
									});
						} else if (timesheet.outTime && !timesheet.taskDone) {
							DB.saveTaskDone(timesheet, task, message.ts)
								.then((updatedTime) => {
									Message.postChannelMessage(message, updatedTime, updatedTime.outTime, 'Completed Tasks', 'msgDoneTs');
									Message.postMessage(message, ':thumbsup_all:');
									console.log('-----------------taskDone added------------------\n');
								}).catch((err) => {
									log.saveLogs(message.user, err, new Date());
								});
						} else {
							console.log('--------------USER HAS ALREADY ADDED TASKS,CAN\'T ADD MORE-----------');
							throw new Error('Wrong Command!! :sweat_smile: \n\nYou have already added tasks\nYou can\'t add more tasks,You can still edit old ones! :wink: ');
						}
					} else {
						console.log('--------------USER IS NOT IN------------');
						throw new Error('User is not in :face_with_rolling_eyes: ');
					}
				}).catch((err) => {
					log.saveLogs(message.user, err, new Date());
					Message.postErrorMessage(message, err);
				});
			break;
		case 'MESSAGE_EDIT':
			DB.getTodayTimesheet(message.message.user)
					.then((timesheet) => {
						if (message.previous_message.ts === timesheet.taskTs) {
							DB.saveTask(timesheet, message.message.text, timesheet.taskTs)
							.then(() => {
								Message.updateChannelMessage(timesheet, timesheet.msgTs, message.message.text, 'Today\'s Tasks');
								console.log('----------------TASK MESSAGE EDITED----------------\n');
								console.log('----------------CHANNEL MESSAGE EDITED----------------\n');
							});
						} else if (message.previous_message.ts === timesheet.taskDoneTs) {
							DB.saveTaskDone(timesheet, message.message.text, timesheet.taskDoneTs)
							.then(() => {
								Message.updateChannelMessage(timesheet, timesheet.msgDoneTs, message.message.text, 'Today\'s Tasks');
								console.log('----------------CHANNEL MESSAGE EDITED----------------\n');
								console.log('----------------TASK DONE MESSAGE EDITED----------------\n');
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
			commands = 'List Of Commands :point_down: \nIN/IN HH:MM : when you start the work. :walking:  \n' +
			'OUT/OUT HH:MM : when you leave. :v: ' +
			'\n\nYou can enter the tasks only one time, after that, you can only edit that message. :thumbsup_all: \n\n\n' +
			'Only for HR :grin: : \nWEEK @user : To get last week timesheet of @user.\n' +
			'MONTH @user : to get last month activities of @user.';
			Message.postErrorMessage(message, new Error(commands));
			console.log('-----------EDITED OTHER MESSAGE------------');
			break;
		case 'NOTHING_TO_DO':
			Message.postErrorMessage(message, new Error('You can only edit task description messages! :sweat_smile:'));
			console.log('-----------EDITED OTHER MESSAGE------------');
			break;
		case 'WRONG':
			Message.postErrorMessage(message, new Error('Wrong command! :joy: \nInstructions: :sweat_smile: \nType correct username. :sunglasses: \nOnly one space should be there after "month"/"week"\n\ne.g week @slackbot\n  month @slackbot'));
			break;
		case 'UNAUTHORIZED':
			Message.postErrorMessage(message, new Error('\nYou are not having permission to access user data!! :rage:'));
			break;
		case 'EXCEL':
			try {
				const styles = {
					headerDark: {
						fill: {
							fgColor: {
								rgb: 'FF000000'
							},
							sz: 15
						},
						font: {
							color: {
								rgb: 'FFFFFFFF'
							},
							sz: 14,
							bold: true,
							underline: true
						}
					},
					cellPink: {
						fill: {
							fgColor: {
								rgb: 'FFFFCCFF'
							},
							sz: 15
						}
					},
					cellGreen: {
						fill: {
							fgColor: {
								rgb: '00FF0000'
							},
							sz: 15
						}
					}
				};

			// Array of objects representing heading rows (very top)
			// Here you specify the export structure
				const specification = {
					date: {
						displayName: 'date',
						headerStyle: styles.headerDark,
						width: '12'
					},
					inTime: {
						displayName: 'in time',
						headerStyle: styles.headerDark,
						width: '10'
					},
					outTime: {
						displayName: 'out time',
						headerStyle: styles.headerDark,
						width: '10'
					},
					tasksPlanned: {
						displayName: 'planned tasks',
						headerStyle: styles.headerDark,
						width: '10'
					},
					tasksCompleted: {
						displayName: 'completed tasks',
						headerStyle: styles.headerDark,
						width: '10'
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
				fs.writeFile(`sheets/${timesheet[0].username}.xlsx`, report, (res, err) => {
					if (err) log.saveLogs(message.user, err, new Date());
					request.post({
						url: 'https://slack.com/api/files.upload',
						formData: {
							token: config.token,
							title: 'User Report',
							filename: `${timesheet[0].username}.xlsx`,
							filetype: 'auto',
							channels: message.channel,
							file: fs.createReadStream(`sheets/${timesheet[0].username}.xlsx`),
						},
					}, (error, response) => {
						if (error) log.saveLogs(message.user, err, new Date());
					});
				});
			}).catch((err) => {
				log.saveLogs(message.user, err, new Date());
				Message.postErrorMessage(message, err);
			});
			} catch (err) {
				log.saveLogs(message.user, err, new Date());
				Message.postErrorMessage(message, err);
			}
			break;
		default:
			break;
	}
});
bot.listen({ token });
