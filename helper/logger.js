const fs = require('fs');
const moment = require('moment');

module.exports = {
	saveLogs: (user, err, ts) => {
		const dataToAppend = `user: ${user} \nError: ${err.message || err} Trace: ${err.stack || err}\nTimestamp: ${ts}\n\n`;
		fs.writeFile(`${__dirname}/../logs/log.txt`, dataToAppend, { flag: 'a' }, (error) => {
			if (error) {
				console.log('Error in writing file :', error);
			}
		});
	}
};
