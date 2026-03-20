const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  movieId: { type: Number },
  movieTitle: { type: String },
  posterPath: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
