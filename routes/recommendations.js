const express = require('express');
const router = express.Router();
const Recommendation = require('../models/Recommendation');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');

// GET smart recommendations based on TMDB Item-Item matching seeded by user watched/liked
router.get('/smart', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    const watchedIds = new Set(currentUser.watched.map(w => String(w.movieId)));
    const likedIds = new Set(currentUser.liked.map(l => String(l.movieId)));

    // ==========================================
    // KNN User-Based Collaborative Filtering Algorithm
    // ==========================================
    if (watchedIds.size > 0 || likedIds.size > 0) {
      // Find all other users in the platform
      const allUsers = await User.find({ _id: { $ne: currentUser._id } }).select('watched liked');
      
      const neighbors = [];

      for (const other of allUsers) {
        let similarity = 0;
        const otherWatchedIds = new Set(other.watched.map(w => String(w.movieId)));
        const otherLikedIds = new Set(other.liked.map(l => String(l.movieId)));

        // Calculate similarity score based on overlaps
        for (const movieId of likedIds) {
          if (otherLikedIds.has(movieId)) similarity += 3;
          else if (otherWatchedIds.has(movieId)) similarity += 1.5;
        }

        for (const movieId of watchedIds) {
          if (!likedIds.has(movieId)) {
            if (otherLikedIds.has(movieId)) similarity += 1.5;
            else if (otherWatchedIds.has(movieId)) similarity += 1;
          }
        }

        if (similarity > 0) {
          neighbors.push({ user: other, similarity });
        }
      }

      // Sort neighbors by similarity descending
      neighbors.sort((a, b) => b.similarity - a.similarity);

      // Select top K neighbors (K=10)
      const topKNeighbors = neighbors.slice(0, 10);

      // Aggregate movies from Top K neighbors that current user HAS NOT watched
      const knnCandidates = new Map();

      topKNeighbors.forEach(neighbor => {
        neighbor.user.watched.forEach(m => {
          const mIdStr = String(m.movieId);
          if (!watchedIds.has(mIdStr)) {
            const currentObj = knnCandidates.get(mIdStr) || {
              id: m.movieId,
              title: m.movieTitle,
              poster_path: m.posterPath,
              knnScore: 0
            };
            // Weight rating out of 5, fallback 0.6 if undefined
            const ratingWeight = m.rating ? m.rating / 5 : 0.6;
            currentObj.knnScore += neighbor.similarity * ratingWeight;
            knnCandidates.set(mIdStr, currentObj);
          }
        });

        neighbor.user.liked.forEach(m => {
          const mIdStr = String(m.movieId);
          if (!watchedIds.has(mIdStr)) {
            const currentObj = knnCandidates.get(mIdStr) || {
              id: m.movieId,
              title: m.movieTitle,
              poster_path: m.posterPath,
              knnScore: 0
            };
            // Likes are stronger signals, weight=1.0
            currentObj.knnScore += neighbor.similarity * 1.0;
            knnCandidates.set(mIdStr, currentObj);
          }
        });
      });

      // Sort KNN candidates
      const sortedKnn = Array.from(knnCandidates.values()).sort((a, b) => b.knnScore - a.knnScore);

      // If we found a solid amount of community recommendations, return them immediately
      // This bypasses the slow TMDB API calls completely
      if (sortedKnn.length >= 10) {
        return res.json({
          results: sortedKnn.slice(0, 50),
          genres: currentUser.favoriteGenres,
          message: 'KNN Collaborative Filtering (Community Recommendations)'
        });
      }
    }

    // ==========================================
    // FALLBACK: TMDB Item-Item matching (If KNN failed due to low community overlap)
    // ==========================================
    const seeds = [];

    // Add liked movies (high weight = 2.0)
    currentUser.liked.slice(-10).forEach(m => {
      seeds.push({ id: m.movieId, weight: 2.0 });
    });

    // Add highly rated watched movies (medium weight)
    currentUser.watched.slice(-15).forEach(m => {
      if (!likedIds.has(String(m.movieId))) {
        let w = 1.0;
        if (m.rating >= 4) w = 1.5;
        else if (m.rating && m.rating <= 2) w = 0.0; // Don't seed bad movies

        if (w > 0) seeds.push({ id: m.movieId, weight: w });
      }
    });

    if (seeds.length === 0) {
      if (currentUser.favoriteGenres && currentUser.favoriteGenres.length > 0) {
        return res.json({ results: [], genres: currentUser.favoriteGenres, message: 'Fallback to genres' });
      }
      return res.json({ results: [], genres: [], message: 'No data' });
    }

    // Limit to max 15 seeds to optimize API latency
    const topSeeds = seeds.sort(() => 0.5 - Math.random()).slice(0, 15);

    const axios = require('axios');
    const TMDB_BASE = 'https://api.themoviedb.org/3';
    const TMDB_KEY = process.env.TMDB_API_KEY;

    // ALGORITHM PHASE 1: Build the Custom Taste Profile
    const prefCountries = new Set();
    const prefLanguage = new Set();
    const prefGenres = new Set();
    const prefKeywords = new Set();
    const prefCast = new Set();
    const prefCrew = new Set();
    const plotWordsMap = {};

    const stopWords = new Set(['the', 'and', 'to', 'of', 'in', 'is', 'for', 'with', 'on', 'that', 'this', 'an', 'as', 'it', 'by', 'from', 'are', 'at', 'was', 'his', 'her', 'he', 'she', 'they']);
    function extractWords(text) {
      if (!text) return [];
      return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
    }

    const userProfileSeeds = topSeeds.slice(0, 5);
    await Promise.all(userProfileSeeds.map(async (seed) => {
      try {
        const res = await axios.get(`${TMDB_BASE}/movie/${seed.id}?append_to_response=credits,keywords&api_key=${TMDB_KEY}`);
        const s = res.data;
        s.production_countries?.forEach(c => prefCountries.add(c.iso_3166_1));
        if (s.original_language) prefLanguage.add(s.original_language);
        s.genres?.forEach(g => prefGenres.add(g.id));
        s.keywords?.keywords?.forEach(k => prefKeywords.add(k.id));
        s.credits?.cast?.slice(0, 5).forEach(c => prefCast.add(c.id));
        s.credits?.crew?.filter(c => c.job === 'Director' || c.job === 'Writer').forEach(c => prefCrew.add(c.id));
        extractWords(s.overview).forEach(w => plotWordsMap[w] = (plotWordsMap[w] || 0) + 1);
      } catch (err) { }
    }));

    const topPlotWords = new Set(Object.keys(plotWordsMap).sort((a, b) => plotWordsMap[b] - plotWordsMap[a]).slice(0, 30));

    const topCastIds = Array.from(prefCast).slice(0, 3).join('|');
    const topCrewIds = Array.from(prefCrew).slice(0, 3).join('|');

    const rawCandidates = new Map();

    const fetchPool = async (url, sourceWeight) => {
      try {
        const res = await axios.get(url);
        (res.data.results || []).forEach(m => {
          if (watchedIds.has(String(m.id))) return;
          if (!rawCandidates.has(m.id)) {
            m.customScore = 0;
            rawCandidates.set(m.id, m);
          }
          rawCandidates.get(m.id).customScore += sourceWeight;
        });
      } catch (e) { }
    };

    const simPromises = topSeeds.slice(0, 3).map(seed => fetchPool(`${TMDB_BASE}/movie/${seed.id}/similar?api_key=${TMDB_KEY}`, 2));
    const recPromises = topSeeds.slice(0, 3).map(seed => fetchPool(`${TMDB_BASE}/movie/${seed.id}/recommendations?api_key=${TMDB_KEY}`, 3));

    // Push the heavy cast/crew into the array at blazing fast O(1) time via native discover queries
    if (topCastIds) simPromises.push(fetchPool(`${TMDB_BASE}/discover/movie?with_cast=${topCastIds}&api_key=${TMDB_KEY}`, 15));
    if (topCrewIds) simPromises.push(fetchPool(`${TMDB_BASE}/discover/movie?with_crew=${topCrewIds}&api_key=${TMDB_KEY}`, 15));

    await Promise.all([...simPromises, ...recPromises]);

    // ALGORITHM PHASE 3: Detail Extraction and Custom Mathematical Constraint Scoring natively
    const scoredCandidates = Array.from(rawCandidates.values());

    scoredCandidates.forEach(c => {
      let score = c.customScore || 0;

      // constraint 1: Country & Language (Extreme +50 / +30 weight per match) natively inferred without append
      const countries = c.origin_country || [];
      countries.forEach(cty => { if (prefCountries.has(cty)) score += 50; });
      if (c.original_language && prefLanguage.has(c.original_language)) score += 30;

      // constraint 2: Plot (High +5 NLP semantic matrix weighting over core description string)
      const cWords = extractWords(c.overview);
      cWords.forEach(w => { if (topPlotWords.has(w)) score += 5; });

      // constraint 3: Genre Context (Medium +15 weight) natively mapped linearly via object ids
      c.genre_ids?.forEach(g => { if (prefGenres.has(g)) score += 15; });

      // constraint 5: Baseline General Popularity Tiebreaker (< 10 weight)
      score += (c.vote_average || 0);
      score += Math.min(c.popularity || 0, 50) / 10;

      c.customScore = score;
    });

    scoredCandidates.sort((a, b) => b.customScore - a.customScore);

    res.json({
      results: scoredCandidates.slice(0, 100),
      genres: currentUser.favoriteGenres,
      message: 'Custom Cinetrack Matrix System (Country > Plot > Genre > Credits)'
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET my received recommendations
router.get('/inbox', protect, async (req, res) => {
  try {
    const recs = await Recommendation.find({ toUser: req.user._id })
      .populate('fromUser', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(recs);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST send recommendation to a friend
router.post('/send', protect, async (req, res) => {
  try {
    const { toUserId, movieId, movieTitle, posterPath, message } = req.body;
    const rec = await Recommendation.create({ fromUser: req.user._id, toUser: toUserId, movieId, movieTitle, posterPath, message });
    await Activity.create({ user: req.user._id, type: 'recommended', movieId, movieTitle, posterPath, targetUser: toUserId });
    res.status(201).json(rec);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PATCH mark as read
router.patch('/:id/read', protect, async (req, res) => {
  try {
    await Recommendation.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ updated: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;