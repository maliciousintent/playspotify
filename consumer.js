/*jshint node:true, laxcomma:true, unused:true, undef:true, indent:2 */

'use strict';

var lame = require('lame')
  , Speaker = require('speaker')
  , Spotify = require('spotify-web')
  , swallow = require('node-swallow')
  , pubnub = require('pubnub')
  , xml2js = require('xml2js')
  , util = require('./util')
  , PlayQueue = require('./playqueue').PlayQueue
  ;

module.exports = function _module(SPOTIFY_USERNAME, SPOTIFY_PASSWORD, PUBNUB_SUBSCRIBE_KEY, PUBNUB_PUBLISH_KEY, PUBNUB_CHANNEL) {
  
  var player = new PlayQueue();
  
  setInterval(function () { player.next(); }, 20000);
  
  Spotify.login(SPOTIFY_USERNAME, SPOTIFY_PASSWORD, swallow('while logging into Spotify', function (spotify) {
    var pn = pubnub.init({
      subscribe_key: PUBNUB_SUBSCRIBE_KEY
    , publish_key: PUBNUB_PUBLISH_KEY
    });
        
    pn.subscribe({
      channel: PUBNUB_CHANNEL,
      connect: function () { /* @TODO: handle errors */ },
      callback: function (message) {
        
        if (message.search !== undefined) {
          console.log('Searching track', message.search);
          
          spotify.search(message.search, swallow('while searching for a track', function (xml) {
            var parser = new xml2js.Parser();
            parser.on('end', function (data) {
              var t_count = parseInt(data.result['total-tracks'][0], 10)
              
              if (t_count < 1) {
                console.log('No track found for search "%s"', message.search);
              } else {
                var track = data.result.tracks[0].track[0] // id,title,artist,album,year
                  , uri = 'spotify:track:' + util.base62.fromHex(track.id[0], 22)
                  ;
                  
                console.log('Found track', track.title[0], 'by', track.artist[0], '(' + track.album[0] + ', ' + track.year[0] + ')');
                                
                spotify.get(uri, swallow('while getting track details', function (track) {
                  player.add(track);
                }));
              }
            });
            parser.parseString(xml);
          }));
          
        } else {
          spotify.get(message.uri, swallow('while retrieving Spotify track', function (track) {
            player.add(track);
          }));
        }
      }
    });
  }));

};
