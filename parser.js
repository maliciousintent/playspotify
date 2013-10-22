/*jshint node:true, laxcomma:true, unused:true, undef:true, indent:2 */

'use strict';

var swallow = require('node-swallow')
  , xml2js = require('xml2js')
  , util = require('./util')
  ;

module.exports = function _module(player, spotify) {
  
  function _parse (message) {
    if (message.action === 'search') {
      spotify.search(message.search, swallow('while searching for a track', function (xml) {
        var parser = new xml2js.Parser();
        parser.on('end', function (data) {
          var t_count = parseInt(data.result['total-tracks'][0], 10);
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
    } else if (message.action === 'play') {
      spotify.get(message.uri, swallow('while retrieving Spotify track', function (track) {
        player.add(track);
      }));
    } else if (message.action === 'add') {
      spotify.get(message.uri, swallow('while retrieving Spotify track', function (track) {
        player.add(track);
      }));
    } else if (message.action === 'skip') {
      console.log('skip track');
      player.skip();
    }
  }

  return {
    'parseMessage': _parse
  };
};