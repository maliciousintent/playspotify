/*jshint node:true, laxcomma:true */

'use strict';

var lame = require('lame');
var Speaker = require('speaker');
var Spotify = require('spotify-web');
 


module.exports = function (SPOTIFY_USERNAME, SPOTIFY_PASSWORD, PUBNUB_SUBSCRIBE_KEY, PUBNUB_PUBLISH_KEY, PUBNUB_CHANNEL) {
	Spotify.login(SPOTIFY_USERNAME, SPOTIFY_PASSWORD, function (err, spotify) {
	  if (err) {
	    throw err;
	  }

	  var pubnub = require('pubnub').init({
	    subscribe_key: PUBNUB_SUBSCRIBE_KEY
	  , publish_key: PUBNUB_PUBLISH_KEY
	  });
	  
	  console.log('waiting for messages');
	  
	  pubnub.subscribe({
	    channel  : PUBNUB_CHANNEL,
	    connect: function () { console.log('PubNub connected.');   },
	    callback : function(message) {
	      console.log('got message', message);
	      spotify.get(message.uri, function (err, track) {
	        if (err) throw err;
	        console.log('Playing: %s - %s', track.artist[0].name, track.name);

	        // play() returns a readable stream of MP3 audio data
	        track.play()
	          .pipe(new lame.Decoder())
	          .pipe(new Speaker())
	          .on('finish', function () {
	            spotify.disconnect();
	          });

	      });
	    }
	  });

	  
	  
	});	
}
