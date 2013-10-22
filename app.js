/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */

'use strict';

var Spotify = require('spotify-web')
  , swallow = require('node-swallow')
  , coolog = require('coolog')
  , logger = coolog.logger('consumer.js')
  , pubnub = require('pubnub')
  , PlayQueue = require('./playqueue').PlayQueue
  , parser
  ;

// Credentials
var SPOTIFY_USERNAME = process.env.SPOTIFY_USERNAME
  , SPOTIFY_PASSWORD = process.env.SPOTIFY_PASSWORD
  , PUBNUB_SUBSCRIBE_KEY = process.env.PUBNUB_SUBSCRIBE_KEY
  , PUBNUB_PUBLISH_KEY = process.env.PUBNUB_PUBLISH_KEY
  , PUBNUB_CHANNEL = process.env.PUBNUB_CHANNEL
  ;
  
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
    connect: function () {
      logger.ok('pubnub connected');
    },
    callback: parser.parseMessage
  });

  logger.ok('playspotify started ...');
}));