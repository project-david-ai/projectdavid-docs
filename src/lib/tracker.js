// src/lib/tracker.js

const COOKIE_NAME = 'pd_vid';

function getOrCreateVid() {
  // 1. Try LocalStorage
  let vid = localStorage.getItem(COOKIE_NAME);
  if (vid) return vid;

  // 2. Try Cookie
  const match = document.cookie.match(new RegExp('(^| )' + COOKIE_NAME + '=([^;]+)'));
  if (match) return match[2];

  // 3. Create New (Timestamp + Random Hex)
  vid = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  // Save for 1 year
  localStorage.setItem(COOKIE_NAME, vid);
  document.cookie = `${COOKIE_NAME}=${vid}; Max-Age=31536000; path=/; SameSite=Lax`;

  return vid;
}

export function trackPageView(pathname) {
  const vid = getOrCreateVid();
  const query = new URLSearchParams({
    vid: vid,
    p: pathname,
    t: Date.now()
  }).toString();

  // We hit a path that Nginx will definitely log.
  // We don't care about the response, just the log entry.
  fetch(`/track.gif?${query}`, { mode: 'no-cors', keepalive: true });
}