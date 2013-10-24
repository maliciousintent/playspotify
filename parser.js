/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */

'use strict';

var swallow = require('node-swallow')
  , xml2js = require('xml2js')
  , util = require('./util')
  , coolog = require('coolog')
  , logger = coolog.logger('parser.js')
  ;

module.exports = function _module(player, spotify, pubnub, CHANNEL_NAME) {
  
  function _parse(message) {
    if (message.action === 'search') {
      spotify.search(message.search, swallow('while searching for a track', function (xml) {
        var parser = new xml2js.Parser();
        parser.on('end', function (data) {
          var t_count = parseInt(data.result['total-tracks'][0], 10)
            , tracks_arr = []
            , msg
            ;
            
          if (t_count < 1) {
            logger.info('No track found for search "%s"', message.search);
            msg = {
                answer_id: message.answer_to,
                message: 'Not Found'
            };
          } else {
            data.result.tracks[0].track.forEach(function (track, i) {
              if (i>5) {
                // limit the results due to pubnub
                return false;
              }
              tracks_arr.push({
                answer_id: message.answer_to,
                name: track.title[0],
                artist: track.artist[0],
                album: track.album[0],
                year: track.year[0],
                uri: 'spotify:track:' + util.base62.fromHex(track.id[0], 22)
              });
            });
            
            msg = {
              answer_id: message.answer_to,
              message: tracks_arr          
            };
          }
          
          pubnub.publish({
              channel: CHANNEL_NAME,
              message: msg
          });
        });
        parser.parseString(xml);
      }));
    } else if (message.action === 'play') {
      spotify.get(message.uri, swallow('while retrieving Spotify track', function (track) {
        if (track) {
          player.play(track);
        } else {
          logger.warn('cannot reproduce track with URI ', message.uri);
        }
      }));
    } else if (message.action === 'add') {
      spotify.get(message.uri, swallow('while retrieving Spotify track', function (data) {
        if (/spotify:track:.+$/i.test(message.uri) && data) {
          player.add(data);
        } else if (/spotify:album:.+$/i.test(message.uri) && data && data.disc) {
          _parseAlbum(data);
        } else {
          logger.warn('cannot reproduce track/album with URI ', message.uri);
        }
      }));
    } else if (message.action === 'skip') {
      logger.info('skip current track');
      player.skip();
    } else if (message.action === 'add-playlist') {
      try {
        spotify.playlist(message.uri, function (err, playlist) {
          if (playlist && playlist.contents && playlist.contents.items) {
            logger.info('playlist found with ' + playlist.contents.items.length + ' items');
            playlist.contents.items.forEach(function (track) {
              if (track.uri.indexOf(':local:') !== -1) {
                logger.info('Skipping local track ', track.uri);
                return;
              }
              spotify.get(track.uri, function (err, track) {
                console.log('found track');
                if (err) {
                  logger.error('Cant find song for URI');
                  return;
                }
                logger.info('added track ' + track.name);
                player.add(track);
              });
            });
          } else {
            logger.warn('cannot reproduce playlist ' + message.uri);
          }
        });
      } catch (e) {
        console.trace(e);
      }
    } else if (message.action === 'add-album') {
      spotify.get(message.uri, swallow('while retrieving Spotify album', function (album) {
        if (album && album.disc) {
          _parseAlbum(album);
        } else {
          logger.warn('cannot reproduce album ' + message.uri);
        }
      }));
    } else if (message.action === 'random') {
      if (message.random && message.random === 'on') {
        player.setRandom(true);
      } else if (message.random && message.random === 'of') {
        player.setRandom(false);
      }
    } else if (message.action === 'clear') {
      player.clear();
    } else if (message.action === 'suicide') {
      process.exit(0);
    }
  }

  function _parseAlbum(album) {
    logger.info('album found');
    album.disc.forEach(function (disc) {
      disc.track.forEach(function (track) {
        spotify.get(track.uri, swallow('while retrieving Spotify track', function (track) {
          player.add(track);
        }));
      });
    });
  }

  return {
    'parseMessage': _parse
  };
};