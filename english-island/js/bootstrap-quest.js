import { initQuestUI } from './world-quest.js';

const loading = document.getElementById('quest-loading');
const fallback = document.getElementById('quest-fallback');

initQuestUI()
  .then(() => {
    if (loading) loading.hidden = true;
  })
  .catch(error => {
    console.error('Island Quest failed to start', error);
    if (loading) loading.hidden = true;
    if (fallback) fallback.hidden = false;
  });
