var app = require('express')(),
	port = 3000,
	spotify = require('./spotify_interface')();


// Routing

app.use(function(req, res, next){
	res.httpResponse = function(status, message){
		res.send(status, message);
	};
	next();
});

app.get('/', function(req, res){
	res.sendfile(__dirname + '/index.html');
});

app.get('/play', function(req, res){
	spotify.play(res.httpResponse);
});

app.get('/play/:uri', function(req, res){
	spotify.playUri(req.params.uri, res.httpResponse);
});

app.get('/next', function(req, res){
	spotify.next(res.httpResponse);
});

app.get('/prev', function(req, res){
	spotify.prev(res.httpResponse);
});

app.get('/get/:property', function(req, res){
	spotify.get(req.params.property, res.httpResponse);
});

app.get('/set/:property/:value', function(req, res){
	spotify.set(req.params.property, req.params.value, res.httpResponse);
});

app.get('/current', function(req, res){
	spotify.get('current', res.httpResponse);
});

app.listen(port);
console.log('Listening on port ' + port);