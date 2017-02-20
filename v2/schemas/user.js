const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
	name: { type: String, index: true },
	id: { type: String, index: true },
	real_name: { type: String },
	image_192: { type: String },
	createdAt: { type: Date, default: Date.now },
});

const UserMdl = mongoose.model('User', userSchema);

module.exports = UserMdl;
