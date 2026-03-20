const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { protect, optionalAuth } = require('../middleware/auth');

// GET reviews for a movie
router.get('/movie/:movieId', optionalAuth, async (req, res) => {
  try {
    const reviews = await Review.find({ movieId: req.params.movieId })
      .populate('user', 'username avatar')
      .populate('comments.user', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch(e){ res.status(500).json({message:e.message}); }
});

// POST create/update review
router.post('/', protect, async (req, res) => {
  try {
    const { movieId, movieTitle, posterPath, rating, review, containsSpoilers, watchedOn } = req.body;
    let existing = await Review.findOne({ user: req.user._id, movieId });
    if (existing) {
      existing.rating = rating; existing.review = review;
      existing.containsSpoilers = containsSpoilers; existing.watchedOn = watchedOn;
      await existing.save();
      return res.json(existing);
    }
    const newReview = await Review.create({ user: req.user._id, movieId, movieTitle, posterPath, rating, review, containsSpoilers, watchedOn });
    // Add to watched
    const user = await User.findById(req.user._id);
    const alreadyWatched = user.watched.find(w => w.movieId === Number(movieId));
    if (!alreadyWatched) {
      user.watched.push({ movieId, movieTitle, posterPath, rating });
      user.stats.totalWatched++;
    }
    user.stats.totalReviews++;
    await user.save();
    await Activity.create({ user: req.user._id, type: 'reviewed', movieId, movieTitle, posterPath, rating, reviewId: newReview._id });
    res.status(201).json(newReview);
  } catch(e){ res.status(500).json({message:e.message}); }
});

// DELETE review
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({message:'Review not found'});
    if (review.user.toString() !== req.user._id.toString()) return res.status(403).json({message:'Not authorized'});
    await review.deleteOne();
    res.json({message:'Review deleted'});
  } catch(e){ res.status(500).json({message:e.message}); }
});

// POST like a review
router.post('/:id/like', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    const idx = review.likes.indexOf(req.user._id);
    if (idx > -1) review.likes.splice(idx, 1);
    else review.likes.push(req.user._id);
    await review.save();
    res.json({ likes: review.likes.length, liked: idx === -1 });
  } catch(e){ res.status(500).json({message:e.message}); }
});

// POST comment on review
router.post('/:id/comment', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    review.comments.push({ user: req.user._id, text: req.body.text });
    await review.save();
    await review.populate('comments.user', 'username avatar');
    res.json(review.comments[review.comments.length - 1]);
  } catch(e){ res.status(500).json({message:e.message}); }
});

// GET user's reviews
router.get('/user/:userId', async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.params.userId })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch(e){ res.status(500).json({message:e.message}); }
});

module.exports = router;