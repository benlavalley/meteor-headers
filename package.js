Package.describe({
	name: 'gadicohen:headers',
	summary: 'Access HTTP headers on both server and client',
	version: '0.0.32',
	git: 'https://github.com/gadicc/meteor-headers.git',
});

Npm.depends({
	connect: '3.7.0',
});

Package.onUse(function (api) {
	api.versionsFrom('1.8.1');
	api.use(['ejson', 'ecmascript'], ['server', 'client']);
	api.use(['webapp', 'livedata', 'tracker', 'check', 'underscore'], ['client', 'server']);
	api.mainModule('lib/headers-common.js', ['server', 'client']);
	api.use('appcache', 'server', { weak: true });
	api.use('meteorhacks:inject-initial@1.0.5', ['server', 'client']);

	// api.addFiles('lib/headers-common.js', ['client', 'server']);
	api.addFiles('lib/headers-server.js', 'server');
	api.addFiles('lib/headers-client.js', 'client');

	api.export('Headers', ['client', 'server']);
});

Package.onTest(function (api) {
	api.use(['tinytest', 'gadicohen:headers']);
	api.addFiles('tests/tests-client.js', 'client');
	api.addFiles('tests/tests-server.js', 'server');
});
