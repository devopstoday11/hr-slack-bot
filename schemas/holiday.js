const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const holidaySchema = new Schema({
	leaveDate: String,
	reason: String,
	addedBy: String
});

const HolidayMdl = mongoose.model('Holiday', holidaySchema);

module.exports = HolidayMdl;
