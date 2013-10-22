/*jshint node:true, laxcomma:true, unused:true, undef:true, indent:2 */

'use strict';

var lame = require('lame')
  , Speaker = require('speaker')
  , EventEmitter = require('events').EventEmitter
  , nodeutils = require('util')
  ;

module.exports.PlayQueue = PlayQueue;

function PlayQueue() {
  //this.spkr = new Speaker();
  this.tracks = [];
  this.index = -1;
  this.playing = false;
  this._currentStreams = [null, null]; // play, decoded
}
nodeutils.inherits(PlayQueue, EventEmitter);

PlayQueue.prototype.add = function(track) {

  if ('undefined' === typeof this.spkr) {
    this.spkr = new Speaker();
  }

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
};

PlayQueue.prototype.next = function() {
  var that = this;
  
  if (this.playing) {
    this._clearStreams();
  }
  
  if ('undefined' === typeof this.tracks[this.index + 1]) {
    console.log('Playlist is empty');
    this.spkr.end();
    this.spkr = undefined;
    return this;
  }
  
  this.playing = true;
  this.index = this.index + 1;
  
  var track = this.tracks[this.index];

  
  this._currentStreams[0] = track.play();
  this._currentStreams[1] = this._currentStreams[0].pipe(new lame.Decoder());
    
  console.log('Playing "%s" by "%s"', track.name, track.artist[0].name);
  
  this._currentStreams[1]
    .pipe(this.spkr)
    .on('finish', function () {
      if (that.index < that.tracks.length - 1) {
        that.emit('next');
        that._currentStream = null;
        process.nextTick(function () { that.next(); });
      } else {
        that._currentStream = null;
        that.playing = false;
        that.emit('finish'); // all tracks have been played
      }
    });
    
  return this;
};

