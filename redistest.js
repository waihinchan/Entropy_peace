var redis = require('redis-eventemitter');

pubsub = redis({
	port: 6370,
    host: '127.0.0.1',
});

// Listen for messages on the *:newuser channel
pubsub.on('whatever', function(channel, user) {
	console.log(channel); // prints "myservice:newuser"
	console.log(user);    // user is a json map as expected
});

