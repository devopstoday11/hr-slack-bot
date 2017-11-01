const request = require('request');
const excel = require('node-excel-export');
const moment = require('moment');
const fs = require('fs');
const _ = require('lodash');
const Message = require('../messages');
const log = require('./logger');
const DB = require('../models');
const excelStyle = require('./excel_styles');
const config = require('../config');

module.exports = {
	makeExcelSheet: (message) => {
		try {
			const styles = {
				headerDark: excelStyle.headerDark
			};
		// Array of objects representing heading rows (very top)
		// Here you specify the export structure
			const specification = excelStyle.specification;
			const dataset = [];
			let datasetTemp = [];
			let userId;
			const spaceIndex = message.text.indexOf('@');
			if (spaceIndex === -1) {
				userId = message.user;
			} else {
				userId = message.text.substr(spaceIndex + 1, 9);
			}
			DB.getSpecificTimesheet(userId, 1, 365)
		.then((timesheet) => {
			if (typeof timesheet[0] === 'undefined') {
				throw new Error('No data to fetch!');
			}
			userId = '';
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
			fs.writeFile(`${__dirname}/../sheets/${timesheet[0].username}.xlsx`, report, (res2, err) => {
				if (err) log.saveLogs(message.user, err, moment());
				request.post({
					url: 'https://slack.com/api/files.upload',
					formData: {
						token: config.token,
						title: `Timesheet of ${timesheet[0].username}`,
						filename: `${timesheet[0].username}.xlsx`,
						filetype: 'auto',
						channels: message.channel,
						file: fs.createReadStream(`${__dirname}/../sheets/${timesheet[0].username}.xlsx`),
					},
				}, (error, response) => {
					if (error) log.saveLogs(message.user, error, moment());
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
	}
};
