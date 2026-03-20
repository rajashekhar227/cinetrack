const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3 },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  avatar:   { type: String, default: '' },
  bio:      { type: String, default: '', maxlength: 300 },
  location: { type: String, default: '' },
  website:  { type: String, default: '' },
  favoriteGenres: [{ type: String }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  watchlist: [{
    movieId:   { type: Number },
    movieTitle:{ type: String },
    posterPath:{ type: String },
    addedAt:   { type: Date, default: Date.now }
  }],
  watched: [{
    movieId:    { type: Number },
    movieTitle: { type: String },
    posterPath: { type: String },
    watchedAt:  { type: Date, default: Date.now },
    rating:     { type: Number, min: 0.5, max: 5 }
  }],
  liked: [{
    movieId:    { type: Number },
    movieTitle: { type: String },
    posterPath: { type: String }
  }],
  stats: {
    totalWatched: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    totalLists:   { type: Number, default: 0 }
  }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidate) {
  return await bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);