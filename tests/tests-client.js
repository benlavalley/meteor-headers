import { Headers } from 'meteor/gadicohen:headers';

/*
 * Real test would make a new request with a cookie and test for it's presence,
 * but this works just as well.
 */
Tinytest.add('headers - filtered keys', function (test) {
	test.isUndefined(Headers.get('user-agent'), 'filtered keys should be undefined');
});
