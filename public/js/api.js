/* ============================================
   CineTrack - API Helper + Auth State
   public/js/api.js
   ============================================ */

const API_BASE = '/api';
const IMG_BASE = 'https://image.tmdb.org/t/p/';

// ── Image URL helpers ──
const img = {
  poster: (path, size='w342') => path ? `${IMG_BASE}${size}${path}` : null,
  backdrop: (path, size='w1280') => path ? `${IMG_BASE}${size}${path}` : null,
  profile: (path, size='w185') => path ? `${IMG_BASE}${size}${path}` : null,
};

// ── Auth State ──
const Auth = {
  getToken: () => localStorage.getItem('ct_token'),
  getUser:  () => { const u = localStorage.getItem('ct_user'); return u ? JSON.parse(u) : null; },
  setAuth:  (data) => {
    localStorage.setItem('ct_token', data.token);
    localStorage.setItem('ct_user', JSON.stringify({ _id: data._id, username: data.username, email: data.email, avatar: data.avatar }));
    window.dispatchEvent(new Event('auth-change'));
  },
  logout: () => {
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_user');
    window.dispatchEvent(new Event('auth-change'));
    window.location.href = '/';
  },
  isLoggedIn: () => !!localStorage.getItem('ct_token'),
};

// ── Fetch Wrapper ──
async function request(method, url, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

const api = {
  get:    (url)        => request('GET',    url),
  post:   (url, body)  => request('POST',   url, body),
  put:    (url, body)  => request('PUT',    url, body),
  patch:  (url, body)  => request('PATCH',  url, body),
  delete: (url)        => request('DELETE', url),

  // Auth
  auth: {
    register: (d) => api.post('/auth/register', d),
    login:    (d) => api.post('/auth/login', d),
    me:       ()  => api.get('/auth/me'),
    updateProfile: (d) => api.put('/auth/profile', d),
    googleClientId: () => api.get('/auth/google-client-id'),
    google:   (d) => api.post('/auth/google', d),
    verify:   (d) => api.post('/auth/verify', d),
    resend:   (d) => api.post('/auth/resend', d),
    forgotPassword: (d) => api.post('/auth/forgot-password', d),
    resetPassword: (d) => api.post('/auth/reset-password', d),
  },

  // Movies (TMDB proxy)
  movies: {
    trending:   (page=1) => api.get(`/movies/trending?page=${page}`),
    popular:    (page=1) => api.get(`/movies/popular?page=${page}`),
    topRated:   (page=1) => api.get(`/movies/top-rated?page=${page}`),
    nowPlaying: (page=1) => api.get(`/movies/now-playing?page=${page}`),
    upcoming:   (page=1) => api.get(`/movies/upcoming?page=${page}`),
    search:     (q, page=1) => api.get(`/movies/search?q=${encodeURIComponent(q)}&page=${page}`),
    genres:     ()  => api.get('/movies/genres'),
    byGenre:    (id, page=1) => api.get(`/movies/by-genre/${id}?page=${page}`),
    detail:     (id) => api.get(`/movies/${id}`),
    similar:    (id) => api.get(`/movies/${id}/similar`),
    person:     (id) => api.get(`/movies/person/${id}`),
  },

  // Reviews
  reviews: {
    forMovie: (id) => api.get(`/reviews/movie/${id}`),
    forUser:  (id) => api.get(`/reviews/user/${id}`),
    save:     (d)  => api.post('/reviews', d),
    delete:   (id) => api.delete(`/reviews/${id}`),
    like:     (id) => api.post(`/reviews/${id}/like`),
    comment:  (id, text) => api.post(`/reviews/${id}/comment`, { text }),
  },

  // Lists
  lists: {
    public:     () => api.get('/lists/public'),
    forUser:    (userId) => api.get(`/lists/user/${userId}`),
    detail:     (id) => api.get(`/lists/${id}`),
    create:     (d) => api.post('/lists', d),
    update:     (id, d) => api.put(`/lists/${id}`, d),
    delete:     (id) => api.delete(`/lists/${id}`),
    addMovie:   (id, d) => api.post(`/lists/${id}/movies`, d),
    removeMovie:(id, movieId) => api.delete(`/lists/${id}/movies/${movieId}`),
    like:       (id) => api.post(`/lists/${id}/like`),
  },

  // Users
  users: {
    search:   (q) => api.get(`/users/search?q=${encodeURIComponent(q)}`),
    profile:  (username) => api.get(`/users/${username}`),
    follow:   (id) => api.post(`/users/${id}/follow`),
    acceptFollow: (id) => api.post(`/users/${id}/follow/accept`),
    rejectFollow: (id) => api.post(`/users/${id}/follow/reject`),
    addWatchlist:    (d)  => api.post('/users/watchlist/add', d),
    removeWatchlist: (id) => api.delete(`/users/watchlist/${id}`),
    toggleLike: (d) => api.post('/users/liked/add', d),
    toggleWatched:(d) => api.post('/users/watched/toggle', d),
  },

  // Activity
  activity: {
    feed:   () => api.get('/activity/feed'),
    global: () => api.get('/activity/global'),
    user:   (id) => api.get(`/activity/user/${id}`),
  },

  // Recommendations
  recs: {
    smart:  () => api.get('/recommendations/smart'),
    inbox:  () => api.get('/recommendations/inbox'),
    send:   (d) => api.post('/recommendations/send', d),
    markRead:(id) => api.patch(`/recommendations/${id}/read`),
  },

  // Groups
  groups: {
    create: (d) => api.post('/groups', d),
    list:   ()  => api.get('/groups'),
    popular:()  => api.get('/groups/popular/all'),
    get:    (id)=> api.get(`/groups/${id}`),
    join:   (d) => api.post('/groups/join', d),
    post:   (id, d) => api.post(`/groups/${id}/posts`, d),
    delete: (id)=> api.delete(`/groups/${id}`),
  },

  // Messages
  messages: {
    friends: () => api.get('/messages/friends'),
    history: (id) => api.get(`/messages/${id}`),
    send: (d) => api.post('/messages', d),
  }
};

// ── Toast Notifications ──
function toast(msg, type = 'info') {
  const icons = { success: '✓', error: '✕', info: '★' };
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]||'★'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ── Rating helpers ──
function starsHtml(rating, max=5) {
  if (!rating) return '<span style="color:var(--text-muted)">Not rated</span>';
  let html = '';
  for (let i = 1; i <= max; i++) {
    if (i <= Math.floor(rating)) {
      html += '<span style="color:var(--accent)">★</span>';
    } else if (i - 0.5 <= rating) {
      html += '<span style="position:relative;display:inline-block;color:var(--text-muted)">★<span style="position:absolute;left:0;top:0;overflow:hidden;width:50%;color:var(--accent)">★</span></span>';
    } else {
      html += '<span style="color:var(--text-muted)">★</span>';
    }
  }
  return `<span style="display:inline-flex;gap:2px">${html}</span>`;
}

// ── Time ago ──
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

// ── Render Nav ──
function renderNav(activePage = '') {
  window.activeNavPage = activePage;
  const user = Auth.getUser();
  const navEl = document.getElementById('navbar');
  if (!navEl) return;
  navEl.innerHTML = `
    <div class="nav-inner">
      <a href="/" class="nav-logo">
        <img src="/img/logo.png" alt="CineTrack Logo" style="height:32px;width:auto;object-fit:contain">
        CINE<span>TRACK</span>
      </a>
      <div class="nav-search">
        <span class="nav-search-icon">🔍</span>
        <input type="text" id="navSearchInput" placeholder="Search movies..." autocomplete="off">
        <div class="search-dropdown" id="searchDropdown"></div>
      </div>
      <nav class="nav-links">
        <img src="/img/logo.png" alt="" style="height: 20px; margin-right: 10px; opacity: 0.7; filter: drop-shadow(0 0 5px rgba(245,166,35,0.2))">
        <a href="/" class="nav-link ${activePage==='home'?'active':''}"><span>🏠</span><span>Home</span></a>
        <a href="/movies.html" class="nav-link ${activePage==='movies'?'active':''}"><span>🎬</span><span>Movies</span></a>
        <a href="/community.html" class="nav-link ${activePage==='community'?'active':''}"><span>👥</span><span>Community</span></a>
        <a href="/recommendations.html" class="nav-link ${activePage==='recs'?'active':''}"><span>✨</span><span>For You</span></a>
        ${user ? `<a href="/lists.html" class="nav-link ${activePage==='lists'?'active':''}"><span>📋</span><span>Lists</span></a>` : ''}
      </nav>
      <div class="nav-actions">
        ${user
          ? `<a href="/profile.html?u=${user.username}" class="flex-center" style="gap:8px">
              <img src="${user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=1e1e2a&color=f5a623&bold=true`}" class="nav-avatar" alt="${user.username}">
             </a>
             <button class="btn btn-outline btn-sm" onclick="Auth.logout()">Logout</button>`
          : `<a href="/login.html" class="btn btn-outline btn-sm">Login</a>
             <a href="/register.html" class="btn btn-primary btn-sm">Sign Up</a>`
        }
      </div>
    </div>`;
  initNavSearch();
}

window.addEventListener('auth-change', () => {
  // Gracefully re-render the navbar preserving state if possible
  renderNav(window.activeNavPage || '');
});

function initNavSearch() {
  const input = document.getElementById('navSearchInput');
  const dropdown = document.getElementById('searchDropdown');
  if (!input) return;
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { dropdown.classList.remove('open'); return; }
    timer = setTimeout(async () => {
      try {
        const data = await api.movies.search(q);
        const movies = (data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'person').slice(0, 6);
        if (!movies.length) { dropdown.classList.remove('open'); return; }
        dropdown.innerHTML = movies.map(m => {
          if (m.media_type === 'person') {
            return `
            <div class="search-result-item" onclick="window.location.href='/person.html?id=${m.id}'">
              ${img.profile(m.profile_path) ? `<img src="${img.profile(m.profile_path, 'w185')}" style="width:36px;height:54px;object-fit:cover;border-radius:4px" alt="${m.name}">` : '<div style="width:36px;height:54px;background:var(--bg-elevated);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.5rem">👤</div>'}
              <div class="search-result-info">
                <div class="search-result-title">${m.name}</div>
                <div class="search-result-year">Person</div>
              </div>
            </div>`;
          } else {
            return `
            <div class="search-result-item" onclick="window.location.href='/movie-detail.html?id=${m.id}'">
              ${img.poster(m.poster_path) ? `<img src="${img.poster(m.poster_path, 'w92')}" alt="${m.title}">` : '<div style="width:36px;height:54px;background:var(--bg-elevated);border-radius:4px;flex-shrink:0"></div>'}
              <div class="search-result-info">
                <div class="search-result-title">${m.title}</div>
                <div class="search-result-year">${m.release_date?.slice(0,4) || ''}</div>
              </div>
            </div>`;
          }
        }).join('');
        dropdown.classList.add('open');
      } catch(e) {}
    }, 350);
  });
  document.addEventListener('click', (e) => { if (!input.contains(e.target)) dropdown.classList.remove('open'); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) window.location.href = `/movies.html?search=${encodeURIComponent(input.value.trim())}`; });
}

// ── UI Helpers ──
function movieCardHtml(movie) {
  if (movie.media_type === 'person') {
    const poster = img.profile(movie.profile_path, 'w342');
    return `
      <div class="movie-card" onclick="window.location.href='/person.html?id=${movie.id}'">
        ${poster
          ? `<img class="movie-card-poster" style="object-fit:cover" src="${poster}" alt="${movie.name}" loading="lazy">`
          : `<div class="movie-card-poster-placeholder" style="font-size:3rem">👤</div>`}
        <div class="movie-card-overlay">
          <div class="movie-card-title">${movie.name}</div>
          <div class="movie-card-year">Person</div>
        </div>
      </div>`;
  }

  const poster = img.poster(movie.poster_path);
  const year   = movie.release_date?.slice(0,4) || movie.first_air_date?.slice(0,4) || '';
  const rating = movie.vote_average ? (movie.vote_average / 2).toFixed(1) : null;
  const title = movie.title || movie.name || 'Unknown';
  
  return `
    <div class="movie-card" onclick="window.location.href='/movie-detail.html?id=${movie.id}'">
      ${poster
        ? `<img class="movie-card-poster" src="${poster}" alt="${title.replace(/"/g, '&quot;')}" loading="lazy">`
        : `<div class="movie-card-poster-placeholder">🎬</div>`}
      ${rating ? `<div class="movie-card-rating">★ ${rating}</div>` : ''}
      <div class="movie-card-overlay">
        <div class="movie-card-actions">
          <button class="btn-icon btn-sm" onclick="event.stopPropagation(); quickWatchlist(${movie.id},'${title.replace(/'/g,"\\'")}','${movie.poster_path||''}')" data-tooltip="Watchlist">🔖</button>
          <button class="btn-icon btn-sm" onclick="event.stopPropagation(); quickLike(${movie.id},'${title.replace(/'/g,"\\'")}','${movie.poster_path||''}')" data-tooltip="Like">❤️</button>
        </div>
        <div class="movie-card-title">${title}</div>
        <div class="movie-card-year">${year}</div>
      </div>
    </div>`;
}

async function quickWatchlist(movieId, movieTitle, posterPath) {
  if (!Auth.isLoggedIn()) { window.location.href = '/login.html'; return; }
  try {
    await api.users.addWatchlist({ movieId, movieTitle, posterPath });
    toast('Added to watchlist!', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

async function quickLike(movieId, movieTitle, posterPath) {
  if (!Auth.isLoggedIn()) { window.location.href = '/login.html'; return; }
  try {
    const res = await api.users.toggleLike({ movieId, movieTitle, posterPath });
    toast(res.liked ? 'Added to liked films!' : 'Removed from liked films', res.liked ? 'success' : 'info');
  } catch(e) { toast(e.message, 'error'); }
}