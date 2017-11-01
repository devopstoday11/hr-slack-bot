const headerDark = {
	fill: {
		fgColor: {
			rgb: 'ADD8E600'
		},
		sz: 15,
		height: 20
	},
	font: {
		color: {
			rgb: 'FFFFFFFF'
		},
		sz: 14,
		bold: true,
		underline: true
	}
};
const specification = {
	date: {
		displayName: 'Date',
		headerStyle: headerDark,
		width: '20'
	},
	inTime: {
		displayName: 'Checked in time',
		headerStyle: headerDark,
		width: '20'
	},
	outTime: {
		displayName: 'Checked out time',
		headerStyle: headerDark,
		width: '20'
	},
	actualInTime: {
		displayName: 'Actual in time',
		headerStyle: headerDark,
		width: '20'
	},
	tasksPlanned: {
		displayName: 'Planned tasks',
		headerStyle: headerDark,
		width: '30'
	},
	tasksCompleted: {
		displayName: 'Completed tasks',
		headerStyle: headerDark,
		width: '30'
	},
};
module.exports = {
	headerDark,
	specification
};
