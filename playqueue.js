/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */

'use strict';

var lame = require('lame')
  , Speaker = require('speaker')
  , EventEmitter = require('events').EventEmitter
  , nodeutils = require('util')
  , coolog = require('coolog')
  , logger = coolog.logger('playqueue.js')
  ;

module.exports.PlayQueue = PlayQueue;

function PlayQueue() {
  this.spkr = new Speaker();
  this.tracks = [];
  this.index = -1;
  this.playing = false;
  this.imskipping = false;
  this.random = false;
  this._currentStreams = [null, null]; // play, decoded
}
nodeutils.inherits(PlayQueue, EventEmitter);


PlayQueue.prototype.setRandom = function (random) {
  this.random = random;
};

PlayQueue.prototype.add = function (track) {
  this.tracks.push(track);
  logger.info('Queued track ' + track.name + ' by ' + track.artist[0].name);
  
  if (this.playing === false) {
    this.next();
  }
  
  return this;
};

PlayQueue.prototype.play = function (track) {
  this.imskipping = true;
  this.tracks.splice(this.index, 0, track);
  this.index -= 1;
  this.next();
};


PlayQueue.prototype._clearStreams = function () {
  this._currentStreams[1] && this._currentStreams[1].unpipe();
  this._currentStreams[0] && this._currentStreams[0].unpipe();
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
    return this;
  }
  
  if (this.playing) {
    logger.info('clearing streams ...');
    this._clearStreams();
    if ('undefined' === typeof this.spkr) {
      logger.info('created speaker');
      this.spkr = new Speaker();
    }
  }
  
  this.playing = true;

  if (this.random) {
    this.index = Math.ceil(Math.random() * this.tracks.length);
  } else {
    this.index = this.index + 1;
  }

  if ('undefined' === typeof this.tracks[this.index]) {
    // if playlist is over, start from begin
    logger.info('Playlist is empty');
    this.index = 0;
  }
  
  var track = this.tracks[this.index];
  this._currentStreams[0] = track.play();
  this._currentStreams[1] = this._currentStreams[0].pipe(new lame.Decoder());
    
  logger.info('Playing ' + track.name + ' by ' + track.artist[0].name);
  
  this._currentStreams[1]
    .pipe(this.spkr)
    .on('finish', function () {
      if (that.imskipping) {
        that.imskipping = false;
      } else {
        process.nextTick(function () { that.next(); });
      }
    });

  return this;
};

