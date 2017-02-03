/* eslint-disable no-case-declarations, no-param-reassign */
const slack = require('slack');
const config = require('./config');
const mongoose = require('mongoose');
const UserMdl = require('./schemas/user');
const ImsMdl = require('./schemas/ims');
const TimeMdl = require('./schemas/timesheet');
const DB = require('./models');
const Message = require('./messages');
const moment = require('moment');
const _ = require('lodash');
const excel = require('node-excel-export');
const CronJob = require('cron').CronJob;
const fs = require('fs');
const request = require('request');

const log = require('./helper/logger');
const links = require('./messages/links');

mongoose.connect(config.mongoURL);

const bot = slack.rtm.client();
const token = config.token;
const timeRegex = new RegExp('^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');
const users = [];

let time;
let	spaceIndex;
let	userId;
let userTemp;
let	commands;
let attachment = [];
let attach;
let payloadIms;

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
	// cronTime: '*/10 * * * * *',
	onTick() {
		let text = '';

		payloadIms.forEach((ims) => {
			const user = _.find(users, { id: ims.user });
			if (user) {
				if (moment().format('HH').toString() === '08') {
					text = `Good Morning *\`${user.real_name}\`*:city_sunrise::sun_small_cloud:\n\nLet's check you in.\n proceed by entering *\`in\`* command`;
				} else {
					text = `A Gentle reminder for you *\`${user.real_name}\`*\nDon't forget to checkout when you leave
					 the office by entering *\`out\`* command\n\nIf you have any suggestion, queries or concern, contact administrator`;
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
						if (message.text.substr(0, spaceIndex) === 'in') {
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
						return true;
					})
					.catch((err) => {
						log.saveLogs(message.user, err, moment());
						Message.postErrorMessage(message, err);
					});
				}
			}).then(() => {
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
										Message.postMessage(message, `You have successfully checked out and your completed tasks are posted in \`daily-scrum\`\n Have a good night\n\n Check this out too : ${links[linkIndex]}`);
										Message.postChannelOutMessage(message, updatedTime, user, 'msgDoneTs');
									}).catch((err) => {
										log.saveLogs(message.user, err, moment());
									});
							} else {
								throw new Error('You confused me :sweat_smile: \n\n You have already added tasks\nso can\'t add more tasks but if you have changed your mind or something came up then please edit old task message :wink: ');
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
				// commands = 'List Of Commands :point_down: \nIN/IN HH:MM : when you start the work. :walking:  \n' +
				// 'OUT/OUT HH:MM : when you leave. :v: ' +
				// '\n\nYou can enter the tasks only one time, after that, you can only edit that message. :thumbsup_all: \n\n\n' +
				// 'Only for HR :grin: : \nweek @user : To get last week timesheet of @user.\n' +
				// 'month @user : to get last month activities of @user.\n' +
				// 'excel @user : to get Excel sheet of all the data of @user.\n\n' +
				// 'Only one space is allowed between WEEK,MONTH,EXCEL,IN,OUT and @user/Time !!';
				Message.postHelpMessage(message);

				break;
			case 'NOTHING_TO_DO':
				Message.postErrorMessage(message, new Error('You can only edit task listing messages! :sweat_smile:'));

				break;
			case 'WRONG':
				Message.postErrorMessage(message, new Error(':joy: \nInstructions: :sweat_smile: \nType correct username. :sunglasses: \nOnly one space should be there after "month"/"week"\n\ne.g week @slackbot\n  month @slackbot'));
				break;
			case 'UNAUTHORIZED':
				Message.postErrorMessage(message, new Error('\nNo No No !!! It\'s Rescricted area ....!! :rage:'));
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
						actualOutTime: {
							displayName: 'Actual out time',
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
							actualInTime: moment.unix(t.taskTs).format('HH:MM'),
							actualOutTime: moment.unix(t.taskDoneTs).format('HH:MM'),
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

					fs.writeFile(`${__dirname}/sheets/${timesheet[0].username}.xlsx`, report, (res, err) => {
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
				timesheet.forEach((t, index) => {
					const colorCode = ['#0000FF', '#36a64f', '#cc0066', '#808000', '#b33c00', '#00cccc', '#669900'];
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

bot.listen({ token });

userCheckIn.start();
