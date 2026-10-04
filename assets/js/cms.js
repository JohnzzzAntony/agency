/* Runtime content layer. Static pages remain the fallback when API is unavailable. */
(function () {
  'use strict';
  fetch('/api/content', { headers: { Accept: 'application/json' } })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      if (!data) return;
      document.querySelectorAll('[data-cms]').forEach(function (element) {
        var value = data;
        element.dataset.cms.split('.').forEach(function (key) { value = value && value[key]; });
        if (typeof value !== 'string' || !value) return;
        if (element.matches('img')) element.src = value;
        else if (element.matches('input, textarea')) element.value = value;
        else element.textContent = value;
      });
      if (data.pages && data.pages.home) {
        var page = data.pages.home;
        if (page.title) document.title = page.title;
        var description = document.querySelector('meta[name="description"]');
        if (description && page.description) description.setAttribute('content', page.description);
      }
    })
    .catch(function () { /* static HTML remains usable offline */ });
})();
