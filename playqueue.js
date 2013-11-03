/*jshint node:true, indent:2, laxcomma:true, undef:true, unused:true, eqnull:true, camelcase:false */
/*global setInterval:true */
'use strict';

var NATION = 'IT' //process.env.NATION
  ;

require('sugar');
var lame = require('lame')
  , Speaker = require('speaker')
  , EventEmitter = require('events').EventEmitter
  , nodeutils = require('util')
  , coolog = require('coolog')
  , logger = coolog.logger('playqueue.js')
  , redis = require('redis')
  , util = require('./util')
  ;

var client = redis.createClient()
  ;

client.on('error', function (err) {
  logger.error('Redis Error ' + err);
  process.exit(1);
});

module.exports.PlayQueue = PlayQueue;

function PlayQueue(spotify) {
  var that = this;
  this.spotify = spotify;
  this.spkr = new Speaker();
  this.playing = false;
  this.imskipping = false;
  this.random = false;
  this._currentStreams = [null, null]; // play, decoded

  this.tracks = [];
  this.index = client.get;
  
  client.get('index', function (err, body) {
    that.index = body || -1;
  });

  client.get('tracks', function (err, body) {
    if (body === null) {
      that.tracks = [];
      // just in case..
      that.index = -1;
    } else {
      that.tracks = JSON.parse(body);
    }

    logger.debug('tracks and index loaded from redis', that.tracks, that.index);
    if (that.index > -1) {
      // play tracks, if any
      that.index = that.index - 1;
      setTimeout(function () {
        that.next();
      }, 1000 * 10);
    }
  });

  // saving routine
  setInterval(function () {
    var jsonTracks = [];
    that.tracks.forEach(function (track) {
      if ('string' === typeof track) {
        jsonTracks.push(track);
      } else {
        jsonTracks.push(track.uri);
      }
    });

    logger.debug('saving data on redis');
    client.set('index', that.index, function (/*jshint unused:false */ err, res) {
      if (err) {
        logger.error('error while saving on redis', err);
      }
    });
    client.set('tracks', JSON.stringify(jsonTracks), function (/*jshint unused:false */ err, res) {
      if (err) {
        logger.error('error while saving on redis', err);
      }
    });
  }, 1000 * 10);
}
nodeutils.inherits(PlayQueue, EventEmitter);


PlayQueue.prototype.setRandom = function (random) {
  this.random = random;
};

PlayQueue.prototype.add = function (track) {
  var countriesAllowed = track.restriction[0].countriesAllowed
    , countriesForbidden = track.restriction[0].countriesForbidden
    ;

  if (!track || !track.gid) {
    logger.warn('Silently ignoring invalid track', track);
    return;
  }

  if ((countriesForbidden !== undefined && countriesForbidden.indexOf(NATION) !== -1) ||
      (countriesAllowed !== undefined && countriesAllowed.indexOf(NATION) === -1)) {
    logger.info('cannot reproduce this song in this nation,\nAllowed:', countriesAllowed, '\nRestriction:', countriesForbidden);
    this.emit('error', 'This song is not available in your country.');
    return;
  }

  this.tracks.push({
    uri: 'spotify:track:' + util.gid2uid(track.gid),
    track: track
  });

  logger.info('Queued track ' + track.name + ' by ' + track.artist[0].name);
  this.emit('message', 'Queued track ' + track.name + ' by ' + track.artist[0].name);
  
  if (this.playing === false) {
    this.next();
  }
};


PlayQueue.prototype.play = function (track) {
  this.tracks.insert({
    uri: 'spotify:track:' + util.gid2uid(track.gid),
    track: track
  }, this.index + 1);
  
  this.imskipping = true;
  this.next();
};


PlayQueue.prototype._clearStreams = function () {
  if (this._currentStreams[1] != null) {
    this._currentStreams[1].unpipe();
  }
  
  if (this._currentStreams[0] != null) {
    this._currentStreams[0].unpipe();
  }
  
  this._currentStreams = [null, null];
  
  if (this.spkr) {
    this.spkr.end();
    this.spkr = undefined;
  }
};


PlayQueue.prototype.skip = function () {
  this.imskipping = true;
  this.next();
};


PlayQueue.prototype.next = function () {
  var that = this;

  if (this.tracks.length === 0) {
    logger.info('queue empty');
    this.playing = false;
    return;
  }
  
  if (this.playing || this.imskipping) {
    logger.info('clearing streams...');
    this._clearStreams();
    
    if ('undefined' === typeof this.spkr) {
      logger.info('created speaker');
      this.spkr = new Speaker();
    }
  }
  
  this.playing = true;
  this.imskipping = false;

  if (this.random) {
    this.index = Math.ceil(Math.random() * this.tracks.length);
  } else {
    this.index = this.index + 1;
  }

  if ('undefined' === typeof this.tracks[this.index]) {
    // if playlist is over, start from begin
    logger.info('playlist is empty, starting from begin');
    this.index = 0;
    this.next();
    return;
  }
  
  var track = this.tracks[this.index];

  if ('string' === typeof track) {
    this.spotify.get(track, function (err, trackObj) {
      logger.debug('getting track from spotify...');
      
      if (err) {
        console.log('cannot get track', track);
        this.emit('error', 'Error getting track from Spotify:'  + nodeutils.inspect(track));
        return;
      }
      
      that.tracks[that.tracks.indexOf(track)] = {
        uri: track,
        track: trackObj
      };
      
      that._play(trackObj);
    });
    
  } else if ('object' === typeof track && track.track != null) {
    this._play(track.track);
    
  } else {
    this.emit('error', 'Track is invalid: ' + nodeutils.inspect(track));
  }
};


PlayQueue.prototype.clear = function () {
  this.tracks = [];
  this.index = 0;
  this.imskipping = true;
  this.next();
};


PlayQueue.prototype._play = function (track) {
  var that = this;

  if (track === undefined || typeof track.play !== 'function') {
    // fix 'track.play is not a function'
    this.next();
    return;
  }

  this._currentStreams[0] = track.play();
  this._currentStreams[1] = this._currentStreams[0].pipe(new lame.Decoder());
  this._currentStreams[1]
    .pipe(this.spkr)
    .on('finish', function () {
      if (that.imskipping) {
        that.imskipping = false;
      } else {
        process.nextTick(function () { that.next(); });
      }
    });
    
  logger.info('Playing ' + track.name + ' by ' + track.artist[0].name);
  this.emit('message', 'Now playing ' + track.name + ' by ' + track.artist[0].name);
};

