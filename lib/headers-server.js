import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { check } from 'meteor/check';
import { InjectInitial } from 'meteor/meteorhacks:inject-initial';
import { WebApp } from 'meteor/webapp';
import { Headers } from './headers-common';

const HEADERS_CLEANUP_TIME = 300000; // 5 minutes
const FILTERED_HEADERS = ['user-agent', 'cookie', 'authorization'];

// be helpful on meteor.com
if (process.env.ROOT_URL.match(/meteor.com$/i)
	&& typeof (process.env.HTTP_FORWARDED_COUNT) === 'undefined') process.env.HTTP_FORWARDED_COUNT = 1;

// Since Meteor 0.7.1, replaces headers.setProxy(count);
// +1 is for our strategy of always adding the host to x-ip-chain
if (process.env.HTTP_FORWARDED_COUNT) Headers.proxyCount = parseInt(process.env.HTTP_FORWARDED_COUNT, 10);

/*
 * Returns an array describing the suspected IP route the connection has taken.
 * This is in order of trust, see the README.md for which value to use
 */
function ipChain(headers, connection) {
	const chain = [];
	if (headers['x-forwarded-for']) {
		_.each(headers['x-forwarded-for'].split(','), function (ip) {
			chain.push(ip.replace('/\s*/g', ''));
		});
	}
	//  if (chain.length == 0 || chain[chain.length-1] != connection.remoteAddress)
	chain.push(connection.remoteAddress);
	return chain;
}

/*
 * After user has requested the headers (which were stored in headers.list
 * at the same time with the client's token, the below is called, which we
 * use to re-associate with the user's livedata session (see above)
 */
Meteor.methods({
	headersToken(token) {
		check(token, Number);
		if (Headers.list[token]) {
			const data = this.connection || this._sessionData;
			data.headers = Headers.list[token];
			headerDep(data).changed();

			// Don't do this until Meteor resumes sessions.  Consider
			// longer cleanup time, and keeping last reassocation time.
			// Or on disconnect, put back in the list with disconnect
			// time and keep that for cleanup_time (can do in 0.7+).
			// delete headers.list[token];
		}
	},
});

/*
 * Cleanup unclaimed headers
 */
Meteor.setInterval(function () {
	for (key in Headers.list) if (parseInt(key, 10) < new Date().getTime() - HEADERS_CLEANUP_TIME) delete (Headers.list[key]);
}, HEADERS_CLEANUP_TIME);

/*
 * Return the headerDep.  Create if necessary.
 */
function headerDep(obj) {
	if (!obj.headerDep) obj.headerDep = new Tracker.Dependency();
	return obj.headerDep;
}

/*
 * Provide helpful hints for incorrect usage
 */
function checkSelf(self, funcName) {
	if (!self || (!self.connection && !self._session && !self._sessionData)) {
		throw new Error(`Call Headers.${funcName}(this) only from within a `
			+ 'method or publish function.  With callbacks / anonymous '
			+ `functions, use: var self=this; and call Headers.${funcName}(self);`);
	}
}

/*
 * Usage in a Meteor method/publish: Headers.get(this, 'host')
 */
Headers.get = function (self, key) {
	checkSelf(self, 'get');
	const sessionData = self.connection || (self._session ? self._session.sessionData : self._sessionData);

	headerDep(sessionData).depend();
	if (!(sessionData && sessionData.headers)) return key ? undefined : {};

	return key
		? sessionData.headers[key.toLocaleLowerCase()]
		: sessionData.headers;
};

Headers.ready = function (self) {
	checkSelf(self, 'ready');
	const sessionData = self.connection || (self._session ? self._session.sessionData : self._sessionData);
	headerDep(sessionData).depend();
	return Object.keys(sessionData.headers).length > 0;
};

Headers.getClientIP = function (self, proxyCount) {
	checkSelf(self, 'getClientIP');
	const chain = this.get(self, 'x-ip-chain').split(',');
	if (typeof (proxyCount) === 'undefined') {
		this.proxyCountDeprecated(proxyCount);
		proxyCount = this.proxyCount;
	}
	return chain[chain.length - proxyCount - 1];
};

/*
 * Retrieve header(s) for the current method socket (see README.md)
 */
Headers.methodGet = function (self, header) {
	let session;
	checkSelf(self, 'methodGet');

	if (self.connection) {
		// Meteor 0.6.7+
		session = Meteor.server.sessions[self.connection.id];
	} else if (self._session || self._sessionData) {
		// convoluted way to find our session in Meteor < 0.6.7
		const sessionData = self._session ? self._session.sessionData : self._sessionData;
		const token = new Date().getTime() + Math.random();
		sessionData.tmpToken = token;
		session = _.find(Meteor.server.sessions, function (session) {
			return sessionData.tmpToken === token;
		});
	}

	const headers = session.socket.headers;
	if (!headers['x-ip-chain']) headers['x-ip-chain'] = ipChain(headers, session.socket);

	return header ? headers[header] : headers;
};

/*
 * Get the IP for the livedata connection used by a Method (see README.md)
 */
Headers.methodClientIP = function (self, proxyCount) {
	checkSelf(self, 'methodClientIP');
	const chain = this.methodGet(self, 'x-ip-chain');
	if (typeof (proxyCount) === 'undefined') {
		this.proxyCountDeprecated(proxyCount);
		proxyCount = this.proxyCount;
	}
	return chain[chain.length - proxyCount - 1];
};

// What's safe + necessary to send back to the client?
const filtered = function (headers) {
	const out = {};

	for (const key in headers) {
		if (FILTERED_HEADERS.indexOf(key) === -1
			&& !headers[key].match(/<\/?\s*script\s*>/i)) out[key] = headers[key];
	}

	return out;
};

/*
 * The client will request this "script", and send a unique token with it,
 * which we later use to re-associate the headers from this request with
 * the user's livedata session (since XHR requests only send a subset of
 * all the regular headers).
 */
WebApp.connectHandlers.use('/headersHelper.js', function (req, res, next) {
	const token = req.query.token;
	const mhData = { headers: {} };

	req.headers['x-ip-chain'] = ipChain(req.headers, req.connection).join(',');
	Headers.list[token] = req.headers;
	mhData.headers = filtered(req.headers);

	if (Headers.proxyCount) mhData.proxyCount = Headers.proxyCount;

	res.writeHead(200, { 'Content-type': 'application/javascript' });
	res.end(`Package['gadicohen:headers'].headers.store(${
		JSON.stringify(mhData)});`, 'utf8');
});

// Can only inject headers w/o appcache
if (!Package.appcache) {
	WebApp.connectHandlers.use(function (req, res, next) {
		if (InjectInitial.appUrl(req)) {
			const mhData = {
				token: new Date().getTime() + Math.random(),
			};
			if (Headers.proxyCount) mhData.proxyCount = Headers.proxyCount;

			req.headers['x-ip-chain'] = ipChain(req.headers, req.connection).join(',');
			Headers.list[mhData.token] = req.headers;
			mhData.headers = filtered(req.headers);

			InjectInitial.obj('meteor-headers', mhData, res);
		}
		next();
	});
}
