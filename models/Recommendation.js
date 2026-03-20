const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
  fromUser:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUser:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  movieId:    { type: Number, required: true },
  movieTitle: { type: String, required: true },
  posterPath: { type: String },
  message:    { type: String, maxlength: 500 },
  isRead:     { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Recommendation', recommendationSchema);