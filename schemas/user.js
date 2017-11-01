const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
	name: { type: String, index: true },
	id: { type: String, index: true },
	real_name: { type: String },
	image_192: { type: String },
	created: { type: Date, default: Date.now },
	role: { type: String, default: 'developer' },
	shortIntro: { type: String, default: '' },
	bio: { type: String, default: '' },
	quote: { type: String, default: '' },
	hobbies: [{ type: String, default: [] }],
	birthDay: { type: Date, default: null },
	skills: [{
		masterSkill: { type: String },
		level: { type: String, default: 'beginner' }
	}],
});

const UserMdl = mongoose.model('User', userSchema);

module.exports = UserMdl;
