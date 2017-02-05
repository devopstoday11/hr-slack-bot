module.exports = {
	parseDate: (str) => {
		const m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
		return (m) ? new Date(m[3], m[2] - 1, m[1]) : null;
	},

	getDateAsDDMMYYYY: (date) => {
		let dd = date.getDate();
		let mm = date.getMonth() + 1; // January is 0!
		const yyyy = date.getFullYear();

		if (dd < 10) {
			dd = `0${dd}`;
		}

		if (mm < 10) {
			mm = `0${mm}`;
		}
		return `${dd}-${mm}-${yyyy}`;
	}
};
