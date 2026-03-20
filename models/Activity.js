const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:       { type: String, enum: ['watched','reviewed','liked','listed','followed','watchlisted','recommended'], required: true },
  movieId:    { type: Number },
  movieTitle: { type: String },
  posterPath: { type: String },
  rating:     { type: Number },
  reviewId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Review' },
  listId:     { type: mongoose.Schema.Types.ObjectId, ref: 'List' },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

activitySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);