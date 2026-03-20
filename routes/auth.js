const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { OAuth2Client } = require('google-auth-library');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads/avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    cb(null, req.user._id + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// POST /api/auth/avatar
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const user = await User.findById(req.user._id);
    user.avatar = '/uploads/avatars/' + req.file.filename;
    await user.save();
    
    res.json({ token: generateToken(user._id), user: { ...user.toObject(), password:'' } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: 'All fields required' });
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(400).json({ message: 'User already exists' });
    const user = await User.create({ username, email, password });
    res.status(201).json({
      _id: user._id, username: user.username, email: user.email,
      avatar: user.avatar, token: generateToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    res.json({
      _id: user._id, username: user.username, email: user.email,
      avatar: user.avatar, bio: user.bio, token: generateToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password').populate('followers following', 'username avatar');
  res.json(user);
});

// PUT /api/auth/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { bio, location, website, avatar, favoriteGenres } = req.body;
    const user = await User.findById(req.user._id);
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;
    if (avatar !== undefined) user.avatar = avatar;
    if (favoriteGenres !== undefined) user.favoriteGenres = favoriteGenres;
    await user.save();
    res.json({ _id: user._id, username: user.username, email: user.email, bio: user.bio, avatar: user.avatar, location: user.location });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/google-client-id
router.get('/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'Missing credential' });
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).json({ message: 'Google Client ID not configured on server' });

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;
    
    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      // Create user
      const usernameBase = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      let username = usernameBase;
      let count = 1;
      while (await User.findOne({ username })) {
        username = `${usernameBase}${count}`;
        count++;
      }
      
      const randomPassword = require('crypto').randomBytes(16).toString('hex');
      
      user = await User.create({
        username,
        email,
        password: randomPassword,
        avatar: picture,
      });
    }
    
    res.json({
      _id: user._id, username: user.username, email: user.email,
      avatar: user.avatar, bio: user.bio, token: generateToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;