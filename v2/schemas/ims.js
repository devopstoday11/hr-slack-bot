const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const imsSchema = new Schema({
	userId: { type: String, index: true },
	channelId: { type: String, index: true },
});

const ImsMdl = mongoose.model('Ims', imsSchema);

module.exports = ImsMdl;
