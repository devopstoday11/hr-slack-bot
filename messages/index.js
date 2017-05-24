const slack = require('slack');
const excel = require('node-excel-export');
const fs = require('fs');
const moment = require('moment');
const request = require('request');
const DB = require('../models');
const LeaveMdl = require('../schemas/leave');
const config = require('../config');
const log = require('../helper/logger');
const DateHelper = require('../helper/date_parser');

module.exports = {
	postSpecificReport: (timesheet, attachment, timePeriod, message) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			as_user: true,
			fallback: `${timesheet[0].userRealname} ${timePeriod} Report`,
			text: `*${timesheet[0].userRealname} ${timePeriod} Report*`,
			attachments: attachment,
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(timesheet[0].userRealname, errSave, new Date());
			}
		});
	},

	postMessage: (message, textMessage) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			text: `${textMessage}`,
			as_user: true,
			fallback: `${textMessage}`
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(message.user, errSave, new Date());
			}
		});
	},

	postMessageWithAttachment: (message, textMessage, tasks) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			text: textMessage,
			fallback: textMessage,
			as_user: true,
			attachments: [{
				color: '#36a64f',
				text: `${tasks || 'No task provided'}`,
			}]
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(message.user, errSave, new Date());
			}
		});
	},

	postErrorMessage: (message, error) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			text: '',
			as_user: true,
			attachments: [{
				color: '#ff0000',
				fallback: `${(error || {}).message}`,
				text: `${(error || {}).message}`,
			}]
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs(message.user, errSave, new Date());
			}
		});
	},

	postChannelInMessage: (message, updatedTime, user, param, color) => {
		slack.chat.postMessage({
			token: config.token,
			channel: config.postChannelId,
			title: 'Title',
			text: `*${updatedTime.userRealname}* checked in at \`${updatedTime.inTime}\` `,
			as_user: true,
			attachments: [
				{
					color: `${color || '#36a64f'}`,
					fallback: `${updatedTime.userRealname} checked in at ${updatedTime.inTime} `,
					author_name: updatedTime.userRealname,
					title: 'Today\'s Tasks',
					text: message.text || 'NO TASK PROVIDED',
					ts: message.ts,
					thumb_url: user.image_192,
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(updatedTime.userRealname, errSave, new Date());
			}
			DB.saveChannelMessageRecord(updatedTime, data.ts, param)
			.then((dataNew) => {
				return true;
			});
		});
	},

	postChannelOutMessage: (message, updatedTime, user, param) => {
		slack.chat.postMessage({
			token: config.token,
			channel: config.postChannelId,
			title: 'Title',
			text: `*${updatedTime.userRealname}* has checked out`,
			as_user: true,
			attachments: [
				{
					color: '#439FE0',
					fallback: `${updatedTime.userRealname} checked out at ${updatedTime.outTime}`,
					mrkdwn_in: ['text', 'fields'],
					fields: [
						{
							title: 'Check-In Time',
							value: `*\`${updatedTime.inTime}\`*`,
							short: true
						},
						{
							title: 'Check-Out Time',
							value: `*\`${updatedTime.outTime}\`*`,
							short: true
						}
					],
					thumb_url: user.image_192,
				},
				{
					color: '#ff4d4d',
					fallback: `${updatedTime.userRealname} checked out at ${updatedTime.outTime} `,
					title: 'Planned Tasks',
					text: updatedTime.tasks,
					ts: updatedTime.taskTs,
				},
				{
					color: '#36a64f',
					fallback: `${updatedTime.userRealname} checked out at ${updatedTime.outTime} `,
					title: 'Completed Tasks',
					text: message.text,
					ts: message.ts
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(updatedTime.userRealname, errSave, new Date());
			}
			DB.saveChannelMessageRecord(updatedTime, data.ts, param)
			.then((dataNew) => {
				return true;
			});
		});
	},

	updateChannelInMessage: (timesheet, oldTs, user, updatedTask) => {
		slack.chat.update({
			token: config.token,
			channel: config.postChannelId,
			title: 'Title',
			text: `*${timesheet.userRealname}* checked in at \`${timesheet.inTime}\` `,
			as_user: true,
			ts: oldTs,
			attachments: [
				{
					color: '#36a64f',
					fallback: `${timesheet.userRealname} checked in at ${timesheet.inTime} `,
					author_name: timesheet.userRealname,
					title: 'Today\'s Tasks',
					text: updatedTask,
					ts: timesheet.msgTs,
					thumb_url: user.image_192,
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(timesheet.userRealname, errSave, new Date());
			}
		});
	},
	updateChannelOutMessage: (timesheet, oldTs, updateInTask, user, updatedOutTask) => {
		slack.chat.update({
			token: config.token,
			channel: config.postChannelId,
			ts: oldTs,
			title: 'Title',
			text: `*${timesheet.userRealname}* has checked out`,
			as_user: true,
			attachments: [
				{
					color: '#439FE0',
					fallback: `${timesheet.userRealname} checked out at ${timesheet.outTime}`,
					mrkdwn_in: ['text', 'fields'],
					fields: [
						{
							title: 'Check-In Time',
							value: `*\`${timesheet.inTime}\`*`,
							short: true
						},
						{
							title: 'Check-Out Time',
							value: `*\`${timesheet.outTime}\`*`,
							short: true
						}
					],
					thumb_url: user.image_192,
				},
				{
					color: '#ff4d4d',
					fallback: `${timesheet.userRealname} checked out at ${timesheet.outTime} `,
					title: 'Planned Tasks',
					text: updateInTask,
					ts: timesheet.taskTs,
				},
				{
					color: '#36a64f',
					fallback: `${timesheet.userRealname} checked out at ${timesheet.outTime} `,
					title: 'Completed Tasks',
					text: updatedOutTask,
					ts: timesheet.taskDoneTs
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(timesheet.userRealname, errSave, new Date());
			}
		});
	},

	postHelpMessage: (message, error) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'HELP DESK',
			fallback: 'HELP DESK',
			text: 'Always happy to help\n',
			as_user: true,
			attachments: [
				{
					fallback: 'IN',
					color: '#36a64f',
					pretext: 'Once entered the office',
					author_name: 'Command',
					title: 'IN / IN HH:MM',
					text: 'If you are entering in command and want to keep in time as the current time then enter only IN and if you want to change in time than current time then please provide  time in HH:MM formate after IN'
				},
				{
					fallback: 'OUT',
					color: '#0000ff',
					pretext: 'When Leaving the office',
					author_name: 'Command',
					title: 'OUT / OUT HH:MM',
					text: 'Timing rules are same as IN command'
				},
				{
					fallback: 'LEAVE',
					color: '#00ff00',
					pretext: 'For requesting leave',
					author_name: 'Command',
					title: 'LEAVE FROMDATE(DD-MM-YYYY) TODATE(DD-MM-YYYY) REASON',
					text: 'Ex. leave 6-2-2017 8-2-2017 going to home for family function\n It will be sent to hr and admins for review \n For one day leave keep to and from date same'
				},
				{
					fallback: 'HOLIDAY',
					color: '#ff0000',
					pretext: 'For Holiday List',
					author_name: 'Command',
					title: 'HOLIDAY',
					text: 'Get the list of holidays as message'
				}, {
					fallback: 'HOLIDAY SHEET',
					color: '#ffff00',
					pretext: 'For Holiday List in excel sheet',
					author_name: 'Command',
					title: 'HOLIDAYLIST',
					text: 'Get the list of holidays as excel sheet'
				}
			]
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs('Undefined', errSave, new Date());
			}
		});
	},

	postAdminHelpMessage: (message, error) => {
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'HELP DESK',
			fallback: 'HELP DESK',
			text: 'Always happy to help\n',
			as_user: true,
			attachments: [
				{
					fallback: 'IN',
					color: '#36a64f',
					pretext: 'Once entered the office',
					author_name: 'Command',
					title: 'IN / IN HH:MM',
					text: 'If you are entering in command and want to keep in time as the current time then enter only IN and if you want to change in time than current time then please provide  time in HH:MM formate after IN'
				}, {
					fallback: 'OUT',
					color: '#0000ff',
					pretext: 'When Leaving the office',
					author_name: 'Command',
					title: 'OUT / OUT HH:MM',
					text: 'Timing rules are same as IN command'
				}, {
					fallback: 'LEAVE',
					color: '#00ff00',
					pretext: 'For requesting leave',
					author_name: 'Command',
					title: 'LEAVE FROMDATE(DD-MM-YYYY) TODATE(DD-MM-YYYY) REASON',
					text: 'Ex. leave 6-2-2017 8-2-2017 going to home for family function\n It will be sent to hr and admins for review \n For one day leave keep to and from date same'
				}, {
					fallback: 'HOLIDAY',
					color: '#ff0000',
					pretext: 'For Holiday List',
					author_name: 'Command',
					title: 'HOLIDAY',
					text: 'Get the list of holidays as message'
				}, {
					fallback: 'HOLIDAY SHEET',
					color: '#ffff00',
					pretext: 'For Holiday List in excel sheet',
					author_name: 'Command',
					title: 'HOLIDAYLIST',
					text: 'Get the list of holidays as excel sheet'
				}, {
					fallback: 'WEEK',
					color: '#cc0066',
					pretext: 'Weekly report of user',
					author_name: 'Command',
					title: 'WEEK @username',
					text: 'Ex. WEEK @ridham .It will print Ridham\'s last week timesheet'
				}, {
					fallback: 'MONTH',
					color: '#808000',
					pretext: 'Monthly report of user',
					author_name: 'Command',
					title: 'MONTH @username',
					text: 'Ex. MONTH @ridham .It will print Ridham\'s last month timesheet'
				}, {
					fallback: 'EXCEL',
					color: '#b33c00',
					pretext: 'Excel report of user',
					author_name: 'Command',
					title: 'EXCEL @username',
					text: 'Ex. EXCEL @ridham .It will generate excel sheet of Ridham\'s  timesheet'
				}, {
					fallback: 'LEAVEACCEPT requestID your notes',
					color: '#00cccc',
					pretext: 'Accept Leave Request',
					author_name: 'Command',
					title: 'LEAVEACCEPT leaverequestId Notes',
					text: 'Ex. LEAVEACCEPT 16060120 your notes'
				}, {
					fallback: 'LEAVEREJECT requestID your notes',
					color: '#669900',
					pretext: 'Reject Leave Request',
					author_name: 'Command',
					title: 'LEAVEREJECT leaverequestId Notes',
					text: 'Ex. LEAVEREJECT 16060120 your notes'
				}, {
					fallback: 'LEAVEREPORT @ridham',
					color: '#36a64f',
					pretext: 'Leave Request Report Of User',
					author_name: 'Command',
					title: 'LEAVEREPORT @username',
					text: 'Ex. LEAVEREPORT @ridham'
				}, {
					fallback: 'LEAVESET dd-mm-yyyy  Reason',
					color: '#ff0000',
					pretext: 'Set leave to stop reminder on custom holidays(if number is given then for next that days ignoring sunday will be set as leave & if date is given then for that date leave is set)',
					author_name: 'Command',
					title: 'LEAVESET dd-mm-yyyy Number_of_continous_day Reason',
					text: 'Ex. LEAVESET 12-03-2017 2 Holi-Dhuleti'
				}
			]
		}, (errSave, data) => {
			if (errSave) {
				log.saveLogs('Undefined', errSave, new Date());
			}
		});
	},

	postLeaveMessageToAdmin: (channelId, user, leaveReport) => {
		slack.chat.postMessage({
			token: config.token,
			channel: channelId,
			title: 'Title',
			text: `*${user.real_name}* has requested for leave.\n*Accept :* \`leaveaccept ${leaveReport.leaveCode} your notes\`\n*Reject :* \`leavereject ${leaveReport.leaveCode} your notes\``,
			as_user: true,
			attachments: [
				{
					color: '#439FE0',
					mrkdwn_in: ['text', 'fields'],
					fields: [
						{
							title: 'Leave From',
							value: `*\`${DateHelper.getDateAsDDMMYYYY(leaveReport.fromDate)}\`*`,
							short: true
						},
						{
							title: 'Leave To',
							value: `*\`${DateHelper.getDateAsDDMMYYYY(leaveReport.toDate)}\`*`,
							short: true
						},
						{
							title: 'Days',
							value: `${leaveReport.days}`,
							short: false
						},
						{
							title: 'Reason',
							value: `${leaveReport.reason}`,
							short: false
						}
					],
					thumb_url: user.image_192,
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(user.userRealname, errSave, new Date());
			}
		});
	},

	postLeaveStatusMessage: (channelId, leaveReport) => {
		const leaveStatus = leaveReport.isApproved ? 'Accepted' : 'Rejected';
		slack.chat.postMessage({
			token: config.token,
			channel: channelId,
			title: 'Title',
			text: `Hey ${leaveReport.real_name},\nYour following request has been *\`${leaveStatus}\`*`,
			as_user: true,
			attachments: [
				{
					color: '#439FE0',
					mrkdwn_in: ['text', 'fields'],
					fields: [
						{
							title: 'Leave From',
							value: `*\`${DateHelper.getDateAsDDMMYYYY(leaveReport.fromDate)}\`*`,
							short: true
						},
						{
							title: 'Leave To',
							value: `*\`${DateHelper.getDateAsDDMMYYYY(leaveReport.toDate)}\`*`,
							short: true
						},
						{
							title: 'Days',
							value: `${leaveReport.days}`,
							short: false
						},
						{
							title: 'Reason',
							value: `${leaveReport.reason}`,
							short: false
						}, {
							title: 'Status',
							value: `\`${leaveStatus}\``,
							short: true
						}, {
							title: 'Action Reason',
							value: `\`${leaveReport.note}\``,
							short: true
						}
					],
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(leaveReport.real_name, errSave, new Date());
			}
		});
	},

	postLeaveReport: (message, userId) => {
		LeaveMdl.find({ id: userId }).sort({ fromDate: 1 }).exec((err, leaveDocs) => {
			if (err) {
				module.exports.postErrorMessage(message, new Error('Please Try again later'));
			} else {
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
						from: {
							displayName: 'From Date',
							headerStyle: styles.headerDark,
							width: '20'
						},
						to: {
							displayName: 'To Date',
							headerStyle: styles.headerDark,
							width: '20'
						},
						days: {
							displayName: 'Days',
							headerStyle: styles.headerDark,
							width: '20'
						},
						reason: {
							displayName: 'Reason',
							headerStyle: styles.headerDark,
							width: '20'
						},
						code: {
							displayName: 'Code',
							headerStyle: styles.headerDark,
							width: '20'
						},
						status: {
							displayName: 'Status',
							headerStyle: styles.headerDark,
							width: '20'
						},
						action: {
							displayName: 'Action By',
							headerStyle: styles.headerDark,
							width: '20'
						}
					};
					const dataset = [];
					let datasetTemp = [];
					if (typeof leaveDocs[0] === 'undefined') {
						throw new Error('No data to fetch!');
					}
					const heading = [
					[{ value: 'Name', style: styles.headerDark }, { value: 'User Name', style: styles.headerDark }],
					[`${leaveDocs[0].real_name}\t`, `${leaveDocs[0].name}`]
					];
					leaveDocs.forEach((t, index) => {
						datasetTemp = {
							from: DateHelper.getDateAsDDMMYYYY(t.fromDate),
							to: DateHelper.getDateAsDDMMYYYY(t.toDate),
							days: t.days,
							reason: t.reason,
							code: t.leaveCode,
							status: t.isApproved === null ? 'No Action' : (t.isApproved ? 'Approved' : 'Rejected'),//eslint-disable-line
							action: t.actionBy || '',
						};
						dataset.push(datasetTemp);
					});
					const report = excel.buildExport(
						[
							{
								name: leaveDocs[0].name,
								heading,
								specification,
								data: dataset
							}
						]
					);
					fs.writeFile(`${__dirname}/../sheets/${leaveDocs[0].name}_leave.xlsx`, report, (res2, error) => {
						if (error) log.saveLogs(message.user, error, new Date());
						request.post({
							url: 'https://slack.com/api/files.upload',
							formData: {
								token: config.token,
								title: `Leave Report of ${leaveDocs[0].name}`,
								filename: `${leaveDocs[0].name}.xlsx`,
								filetype: 'auto',
								channels: message.channel,
								file: fs.createReadStream(`${__dirname}/../sheets/${leaveDocs[0].name}_leave.xlsx`),
							},
						}, (messageError, response) => {
							if (messageError) log.saveLogs(message.user, messageError, new Date());
						});
					});
				} catch (tryError) {
					log.saveLogs(message.user, tryError, new Date());
					module.exports.postErrorMessage(message, tryError);
				}
			}
		});
	},

	postHolidays: (message, holidays) => {
		let i = 0;
		const colorCode = ['#0000FF', '#36a64f', '#cc0066', '#808000', '#b33c00', '#00cccc', '#669900'];
		const attachment = [];
		holidays.forEach((h, index) => {
			const attach = {
				color: colorCode[i % 6],
				title: `${h.leaveDate} (${h.day || ''})`,
				text: `Reason : ${h.reason}`,
			};
			attachment.push(attach);
			i += 1;
		});
		slack.chat.postMessage({
			token: config.token,
			channel: message.channel,
			title: 'Title',
			as_user: true,
			fallback: 'Holiday List',
			text: 'Holiday List',
			attachments: attachment,
		}, (err, data) => {
			if (err) {
				log.saveLogs(message.user, err, new Date());
			}
		});
	},

	postHolidayList: (message, holidays) => {
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
				day: {
					displayName: 'Date',
					headerStyle: styles.headerDark,
					width: '20'
				},
				reason: {
					displayName: 'Reason',
					headerStyle: styles.headerDark,
					width: '20'
				}
			};
			const dataset = [];
			let datasetTemp = [];
			if (typeof holidays[0] === 'undefined') {
				throw new Error('No data to fetch!');
			}
			holidays.forEach((t, index) => {
				datasetTemp = {
					date: t.leaveDate,
					day: t.day,
					reason: t.reason,
				};
				dataset.push(datasetTemp);
			});
			const report = excel.buildExport(
				[
					{
						specification,
						data: dataset
					}
				]
			);
			fs.writeFile(`${__dirname}/../sheets/HOLIDAYLIST.xlsx`, report, (res2, error) => {
				if (error) log.saveLogs(message.user, error, new Date());
				request.post({
					url: 'https://slack.com/api/files.upload',
					formData: {
						token: config.token,
						title: 'Holiday List',
						filename: 'HOLIDAYLIST.xlsx',
						filetype: 'auto',
						channels: message.channel,
						file: fs.createReadStream(`${__dirname}/../sheets/HOLIDAYLIST.xlsx`),
					},
				}, (messageError, response) => {
					if (messageError) log.saveLogs(message.user, messageError, new Date());
				});
			});
		} catch (tryError) {
			log.saveLogs(message.user, tryError, new Date());
			module.exports.postErrorMessage(message, tryError);
		}
	},

	postLeavePresentMessageToAdmin: (channelId, leave, user) => {
		slack.chat.postMessage({
			token: config.token,
			channel: channelId,
			title: 'Title',
			text: `*${leave.real_name}* was on leave but he/she has checked in for today. so as my noble duty I am informing you about that`,
			as_user: true,
			attachments: [
				{
					color: '#439FE0',
					mrkdwn_in: ['text', 'fields'],
					fields: [
						{
							title: 'Leave From',
							value: `*\`${DateHelper.getDateAsDDMMYYYY(leave.fromDate)}\`*`,
							short: true
						}, {
							title: 'Leave To',
							value: `*\`${DateHelper.getDateAsDDMMYYYY(leave.toDate)}\`*`,
							short: true
						}, {
							title: 'Days',
							value: `${leave.days}`,
							short: false
						}, {
							title: 'Reason',
							value: `${leave.reason}`,
							short: false
						}, {
							title: 'Note',
							value: `I have cancelled today's leave and any upcomint concurrent leave for ${leave.real_name}`,
							short: false
						}
					],
					thumb_url: user.image_192,
				}
			] }, (errSave, data) => {
			if (errSave) {
				log.saveLogs(leave.real_name, errSave, new Date());
			}
		});
	},
};
