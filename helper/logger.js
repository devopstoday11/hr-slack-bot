const fs = require('fs');
const moment = require('moment');

module.exports = {
	saveLogs: (user, err, ts) => {
		const dataToAppend = `user: ${user} \nError: ${err.message} Trace: ${err.stack}\nTimestamp: ${ts}\n\n`;
		fs.appendFile('./logs/log.txt', dataToAppend, (error) => {
			console.log(error);
		});
	}

};
