const express = require('express');
const router = express.Router();
const axios = require('axios');
const Review = require('../models/Review');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const KEY = process.env.TMDB_API_KEY;

const tmdb = async (path, params = {}) => {
  const res = await axios.get(`${TMDB_BASE}${path}`, {
    params: { api_key: KEY, ...params }
  });
  
  const data = res.data;
  
  // Recursively find all movie nodes in the TMDB payload
  const movieMap = new Map();
  const scan = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (obj.vote_average !== undefined && obj.id) {
      movieMap.set(String(obj.id), obj);
    }
    Object.values(obj).forEach(scan);
  };
  scan(data);

  const movies = Array.from(movieMap.values());
  if (movies.length > 0) {
    try {
      const movieIds = movies.map(m => String(m.id));
      const aggregations = await Review.aggregate([
        { $match: { movieId: { $in: movieIds }, rating: { $exists: true, $gt: 0 } } },
        { $group: { _id: "$movieId", sum: { $sum: "$rating" }, count: { $sum: 1 } } }
      ]);
      const localStats = {};
      aggregations.forEach(a => localStats[String(a._id)] = a);

      movies.forEach(m => {
        const stat = localStats[String(m.id)];
        if (stat) {
          const tmdbScore5 = (m.vote_average || 0) / 2;
          const TMDB_WEIGHT = 100000;
          const combinedScore5 = ((tmdbScore5 * TMDB_WEIGHT) + stat.sum) / (TMDB_WEIGHT + stat.count);
          m.vote_average = combinedScore5 * 2; // Inflate back to 10 for standard
        }
      });
    } catch(err) {
      console.error('Failed to blend local ratings:', err);
    }
  }

  return data;
};

router.get('/trending',        async (req, res) => { try { res.json(await tmdb('/trending/movie/week', { page: req.query.page||1 })); } catch(e){ res.status(500).json({message:e.message}); }});
router.get('/popular',         async (req, res) => { try { res.json(await tmdb('/movie/popular', { page: req.query.page||1 })); } catch(e){ res.status(500).json({message:e.message}); }});
router.get('/top-rated',       async (req, res) => { try { res.json(await tmdb('/movie/top_rated', { page: req.query.page||1 })); } catch(e){ res.status(500).json({message:e.message}); }});
router.get('/now-playing',     async (req, res) => { try { res.json(await tmdb('/movie/now_playing', { page: req.query.page||1 })); } catch(e){ res.status(500).json({message:e.message}); }});
router.get('/upcoming',        async (req, res) => { try { res.json(await tmdb('/movie/upcoming', { page: req.query.page||1 })); } catch(e){ res.status(500).json({message:e.message}); }});
router.get('/search',          async (req, res) => { try { res.json(await tmdb('/search/multi', { query: req.query.q, page: req.query.page||1 })); } catch(e){ res.status(500).json({message:e.message}); }});
router.get('/genres',          async (req, res) => { try { res.json(await tmdb('/genre/movie/list')); } catch(e){ res.status(500).json({message:e.message}); }});
router.get('/by-genre/:id',    async (req, res) => { try { res.json(await tmdb('/discover/movie', { with_genres: req.params.id, sort_by: 'popularity.desc', page: req.query.page||1 })); } catch(e){ res.status(500).json({message:e.message}); }});
router.get('/:id',             async (req, res) => { try { res.json(await tmdb(`/movie/${req.params.id}`, { append_to_response: 'credits,videos,similar,recommendations,images' })); } catch(e){ res.status(500).json({message:e.message}); }});
router.get('/:id/credits',     async (req, res) => { try { res.json(await tmdb(`/movie/${req.params.id}/credits`)); } catch(e){ res.status(500).json({message:e.message}); }});
router.get('/:id/similar',     async (req, res) => { try { res.json(await tmdb(`/movie/${req.params.id}/similar`)); } catch(e){ res.status(500).json({message:e.message}); }});
router.get('/person/:id',      async (req, res) => { try { res.json(await tmdb(`/person/${req.params.id}`, { append_to_response: 'movie_credits' })); } catch(e){ res.status(500).json({message:e.message}); }});

module.exports = router;