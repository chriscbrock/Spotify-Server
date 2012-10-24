var 
// Dependencies
	express = require('express'),
	server = require('http'),
	socket = require('socket.io'),
// Interfaces
	Client = require('./client'),
	Spotify = require('./spotify'),
	Cache = require('./cache');


function App(args){
	var that = this;

	/* Server stuff */

	that.app = args.express();
	that.server = args.server.createServer(that.app);
	that.sio = args.socket.listen(that.server);
	that.port = args.port;


	/* Modules */

	that.cache = Cache();

	that.client = Client({
		main: that
	});

	that.spotify = Spotify({
		main: that,
		token: '1337' //## Create a config-file and keep auth stuff there
	});


	/* Start server stuff */

	that.route();
	that.httpListen();
};

App.prototype.route = function() {
	var that = this;

	//Routing

	that.app.get('/', function(req, res){
		res.sendfile(__dirname + '/index.html');
	});
};

App.prototype.httpListen = function() {
	var that = this,
		port = that.port;

	that.server.listen(port);
	console.info('Listening on port %s', port);
};


// Wohoo

var app = new App({
	express: express,
	server: server,
	port: 3000,
	socket: socket
});