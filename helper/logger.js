const fs = require('fs');
const moment = require('moment');

module.exports = {
	saveLogs: (user, err, ts) => {
		const dataToAppend = `user: ${user} \nError: ${err.message} Trace: ${err.stack}\nTimestamp: ${ts}\n\n`;
		fs.appendFile('./log/log.txt', dataToAppend, (error) => {
		});
	}

};
