const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const holidaySchema = new Schema({
	leaveDate: String,
	reason: String,
	addedBy: String,
	leaveDays: Number,
	isoDate: Date,
	day: String
});

const HolidayMdl = mongoose.model('Holiday', holidaySchema);

module.exports = HolidayMdl;
