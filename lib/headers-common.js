export const Headers = {
	list: {},
	proxyCount: 0,
	setProxyCount(proxyCount) {
	    this.proxyCountDeprecated(true);
		this.proxyCount = proxyCount;
	},
	getProxyCount() {
		return this.proxyCount;
	},
	proxyCountDeprecated(proxyCount) {
		if (proxyCount) {
			console.log('Specifying the proxyCount is deprecated.  By default, '
			+ 'we now use the HTTP_FORWARDED_COUNT environment variable which '
			+ 'is used by Meteor 0.7.1+ too (and set by default in development '
			+ 'environment and meteor.com with correct values.');
		}
	},
};
