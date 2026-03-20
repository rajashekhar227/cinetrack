const express = require('express');
const router = express.Router();
const List = require('../models/List');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { protect, optionalAuth } = require('../middleware/auth');

router.get('/public', async (req, res) => {
  try {
    const lists = await List.find({ isPublic: true }).populate('user','username avatar').sort({ createdAt: -1 }).limit(20);
    res.json(lists);
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const filter = { user: req.params.userId };
    if (!req.user || req.user._id.toString() !== req.params.userId) filter.isPublic = true;
    const lists = await List.find(filter).populate('user','username avatar').sort({ createdAt: -1 });
    res.json(lists);
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const list = await List.findById(req.params.id).populate('user','username avatar bio');
    if (!list) return res.status(404).json({message:'List not found'});
    if (!list.isPublic && (!req.user || req.user._id.toString() !== list.user._id.toString()))
      return res.status(403).json({message:'Private list'});
    res.json(list);
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.post('/', protect, async (req, res) => {
  try {
    const { title, description, isPublic, isRanked, tags } = req.body;
    const list = await List.create({ user: req.user._id, title, description, isPublic, isRanked, tags });
    const user = await User.findById(req.user._id);
    user.stats.totalLists++;
    await user.save();
    res.status(201).json(list);
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list || list.user.toString() !== req.user._id.toString()) return res.status(403).json({message:'Not authorized'});
    Object.assign(list, req.body);
    await list.save();
    res.json(list);
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list || list.user.toString() !== req.user._id.toString()) return res.status(403).json({message:'Not authorized'});
    await list.deleteOne();
    res.json({message:'List deleted'});
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.post('/:id/movies', protect, async (req, res) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list || list.user.toString() !== req.user._id.toString()) return res.status(403).json({message:'Not authorized'});
    const { movieId, movieTitle, posterPath, note } = req.body;
    if (list.movies.find(m => m.movieId === movieId)) return res.status(400).json({message:'Movie already in list'});
    list.movies.push({ movieId, movieTitle, posterPath, note });
    await list.save();
    await Activity.create({ user: req.user._id, type: 'listed', movieId, movieTitle, posterPath, listId: list._id });
    res.json(list);
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.delete('/:id/movies/:movieId', protect, async (req, res) => {
  try {
    const list = await List.findById(req.params.id);
    if (!list || list.user.toString() !== req.user._id.toString()) return res.status(403).json({message:'Not authorized'});
    list.movies = list.movies.filter(m => m.movieId !== Number(req.params.movieId));
    await list.save();
    res.json(list);
  } catch(e){ res.status(500).json({message:e.message}); }
});

router.post('/:id/like', protect, async (req, res) => {
  try {
    const list = await List.findById(req.params.id);
    const idx = list.likes.indexOf(req.user._id);
    if (idx > -1) list.likes.splice(idx, 1);
    else list.likes.push(req.user._id);
    await list.save();
    res.json({ likes: list.likes.length });
  } catch(e){ res.status(500).json({message:e.message}); }
});

module.exports = router;