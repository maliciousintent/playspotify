/*jshint node:true, laxcomma:true, unused:true, undef:true, indent:2 */

'use strict';

var Spotify = require('spotify-web')
  , swallow = require('node-swallow')
  , pubnub = require('pubnub')
  , PlayQueue = require('./playqueue').PlayQueue
  , parser
  ;

module.exports = function _module(SPOTIFY_USERNAME, SPOTIFY_PASSWORD, PUBNUB_SUBSCRIBE_KEY, PUBNUB_PUBLISH_KEY, PUBNUB_CHANNEL) {
  
  var player = new PlayQueue();
  
  Spotify.login(SPOTIFY_USERNAME, SPOTIFY_PASSWORD, swallow('while logging into Spotify', function (spotify) {
    var pn = pubnub.init({
      subscribe_key: PUBNUB_SUBSCRIBE_KEY
    , publish_key: PUBNUB_PUBLISH_KEY
    });

    // init parser
    parser = require('./parser')(player, spotify);

    pn.subscribe({
      channel: PUBNUB_CHANNEL,
      connect: function () { /* @TODO: handle errors */ },
      callback: parser.parseMessage
    });
  }));
};