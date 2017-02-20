#! /bin/bash
echo "Type the new feature name, followed by [ENTER]:"
read feature

Feature="$(tr '[:lower:]' '[:upper:]' <<< ${feature:0:1})${feature:1}"
Mdl="Mdl"
Schema="Schema"
Message="Message"
SCHEMAFILE=schemas/$feature$.js
MODELFILE=models/$feature.js
SERVICEFILE=services/$feature.js
MESSAGEFILE=messages/$feature.js

touch $SCHEMAFILE
cat > $SCHEMAFILE <<EOF
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const $feature$Schema = new Schema({
  created: { type: Date, default: Date.now },
});
const $Feature$Mdl = mongoose.model('$Feature', $feature$Schema);

module.exports = $Feature$Mdl;
EOF

echo "Schema Created"

touch $MODELFILE
cat > $MODELFILE <<EOF
const $Feature$Schema = require('../schemas/$feature');
const log = require('../helper/logger');

module.exports = {
	demoMethod: (yourParam1) => {
		return new Promise((resolve, reject) => {

		});
	},
};
EOF

echo "Model Created"

touch $MESSAGEFILE
cat > $MESSAGEFILE <<EOF
const slack = require('slack');
const request = require('request');
const fs = require('fs');
const excel = require('node-excel-export');

const config = require('../config');
const log = require('../helper/logger');
const $Feature$Schema = require('../schemas/$feature');

module.exports = {
	postMessage: (yourParam1) => {

	},
};
EOF

echo "Messages Created"

touch $SERVICEFILE
cat > $SERVICEFILE <<EOF
const slack = require('slack');
const request = require('request');
const fs = require('fs');
const moment = require('moment');
const _ = require('lodash');
const CronJob = require('cron').CronJob;

const config = require('../config');
const log = require('../helper/logger');

const $Feature$Schema = require('../schemas/$feature');
const $Feature$Mdl = require('../models/$feature');
const $Feature$Message = require('../messages/$feature');

module.exports = {
	demoMethod: (yourParam1) => {

	},
};
EOF

echo "Service Created"
echo "All corresponding files are created.."
echo "Enjoy writing core Logic"

#
# touch messages/$feature.js
# touch models/$feature.js
# touch services/$feature.js
