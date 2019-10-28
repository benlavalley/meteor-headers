import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { InjectInitial } from 'meteor/meteorhacks:inject-initial';
import { Headers } from './headers-common';
/*
 * Generate a unique token
 */
Headers.token = new Date().getTime() + Math.random();

/*
 * Used for reactivity
 */
Headers.dep = new Tracker.Dependency;

/*
 * Called after receiving all the headers, used to re-associate headers
 * with this clients livedata session (see headers-server.js)
 */
Headers.store = function (mhData) {
	this.list = mhData.headers;
	if (mhData.proxyCount)
		this.proxyCount = mhData.proxyCount;
	Meteor.call('headersToken', mhData.token || this.token);
	for (var i = 0; i < this.readies.length; i++)
		this.readies[i]();
	this.readiesRun = true;
	this.dep.changed();
};

// On each disconnect, queue reassociation for next connection
Tracker.autorun(function () {
	var status = Meteor.status();
	if (!status.connected && status.retryCount == 0) {
		Meteor.call('headersToken', Headers.token);
	}
});

/*
 * This has two completely different uses, but retains the same name
 * as this is what people expect.
 *
 * With an arg: Store a callback to be run when headersHelper.js completes
 * Without an arg: Return a reactive boolean on whether or not we're ready
 */
Headers.readies = [];
Headers.readiesRun = false;
Headers.ready = function (callback) {
	if (callback) {
		this.readies.push(callback);
		// Run immediately if headers.store() was already called previously
		if (this.readiesRun)
			callback();
	} else {
		this.dep.depend();
		return Object.keys(this.list).length > 0;
	}
};

var __headers__ = InjectInitial.get('meteor-headers');
if (__headers__) {
	// Since 0.0.13, headers are available before this package is loaded :)
	Headers.store(__headers__);
	delete (__headers__);
} else {
	// Except in tests, browserPolicy disallowInlineScripts() and appcache
	/*
 	* Create another connection to retrieve our headers (see README.md for
 	* why this is necessary).  Called with our unique token, the retrieved
 	* code runs headers.store() above with the results
	*/
	(function (d, t) {
		var g = d.createElement(t),
			s = d.getElementsByTagName(t)[0];
		g.src = '/headersHelper.js?token=' + Headers.token;
		s.parentNode.insertBefore(g, s);
	}(document, 'script'));
}

/*
 * Get a header or all headers
 */
Headers.get = function (header) {
	this.dep.depend();
	return header ? this.list[header.toLocaleLowerCase()] : this.list;
};

/*
 * Get the client's IP address (see README.md)
 */
Headers.getClientIP = function (proxyCount) {
	var chain = this.get('x-ip-chain').split(',');
	if (typeof (proxyCount) == 'undefined')
		proxyCount = this.proxyCount;
	return chain[chain.length - proxyCount - 1];
};
