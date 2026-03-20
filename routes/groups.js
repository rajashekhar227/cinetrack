const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Group = require('../models/Group');
const GroupPost = require('../models/GroupPost');
const { protect } = require('../middleware/auth');

// Create group
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name is required' });

    let joinCode = crypto.randomBytes(4).toString('hex'); // 8 chars
    while (await Group.findOne({ joinCode })) {
      joinCode = crypto.randomBytes(4).toString('hex');
    }
    const group = await Group.create({
      name, description, isPrivate, joinCode,
      creator: req.user._id,
      members: [req.user._id]
    });
    res.status(201).json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// List groups
router.get('/', protect, async (req, res) => {
  try {
    const myGroups = await Group.find({ members: req.user._id }).populate('creator members', 'username avatar');
    const publicGroups = await Group.find({ isPrivate: false, members: { $ne: req.user._id } }).populate('creator members', 'username avatar');
    res.json({ myGroups, publicGroups });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get popular groups
router.get('/popular/all', async (req, res) => {
  try {
    const groups = await Group.find({ isPrivate: false }).populate('creator members', 'username avatar');
    groups.sort((a, b) => b.members.length - a.members.length);
    res.json(groups.slice(0, 20));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get group detail
router.get('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('creator members', 'username avatar');
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    const isMember = group.members.some(m => m._id.toString() === req.user._id.toString());
    if (group.isPrivate && !isMember) {
      return res.status(403).json({ message: 'Access denied. Private group.' });
    }

    const posts = await GroupPost.find({ group: group._id }).populate('user', 'username avatar').sort({ createdAt: -1 });
    res.json({ group, posts, isMember });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Join group
router.post('/join', protect, async (req, res) => {
  try {
    const { groupId, joinCode } = req.body;
    let group;
    if (joinCode) {
      group = await Group.findOne({ joinCode });
    } else if (groupId) {
      group = await Group.findById(groupId);
    }

    if (!group) return res.status(404).json({ message: 'Group or invite link not found' });
    
    // Only require joinCode if private, but if the user provides a valid joinCode, it bypasses the private check
    if (group.isPrivate && !joinCode) {
      return res.status(403).json({ message: 'Private group requires an invite link' });
    }

    if (!group.members.includes(req.user._id)) {
      group.members.push(req.user._id);
      await group.save();
    }
    res.json(group);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Post to group
router.post('/:id/posts', protect, async (req, res) => {
  try {
    const { content, movieId, movieTitle, posterPath } = req.body;
    if (!content && !movieId) return res.status(400).json({ message: 'Content or movie is required' });

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Must be a member to post' });
    }
    
    const finalContent = content || 'Shared a movie';
    
    const post = await GroupPost.create({ group: group._id, user: req.user._id, content: finalContent, movieId, movieTitle, posterPath });
    await post.populate('user', 'username avatar');
    res.status(201).json(post);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Delete a group
router.delete('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    if (group.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group admin can delete this group' });
    }
    
    await GroupPost.deleteMany({ group: group._id });
    await Group.findByIdAndDelete(group._id);
    
    res.json({ message: 'Group deleted successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
