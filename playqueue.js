/*jshint node:true, laxcomma:true, unused:true, undef:true, indent:2 */

'use strict';

var lame = require('lame')
  , Speaker = require('speaker')
  , EventEmitter = require('events').EventEmitter
  , nodeutils = require('util')
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


PlayQueue.prototype.setRandom = function(random) {
  this.random = random;
};

PlayQueue.prototype.add = function(track) {

  this.tracks.push(track);
  console.log('[QQ] Queued track "%s" by "%s"', track.name, track.artist[0].name);
  
  if (this.playing === false) {
    this.next();
  }
  
  return this;
};


PlayQueue.prototype._clearStreams = function() {
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


PlayQueue.prototype.next = function() {
  var that = this;

  if (this.tracks.length === 0) {
    console.log('queue empty');
    return this;
  }
  
  if (this.playing) {
    console.log('clearing streams ...');
    this._clearStreams();
    if ('undefined' === typeof this.spkr) {
      console.log('created speaker');
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
    console.log('Playlist is empty');
    this.index = 0;
  }
  
  
  var track = this.tracks[this.index];

  
  this._currentStreams[0] = track.play();
  this._currentStreams[1] = this._currentStreams[0].pipe(new lame.Decoder());
    
  console.log('Playing "%s" by "%s"', track.name, track.artist[0].name);
  
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

