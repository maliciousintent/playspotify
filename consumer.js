/*jshint node:true, laxcomma:true, unused:true, undef:true, indent:2 */

'use strict';

var lame = require('lame')
  , Speaker = require('speaker')
  , Spotify = require('spotify-web')
  , swallow = require('node-swallow')
  , pubnub = require('pubnub')
  ;

module.exports = function _module(SPOTIFY_USERNAME, SPOTIFY_PASSWORD, PUBNUB_SUBSCRIBE_KEY, PUBNUB_PUBLISH_KEY, PUBNUB_CHANNEL) {
  
  Spotify.login(SPOTIFY_USERNAME, SPOTIFY_PASSWORD, swallow('while logging into Spotify', function (spotify) {
    var pn = pubnub.init({
      subscribe_key: PUBNUB_SUBSCRIBE_KEY
    , publish_key: PUBNUB_PUBLISH_KEY
    });
        
    pn.subscribe({
      channel: PUBNUB_CHANNEL,
      connect: function () { /* @TODO: handle errors */ },
      callback: function (message) {
        spotify.get(message.uri, swallow('while retrieving Spotify track', function (track) {
          console.log('Playing: %s - %s', track.artist[0].name, track.name);
          
          track.play()
            .pipe(new lame.Decoder())
            .pipe(new Speaker());
            // .on('finish', function () {
            //   spotify.disconnect();
            // });
        }));
      }
    });
  }));
};
