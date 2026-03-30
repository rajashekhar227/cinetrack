const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { OAuth2Client } = require('google-auth-library');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Nodemailer setup
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

// Fallback for development if no credentials provided
const sendVerificationEmail = async (email, otp) => {
  console.log(`✉️ Sending verification logic for: ${email}`);
  console.log(`🔑 OTP generated: ${otp}`);
  
  const mailOptions = {
    from: `"CineTrack" <${process.env.EMAIL_USER || 'noreply@cinetrack.com'}>`,
    to: email,
    subject: 'Your CineTrack Verification Code',
    text: `Your verification code is: ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #f5a623; text-align: center;">CINETRACK</h2>
        <p>Hello,</p>
        <p>Thank you for joining CineTrack! Please use the following code to verify your email address:</p>
        <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e1e2a; border-radius: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #888; text-align: center;">&copy; 2024 CineTrack. All rights reserved.</p>
      </div>
    `
  };

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      await transporter.sendMail(mailOptions);
    } catch (err) {
      console.error("❌ Email failed to send, but OTP logged above:", err.message);
    }
  } else {
    // Ethereal fallback
    console.log("---------------------------------------");
    console.log("TEST EMAIL SENT (No credentials in .env)");
    console.log("OTP:", otp);
    console.log("Preview URL is being generated (takes a second)...");
    const testAccount = await nodemailer.createTestAccount();
    const testTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    const info = await testTransporter.sendMail(mailOptions);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    console.log("---------------------------------------");
  }
};

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
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return res.status(400).json({ message: 'Please use an official Google Mail (@gmail.com) address' });
    }
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(400).json({ message: 'User already exists' });
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const user = await User.create({ 
      username, 
      email, 
      password,
      isVerified: false,
      verificationCode: otp,
      verificationExpires: otpExpires
    });

    sendVerificationEmail(email, otp); // Don't await, send in background

    res.status(201).json({
      message: 'Verification code sent to email',
      email: user.email,
      unverified: true
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ 
      email, 
      verificationCode: code,
      verificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.json({
      _id: user._id, username: user.username, email: user.email,
      avatar: user.avatar, token: generateToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/resend
router.post('/resend', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email, isVerified: false });
    if (!user) return res.status(404).json({ message: 'User not found or already verified' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = otp;
    user.verificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    sendVerificationEmail(email, otp); // Don't await, send in background
    res.json({ message: 'New verification code sent' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return res.status(400).json({ message: 'Please login using your official Google Mail (@gmail.com)' });
    }
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });
    
    if (!user.isVerified) {
      return res.status(403).json({ 
        message: 'Account not verified. Please verify your email.',
        unverified: true,
        email: user.email
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
        isVerified: true // Google accounts are pre-verified
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