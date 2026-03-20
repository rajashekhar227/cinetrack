const mongoose = require('mongoose');

const groupPostSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  movieId: { type: Number },
  movieTitle: { type: String },
  posterPath: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('GroupPost', groupPostSchema);
