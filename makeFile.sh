#! /bin/bash
mkdir logs
mkdir sheets
LOGFILE="config/index.js"
LOG_DIR=`dirname $LOGFILE`
[ ! -d $LOG_DIR ] && mkdir -p $LOG_DIR
touch $LOGFILE
cat > $LOGFILE <<EOF
module.exports = {
	botId: '',
	token: 'xoxb-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
	mongoURL: 'mongodb://xxxxxx:xxxxx@xxxxx.mlab.com:27017/attendance',
	postChannelId: 'xxxxxxx',
	admin: []
};
EOF
