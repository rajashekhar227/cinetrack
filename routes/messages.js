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
    user.followers.forEach(f => friendMap.set(f._id.toString(), f));
    user.following.forEach(f => friendMap.set(f._id.toString(), f));
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
    const message = await Message.create({
      sender: req.user._id, receiver: receiverId, content: content || 'Shared a movie', movieId, movieTitle, posterPath
    });
    await message.populate('sender receiver', 'username avatar');
    res.status(201).json(message);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
