const slack = require('slack');
const request = require('request');
const fs = require('fs');
const moment = require('moment');
const _ = require('lodash');
const CronJob = require('cron').CronJob;

const config = require('../config');
const log = require('../helper/logger');

const UserSchema = require('../schemas/user');
const UserMdl = require('../models/user');
const UserMessage = require('../messages/user');

module.exports = {
	demoMethod: (yourParam1) => {

	},
};
