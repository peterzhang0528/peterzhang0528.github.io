import { initLittleIslandUI } from './world-little-island.js';
initLittleIslandUI().then(() => { const loading = document.getElementById('little-loading'); if (loading) loading.hidden = true; })
  .catch(() => { const loading = document.getElementById('little-loading'); if (loading) loading.hidden = true; const fallback = document.getElementById('little-fallback'); if (fallback) fallback.hidden = false; });
