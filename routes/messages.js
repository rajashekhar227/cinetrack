const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Get list of friends (followers + following)
router.get('/friends', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('followers following', 'username avatar stats');
    const friendMap = new Map();
    if (user.followers) user.followers.forEach(f => friendMap.set(f._id.toString(), f));
    if (user.following) user.following.forEach(f => friendMap.set(f._id.toString(), f));
    res.json(Array.from(friendMap.values()));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get chat history with a specific user
router.get('/:userId', protect, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id }
      ]
    }).populate('sender receiver', 'username avatar').sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Send a message
router.post('/', protect, async (req, res) => {
  try {
    const { receiverId, content, movieId, movieTitle, posterPath } = req.body;
    if (!receiverId || (!content && !movieId)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Security Check: Basic Follower/Following Requirement
    const sender = await User.findById(req.user._id);
    if (!sender.following.includes(receiverId) && !sender.followers.includes(receiverId)) {
      return res.status(403).json({ message: 'You can only message followers or people you follow.' });
    }

    const message = await Message.create({
      sender: req.user._id, receiver: receiverId, content: content || 'Shared a movie', movieId, movieTitle, posterPath
    });
    await message.populate('sender receiver', 'username avatar');
    res.status(201).json(message);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
