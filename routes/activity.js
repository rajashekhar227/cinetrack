const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// GET feed - activity from people you follow
router.get('/feed', protect, async (req, res) => {
  try {
    const me = await User.findById(req.user._id);
    const following = [...me.following, req.user._id];
    const activities = await Activity.find({ user: { $in: following } })
      .populate('user', 'username avatar')
      .populate('reviewId', 'review rating')
      .populate('listId', 'title')
      .populate('targetUser', 'username avatar')
      .sort({ createdAt: -1 }).limit(50);
    res.json(activities);
  } catch(e){ res.status(500).json({message:e.message}); }
});

// GET global activity
router.get('/global', async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate('user', 'username avatar')
      .populate('reviewId', 'review rating')
      .populate('listId', 'title')
      .sort({ createdAt: -1 }).limit(30);
    res.json(activities);
  } catch(e){ res.status(500).json({message:e.message}); }
});

// GET user's activity
router.get('/user/:userId', async (req, res) => {
  try {
    const activities = await Activity.find({ user: req.params.userId })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 }).limit(30);
    res.json(activities);
  } catch(e){ res.status(500).json({message:e.message}); }
});

module.exports = router;