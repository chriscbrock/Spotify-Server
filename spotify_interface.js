var events = require('events');

module.exports = function(){
	return new Spotify();	
};

function Spotify(){
	// Property used for caching
	this._cache = {};

	//## When supported it would be possible to figure out if osascipt or another interface can be used

	// Set correct reference
	this.interfaceName;
	this.interface = function(){};
	this.interfaces = [];

	this.event = new events.EventEmitter();
}

/* Public methods */

/** Set what spotify interface should be used
 */
Spotify.prototype.setInterface = function(args) {
	var that = this;

	// First check if the same interface is already used. If so don't change anything
	if( args.name !== this.interfaceName && args.name && typeof args.interface === 'function' ){
		that.interface = args.interface;
		that.interfaceName = args.name;
		that.interfaceObj = args.obj;
		that.interfaces.push(args);
	}
};

Spotify.prototype.removeInterface = function(name) {
	var that = this, 
		interfaces = that.interfaces,
		i;

	// Loop through the interfaces backwards and remove the first (last) occurence
	for( i = interfaces.length; i--; ){
		if( interfaces[i].name === name ){
			interfaces.splice(i, 1);
			break;
		}
	}
};

/** Ask spotify to do something
 *
 * Checks agains a cache to reduce stress on the server (osascripts in particular are ridiculously slow).
 * Seperation between cache name and timestamp is done to be able to prevent memory leaks. If both are combined
 * there is no way to delete the property and they would pile up as time goes by.
 */
Spotify.prototype.ask = function(arguments, callback) {
	var that = this,
		cacheName = '',
		cacheInterval = 10000,
		timestamp = ~~(Date.now() / (cacheInterval * 1000)); // Cache every n seconds and floor it using a bitwise hack
	
	callback = callback || function(){}

	// Create cache name
	for( i = arguments.length; i--; ){
		cacheName += arguments[i];
	}

	// Check if cache should be used and if it's cached recently
	if( cacheInterval && that._cache[cacheName] && that._cache[cacheName][timestamp] ){
		if( !that._cache[cacheName][timestamp].error ){
			// There's a cache with no error! Callback the cache
			callback.apply(null, that._cache[cacheName][timestamp]);
		}
		else {
			// There's a cache but there was an error last time
		}
	}
	else{
		arguments.push(function(err){
			callback.apply(null, arguments);

			if( cacheInterval ){
				// Create a new cache and remove the old one
				that._cache[cacheName] = {};
				that._cache[cacheName][timestamp] = arguments;
			}
		});

		// Call the proper spotify interface
		that.interface.apply(that.interfaceObj || this, arguments);
	}
};


Spotify.prototype.play = function(callback) {
	var that = this;

	callback = callback || function(){};

	that.ask(['playpause', 'state', 'name', 'artist'], function(){

		if( typeof arguments[0] === 'object' ){
			that.error(arguments[0], callback);
			return;
		}

		if( arguments[1] === 'playing' ){
			callback(200, 'Now playing ' + arguments[2] + ' by ' + arguments[3] + '.');
		}
		else if( arguments[1] === 'paused' ){
			callback(200, 'You paused in the middle of ' + arguments[2] + ' by ' + arguments[3] + '! :O');
		}
		else {
			callback(200, 'Nothing is playing...');
		}

		that.event.emit('set', {
			state: arguments[1]
		});
	});
};

Spotify.prototype.playUri = function() {
	// args: uri, [context], callback

	var that = this,
		uri = arguments[0],
		l = arguments.length - 1,
		callback = typeof arguments[l] === 'function' && arguments[l--] || function(){},
		context = (l > 0 && typeof arguments[l] === 'string') &&  arguments[l] || undefined;

	// Make VERY sure that the uri doesn't contain anything I don't want it to contain
	if( context && context.match(/[^A-Za-z0-9:#]/g) || uri.match(/[^A-Za-z0-9:#]/g) ){
		callback(400, '¿Hablos español?');
	}
	else {
		that.ask([{
				command: 'play track',
				values: [uri, context]
			}], 'state', 'name', 'artist', 'album', 'uri',
			function(){
				if( typeof arguments[0] === 'object' ){
					that.error(arguments[0], callback);
					return;
				}

				if( arguments[1] === 'playing' ){
					callback(200, 'Now playing ' + arguments[2] + ' by ' + arguments[3] + '.');
				}
				else {
					callback(200, 'It seems that URI didn\'t work... What a shame, I know I would have loved that song.');
				}

				that.event.emit('new track', {
					state: arguments[1],
					name: arguments[2],
					artist: arguments[3],
					album: arguments[4],
					uri: arguments[5]
				});
			}
		);
	}
};

Spotify.prototype.next = function(callback) {
	var that = this;

	callback = callback || function(){};

	that.ask(['next track', 'state', 'name', 'artist', 'album', 'uri'], function(){
		if( typeof arguments[0] === 'object' ){
			that.error(arguments[0], callback);
			return;
		}

		if( arguments[1] === 'playing' ){
			callback(200, 'Now playing ' + arguments[2] + ' by ' + arguments[3] + '!');
		}
		else {
			callback(200, 'Nothing is playing anymore... Guess this is the end of the road.');
		}

		that.event.emit('new track', {
			state: arguments[1],
			name: arguments[2],
			artist: arguments[3],
			album: arguments[4],
			uri: arguments[5]
		});
	});
};

Spotify.prototype.prev = function(callback) {
	var that = this;

	callback = callback || function(){};

	that.ask(['previous track', 'state', 'name', 'artist', 'album', 'uri'], function(){
		if( typeof arguments[0] === 'object' ){
			that.error(arguments[0], callback);
			return;
		}

		if( arguments[1] === 'playing' ){
			callback(200, 'Now playing ' + arguments[2] + ' by ' + arguments[3] + '.');
		}
		else {
			callback(200, 'Whoaa! You backed up so fast nothing is playing anymore... :(');
		}

		that.event.emit('new track', {
			state: arguments[1],
			name: arguments[2],
			artist: arguments[3],
			album: arguments[4],
			uri: arguments[5]
		});
	});
};

Spotify.prototype.get = function(property, callback) {
	var that = this,
		command = '',
		cache = 10;

	callback = callback || function(){};

	switch( property ){
		case 'state':
			command = 'state';
		break;
		case 'position':
			command = 'position';
			cache = false;
		break;
		case 'volume':
			command = 'volume';
		break;
		case 'name':
			command = 'name';
		break;
		case 'artist':
			command = 'artist';
		break;
		//## I need to figure out how to stream the response from an osascript or get it from the spotify api
		/*case 'artwork':
			command = 'artwork of current track';
		break;*/
		case 'album':
			command = 'album';
		break;
		case 'duration':
			command = 'duration';
		break;
		case 'uri':
			command = 'uri';
		break;
		case 'current':
			that.ask(['name', 'artist', 'album', 'duration', 'uri', 'state'], function(){
				if( typeof arguments[0] === 'object' ){
					that.error(arguments[0], callback);
					return;
				}

				var data = 'Track: ' + arguments[0] + '\n'
					+ 'Artist: ' + arguments[1] + '\n'
					+ 'Album: ' + arguments[2] + '\n'
					+ 'Duration: ' + arguments[3] + '\n'
					+ 'Sporify URI: ' + arguments[4] + '\n'
					+ 'state: ' + arguments[5] + '\n';

				callback(200, data);
				that.event.emit('get', {
					name: arguments[0],
					artist: arguments[1],
					album: arguments[2],
					duration: arguments[3],
					uri: arguments[4],
					state: arguments[5]
				});
			});
		break;
		default:
			callback(404, 'Que?');
		break;
	}

	if( command ){
		that.ask([command], function(){
			var obj = {};

			if( typeof arguments[0] === 'object' ){
				that.error(arguments[0], callback);
				return;
			}

			obj[property] = arguments[0];

			that.event.emit('get', obj);
			callback(200, arguments[0]);
		});
	}
};

Spotify.prototype.set = function(property, value, callback) {
	var that = this;

	callback = callback || function(){};

	switch( property ){
		case 'state':
			if( value === 'play' ){
				that.ask(['play', 'state', 'name', 'artist'], function(){
					if( typeof arguments[0] === 'object' ){
						that.error(arguments[0], callback);
						return;
					}

					var response = arguments[1] === 'playing'
						&& 'Now dancing to ' + arguments[2] + ' by ' + arguments[3] + '!'
						|| 'Because of technical problems we only offer the following a capella song: "Bä bää vita lamm, har du någon ull? [---]"';
					
					callback(200, response);
					that.event.emit('set', {state: arguments[1]});
				});
			}
			else if( value === 'pause' ){
				that.ask(['pause', 'state', 'name', 'artist'], function(){
					if( typeof arguments[0] === 'object' ){
						that.error(arguments[0], callback);
						return;
					}

					var response = arguments[1] === 'paused'
						&& 'You paused in the middle of ' + arguments[2] + ' by ' + arguments[3] + '! :O'
						|| 'Hey, I\'m not playing!';

					callback(200, response);
					that.event.emit('set', {state: arguments[1]});
				});
			}
			else {
				callback(400, 'I can\'t do that!');
			}
		break;
		case 'position':
			if( !isNaN(value) && value >= 0 ){
				that.ask([{
						command: 'position',
						values: [value]
					}], 'duration',
					function(){
						if( typeof arguments[0] === 'object' ){
							that.error(arguments[0], callback);
							return;
						}

						var response = value < arguments[0]
							&& 'Yeah! I\'ve always loved the part at ' + value + ' seconds!'
							|| 'I know this song is way too long, but not that long!';
						
						callback(200, response);
						that.event.emit('set', {position: value});
					}
				);
			}
			else {
				callback(400, 'That\'s not a knife... THIS is a knife.');
			}
		break;
		case 'volume':
			if( !isNaN(value) && value >= 0 && value <= 100 ){
				that.ask([{
					command: 'volume',
					values: [value]
				}],
				function(){
					if( typeof arguments[0] === 'object' ){
						that.error(arguments[0], callback);
						return;
					}

					callback(200, 'Volume set to ' + value);
					that.event.emit('set', {volume: value});
				});
			}
			else if( value > 100 ){
				callback(200, 'The numbers all go to eleven. Look, right across the board, eleven, eleven, eleven... Not ' + value + '!');
			}
			else if( value < 0 ){
				callback(200, 'So you like it quiet, eh?');
			}
			else {
				callback(400, 'Invalid volume value');
			}
		break;
		default:
			callback(404, 'No hablo americano');
		break;
	}
};

Spotify.prototype.error = function(error, callback) {
	if( error.error === 'asyncRequest' ){
		callback(202, error.text);
	}
};