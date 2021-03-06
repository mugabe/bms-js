
// Public: This module exposes the {Notes} class.

var Note = require('./note')
var invariant = require('invariant')

module.exports = Notes

Notes.CHANNEL_MAPPING = require('./channels')

// Public: A Notes holds the {Note} objects in the game.
// A note object may or may not be playable.
//
// ## Example
//
// If you have a BMS like this:
//
// ```
// #00111:AA
// ```
//
// Having parsed it using a {Compiler} into a {BMSChart},
// you can create a {Notes} using `fromBMSChart()`:
//
// ```js
// var notes = Notes.fromBMSChart(bmsChart)
// ```
//
// Then you can get all notes using `.all()` method
//
// ```js
// notes.all()
// ```
//
/* class Notes */

// Public: Constructs a Notes object.
//
// * `notes` {Array} containing the {Note} objects
//
function Notes (notes) {
  notes.forEach(Note.validate)
  this._notes = notes
}

// Public: Returns the number of notes in this object, counting both playable
// and non-playable notes.
//
// Returns a {Number} representing the note count
//
Notes.prototype.count = function () {
  return this._notes.length
}

// Public: Returns an Array of all notes.
//
// Returns an {Array} of all notes
//
Notes.prototype.all = function () {
  return this._notes.slice()
}

// Public: Creates a Notes object from a BMSChart.
//
// * `chart` {BMSChart} to process
// * `options` {Object} representing the processing options
//   * `mapping` (optional) {Object} representing the mapping from BMS channel
//     to game channel. Default value is the IIDX_P1 mapping.
//
Notes.fromBMSChart = function (chart, options) {
  options = options || { }
  var mapping = options.mapping || Notes.CHANNEL_MAPPING.IIDX_P1
  var builder = new BMSNoteBuilder(chart, { mapping: mapping })
  return builder.build()
}

function BMSNoteBuilder (chart, options) {
  this._chart = chart
  invariant(options.mapping, 'Expected options.mapping')
  invariant(typeof options.mapping === 'object', 'options.mapping must be object')
  this._mapping = options.mapping
}

BMSNoteBuilder.prototype.build = function () {
  this._notes = []
  this._activeLN = { }
  this._lastNote = { }
  this._lnObj = (this._chart.headers.get('lnobj') || '').toLowerCase()
  this._channelMapping = this._mapping
  this._objects = this._chart.objects.allSorted()
  this._objects.forEach(function (object) {
    this._handle(object)
  }.bind(this))
  return new Notes(this._notes)
}

BMSNoteBuilder.prototype._handle = function (object) {
  if (object.channel === '01') {
    this._handleNormalNote(object)
  } else {
    switch (object.channel.charAt(0)) {
    case '1': case '2':
      this._handleNormalNote(object)
      break
    case '5': case '6':
      this._handleLongNote(object)
      break
    }
  }
}

BMSNoteBuilder.prototype._handleNormalNote = function (object) {
  var channel = this._normalizeChannel(object.channel)
  var beat = this._getBeat(object)
  if (object.value.toLowerCase() === this._lnObj) {
    if (this._lastNote[channel]) {
      this._lastNote[channel].endBeat = beat
    }
  } else {
    var note = {
      beat: beat,
      endBeat: undefined,
      keysound: object.value,
      column: this._getColumn(channel),
    }
    this._lastNote[channel] = note
    this._notes.push(note)
  }
}

BMSNoteBuilder.prototype._handleLongNote = function (object) {
  var channel = this._normalizeChannel(object.channel)
  var beat = this._getBeat(object)
  if (this._activeLN[channel]) {
    var note = this._activeLN[channel]
    note.endBeat = beat
    this._notes.push(note)
    ;delete this._activeLN[channel]
  } else {
    this._activeLN[channel] = {
      beat: beat,
      keysound: object.value,
      column: this._getColumn(channel),
    }
  }
}

BMSNoteBuilder.prototype._getBeat = function (object) {
  return this._chart.measureToBeat(object.measure, object.fraction)
}

BMSNoteBuilder.prototype._getColumn = function (channel) {
  return this._channelMapping[channel]
}

BMSNoteBuilder.prototype._normalizeChannel = function (channel) {
  return channel.replace(/^5/, '1').replace(/^6/, '2')
}
