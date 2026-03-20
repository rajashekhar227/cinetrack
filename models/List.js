const mongoose = require('mongoose');

const listSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  isPublic:    { type: Boolean, default: true },
  isRanked:    { type: Boolean, default: false },
  tags:        [{ type: String }],
  movies: [{
    movieId:    { type: Number },
    movieTitle: { type: String },
    posterPath: { type: String },
    note:       { type: String, maxlength: 300 },
    addedAt:    { type: Date, default: Date.now }
  }],
  likes:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  clones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('List', listSchema);