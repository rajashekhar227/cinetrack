const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Review = require('../models/Review');
const Activity = require('../models/Activity');
const { protect, optionalAuth } = require('../middleware/auth');

router.get('/search', async (req, res) => {
  try {
    const users = await User.find({ username: { $regex: req.query.q, $options: 'i' } })
      .select('username avatar bio stats').limit(10);
    res.json(users);
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.get('/:username', optionalAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password').populate('followers following', 'username avatar');
    if (!user) return res.status(404).json({message:'User not found'});
    res.json(user);
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.post('/:id/follow', protect, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) return res.status(400).json({message:"Can't follow yourself"});
    const target = await User.findById(req.params.id);
    const me = await User.findById(req.user._id);
    const isFollowing = me.following.includes(req.params.id);
    if (isFollowing) {
      me.following.pull(req.params.id);
      target.followers.pull(req.user._id);
    } else {
      me.following.push(req.params.id);
      target.followers.push(req.user._id);
      await Activity.create({ user: req.user._id, type: 'followed', targetUser: req.params.id });
    }
    await me.save(); await target.save();
    res.json({ following: !isFollowing, followerCount: target.followers.length });
  } catch(e){ res.status(500).json({message:e.message}); }
});

// Watchlist management
router.post('/watchlist/add', protect, async (req, res) => {
  try {
    const { movieId, movieTitle, posterPath } = req.body;
    const user = await User.findById(req.user._id);
    if (!user.watchlist.find(w => w.movieId === Number(movieId))) {
      user.watchlist.push({ movieId, movieTitle, posterPath });
      await user.save();
      await Activity.create({ user: req.user._id, type: 'watchlisted', movieId, movieTitle, posterPath });
    }
    res.json({ added: true });
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.delete('/watchlist/:movieId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.watchlist = user.watchlist.filter(w => w.movieId !== Number(req.params.movieId));
    await user.save();
    res.json({ removed: true });
  } catch(e){ res.status(500).json({message:e.message}); }
});

// Liked movies
router.post('/liked/add', protect, async (req, res) => {
  try {
    const { movieId, movieTitle, posterPath } = req.body;
    const user = await User.findById(req.user._id);
    const idx = user.liked.findIndex(l => l.movieId === Number(movieId));
    if (idx > -1) { user.liked.splice(idx, 1); await user.save(); return res.json({ liked: false }); }
    user.liked.push({ movieId, movieTitle, posterPath });
    await user.save();
    await Activity.create({ user: req.user._id, type: 'liked', movieId, movieTitle, posterPath });
    res.json({ liked: true });
  } catch(e){ res.status(500).json({message:e.message}); }
});

// Toggle watched
router.post('/watched/toggle', protect, async (req, res) => {
  try {
    const { movieId, movieTitle, posterPath, rating } = req.body;
    const user = await User.findById(req.user._id);
    const existingIdx = user.watched.findIndex(w => w.movieId === Number(movieId));
    
    // If rating is explicitly provided, it's an update/add (not an un-watch toggle)
    if (rating !== undefined) {
      if (existingIdx === -1) {
        user.watched.push({ movieId, movieTitle, posterPath, rating });
        user.stats.totalWatched++;
        await Activity.create({ user: req.user._id, type: 'watched', movieId, movieTitle, posterPath, rating });
      } else {
        user.watched[existingIdx].rating = rating;
      }
      await user.save();
      return res.json({ watched: true });
    }

    // Toggle logic (no rating provided)
    if (existingIdx > -1) {
      user.watched.splice(existingIdx, 1);
      user.stats.totalWatched = Math.max(0, user.stats.totalWatched - 1);
      await user.save();
      await Review.findOneAndDelete({ user: req.user._id, movieId: Number(movieId) });
      return res.json({ watched: false });
    } else {
      user.watched.push({ movieId, movieTitle, posterPath });
      user.stats.totalWatched++;
      await user.save();
      await Activity.create({ user: req.user._id, type: 'watched', movieId, movieTitle, posterPath });
      return res.json({ watched: true });
    }
  } catch(e){ res.status(500).json({message:e.message}); }
});

module.exports = router;