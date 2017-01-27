const slack = require('slack');
const config = require('./config');
const mongoose = require('mongoose');
const UserMdl = require('./schemas/user');
const TimeMdl = require('./schemas/timesheet');
const DB = require('./models');
const Message = require('./messages');
const moment = require('moment');
const _ = require('lodash');

const bot = slack.rtm.client();
const token = config.token;

const timeRegex = new RegExp('^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');
// const inTimeRegex = new RegExp('^in ([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$');

mongoose.connect(config.mongoURL);

const users = [];
let time,
	spaceIndex,
	userId,
	userTemp,
	commands;
// do something with the rtm.start payload
bot.started((payload) => {
	const payloadUsers = payload.users;
	payloadUsers.forEach((user) => {
		if (!user.is_bot && user.name !== 'slackbot') {
			const dbUser = new UserMdl(user);
			users.push(dbUser);
			UserMdl.update({ id: user.id }, user, { upsert: true, setDefaultsOnInsert: true }, (err, result) => {
				
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
	
	const user = _.find(users, { id: message.user });
	let testCase = '';
	if (message.type === 'message' && !message.subtype && !message.bot_id) {
		try {
			// User entry
			if (message.text.toLowerCase() === 'in' || message.text.toLowerCase().indexOf('in ') === 0) {
				// 
				testCase = 'IN';
			} else if (message.text.toLowerCase() === 'out' || message.text.toLowerCase().indexOf('out ') === 0) {
				// 
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
				// 
				testCase = 'HELP';
			} else {
				// 
				testCase = 'TASK_IN_OUT';
			}
		} catch (err) {
			// 
			// Message.postErrorMessage(message, err);
		}
	} else if (message.subtype === 'message_changed') {
		if (message.previous_message.text.indexOf('in ') === 0 || message.previous_message.text === 'in' || message.previous_message.text === 'out' || message.previous_message.text.indexOf('out ') === 0) {
			// 
			testCase = 'NOTHING_TO_DO';
		} else {
			// 
			testCase = 'MESSAGE_EDIT';
		}
	}
	switch (testCase) {
		case 'IN' : 
			DB.getTodayTimesheet(message.user)
		.then((timesheet) => {
			if (timesheet) {
				
				throw new Error('Already in');
			} else {
				
				if (message.text.toLowerCase() === 'in') {
					time = moment().format('HH:mm');
					
				} else {
					
					spaceIndex = message.text.indexOf(' ');
					if (message.text.substr(0, spaceIndex) === 'in') {
						time = message.text.substr(spaceIndex + 1);
						if (timeRegex.test(time)) {
							
						} else {
							
							throw new Error('Please enter valid time in HH:MM format ...');
						}
					} else {
						throw new Error('Invalid time');
					}
				}
				DB.saveTimesheet(user, time)
				.then((data) => {
					
					return true;
				})
				.catch((err) => {
					
					Message.postErrorMessage(message, err);
				});
			}
		}).then(() => {
			Message.postMessage(message, 'What are the tasks you are going to complete today?');
		}).catch((err) => {
			
			Message.postErrorMessage(message, err);
		});
			break;
		case 'OUT':
			
			DB.getTodayTimesheet(message.user)
			.then((timesheet) => {
				if (!timesheet) {
					
					throw new Error('Not in');
				} else if (timesheet.outTime !== null) {
					
					throw new Error('Already Out');
				} else {
					
					if (message.text.toLowerCase() === 'out') {
						time = moment().format('HH:mm');
						
					} else {
						
						spaceIndex = message.text.indexOf(' ');
						time = message.text.substr(spaceIndex + 1);
						if (timeRegex.test(time)) {
							
						} else {
							
							throw new Error('Please enter valid time in HH:MM format ...');
						}
					}
					DB.outUser(timesheet, time)
						.then((data) => {
							
							return true;
						}).then(() => {
							Message.postMessage(message, '\nWhich of the below tasks you have completed today?\n', timesheet.tasks);
						});
				}
			}).catch((err) => {
				
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
										// 
										// 
										Message.postChannelMessage(message, updatedTime, updatedTime.inTime, 'Today\'s Tasks', 'msgTs');
										
									}).catch((err) => {
										
									});
						} else if (timesheet.outTime && !timesheet.taskDone) {
						//	
							DB.saveTaskDone(timesheet, task, message.ts)
								.then((updatedTime) => {
									
									Message.postChannelMessage(message, updatedTime, updatedTime.outTime, 'Completed Tasks', 'msgDoneTs');
									
								}).catch((err) => {
									
								});
						} else {
							
							// Message.deleteMessage(message);
							throw new Error('Wrong Command!!\n\nYou have already added tasks\nYou can\'t add more tasks,You can still edit old ones!');
						}
					} else {
						
						throw new Error('User is not in');
					}
				}).catch((err) => {
					
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
								
								
							});
						} else if (message.previous_message.ts === timesheet.taskDoneTs) {
							DB.saveTaskDone(timesheet, message.message.text, timesheet.taskDoneTs)
							.then(() => {
								Message.updateChannelMessage(timesheet, timesheet.msgDoneTs, message.message.text, 'Today\'s Tasks');
								
								
							});
						}
					});
			break;
		case 'WEEK_REPORT':
			spaceIndex = message.text.indexOf(' ');
			if (message.text.substr(0, spaceIndex) === 'week') {
				userId = message.text.substr(spaceIndex + 3, 9);
			}
			userTemp = _.find(users, (o) => { return o.id === userId; });
			if (userTemp.id !== userId) {
				Message.postErrorMessage(message, 'USER NOT FOUND');
			} else {
				DB.getSpecificTimesheet(userId, 1, 7)
				.then((timesheet) => {
					Message.postMessage(message, 'User data :\n', timesheet);
				});
			}
			break;
		case 'MONTH_REPORT':
			spaceIndex = message.text.indexOf(' ');
			if (message.text.substr(0, spaceIndex) === 'month') {
				userId = message.text.substr(spaceIndex + 3, 9);
			}
			userTemp = _.find(users, (o) => { return o.id === userId; });
			if (userTemp.id !== userId) {
				Message.postErrorMessage(message, 'USER NOT FOUND');
			} else {
				DB.getSpecificTimesheet(userId, 1, 7)
				.then((timesheet) => {
					Message.postMessage(message, 'User data :\n', timesheet);
				});
			}
			break;
		case 'HELP':
			commands = 'List Of Commands :\nIN/IN HH:MM : when you start the work. \n' +
			'OUT/OUT HH:MM : when you leave.' +
			'\n\nYou can enter the tasks only one time, after that, you can only edit that message. \n\n\n' +
			'Only for HR : \nWEEK @user : To get last week timesheet of @user.\n' +
			'MONTH @user : to get last month activities of @user.';
			Message.postErrorMessage(message, commands);
			
			break;
		case 'NOTHING_TO_DO':
			Message.postErrorMessage(message, 'You can only edit task description messages!');
			
			break;
		case 'WRONG':
			Message.postErrorMessage(message, 'Wrong command!\nInstructions:\nType correct username.\nOnly one space should be there after "month"/"week"\n\ne.g week @slackbot\n  month @slackbot');
			break;
		case 'UNAUTHORIZED':
			Message.postErrorMessage(message, 'Oops!!\nYou are not having permission to access user data!!');
			break;
		default:
	}
});
bot.listen({ token });
