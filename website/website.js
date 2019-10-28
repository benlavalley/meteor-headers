import { Headers } from 'meteor/gadicohen:headers';
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Blaze } from 'meteor/blaze';

const headersCol = new Meteor.Collection('headers');
const methodHeadersCol = new Meteor.Collection('methodHeaders');

if (Meteor.isClient) {
	/* Helpers */

	Blaze.Template.registerHelper('dstache', function () {
		return '{{';
	});

	Blaze.Template.registerHelper('markdown', new Template('markdown', function () {
		const view = this;
		let content = '';
		if (view.templateContentBlock) {
			content = Blaze._toText(view.templateContentBlock, HTML.TEXTMODE.STRING);
		}
		return HTML.Raw(marked(content));
	}));

	/* clientIP + socketIP */

	Template.clientIP.clientIP = function () {
		if (Headers.ready()) return Headers.getClientIP();
		else return 'Loading...';
	};

	Session.setDefault('socketIP', 'Loading...');
	Template.clientIP.socketIP = function () {
		return Session.get('socketIP');
	};
	Meteor.startup(function () {
		Meteor.call('socketIP', function (error, data) {
			Session.set('socketIP', data);
		});
	});

	/* clientHeaders */

	Template.clientHeaders.headers = function () {
		if (Headers.ready()) return JSON.stringify(Headers.get(), null, 2);
		else return 'Loading...';
	};

	/* serverHeaders (via method call) */

	Meteor.startup(function () {
		Meteor.call('headers', function (error, data) {
			Session.set('headers', data);
		});
		Meteor.call('methodHeaders', function (error, data) {
			Session.set('methodHeaders', data);
		});
	});

	Session.setDefault('headers', 'Loading...');
	Session.setDefault('methodHeaders', 'Loading...');

	Template.serverMethod.headers = function () {
		const headers = Session.get('headers');
		return JSON.stringify(headers, null, 2);
	};

	Template.serverMethod.methodHeaders = function () {
		const headers = Session.get('methodHeaders');
		return JSON.stringify(headers, null, 2);
	};

	/* serverHeaders (via publish) */

	Template.serverPublish.headers = function () {
		return headersCol.find().fetch();
	};
	Template.serverPublish.methodHeaders = function () {
		return methodHeadersCol.find().fetch();
	};

	Meteor.subscribe('headers');
	Meteor.subscribe('methodHeaders');

	Headers.ready(function () {
		console.log('headers are ready');
		console.log(Headers);
	});
}

if (Meteor.isServer) {
	/* serverHeaders (via method call) */

	Meteor.methods({
		headers() {
			// console.log(this.connection);

			return Headers.get(this);
		},
		methodHeaders() {
			return Headers.methodGet(this);
		},
		socketIP() {
			return Headers.methodClientIP(this);
		},
	});

	/* serverHeaders (via publish) */

	Meteor.publish('headers', function () {
		const data = Headers.get(this);
		for (key in data) {
			this.added('headers', Random.id(), {
				key, value: data[key],
			});
		}
	});

	Meteor.publish('methodHeaders', function () {
		const data = Headers.methodGet(this);
		for (key in data) {
			this.added('methodHeaders', Random.id(), {
				key, value: data[key],
			});
		}
	});

	try {
		Headers.get();
		throw new Error('Ran Headers.get() outside of a method/publish and'
      + "it didn't throw an error");
	} catch (error) {
		// TODO, make sure we're catching the correct error
	}

	/* onConnection */

	Meteor.onConnection(function (connection) {
		// console.log(Headers.methodGet({connection: connection}));

		// This will never work as it runs too early, see
		// https://github.com/gadicc/meteor-headers/issues/30
		// console.log(Headers.get({connection: connection}));
	});
}
