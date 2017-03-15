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
	},

	isValidDate: (s) => {
		const bits = s.split('-');
		const y = bits[2];
		const	m = bits[1];
		const	d = bits[0];
  // Assume not leap year by default (note zero index for Jan)
		const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // If evenly divisible by 4 and not evenly divisible by 100,
  // or is evenly divisible by 400, then a leap year
		if ((!(y % 4) && y % 100) || !(y % 400)) {
			daysInMonth[1] = 29;
		}
		return !(/\D/.test(String(d))) && d > 0 && d <= daysInMonth[m - 1] && y < 2099 && y >= new Date().getFullYear();
	}

};
