const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  movieId:    { type: Number, required: true },
  movieTitle: { type: String, required: true },
  posterPath: { type: String },
  rating:     { type: Number, min: 0.5, max: 5 },
  review:     { type: String, maxlength: 5000 },
  containsSpoilers: { type: Boolean, default: false },
  watchedOn:  { type: Date },
  likes:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text:      { type: String, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

reviewSchema.index({ movieId: 1 });
reviewSchema.index({ user: 1 });

module.exports = mongoose.model('Review', reviewSchema);