if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/ZIATA/sw.js', {scope:'/ZIATA/'})
      .catch(err => console.warn('ZIATA service worker:',err));
  });
}
