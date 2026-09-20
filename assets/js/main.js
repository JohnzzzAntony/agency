/* Wavespace clone — interactions. No dependencies. */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- Sticky header state ---- */
  var header = $('.header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-stuck', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- Mega menu (hover on desktop, click-safe) ---- */
  var megaTrigger = $('[data-mega-trigger]');
  var mega = $('[data-mega]');
  if (megaTrigger && mega) {
    var closeTimer;
    var open = function () { clearTimeout(closeTimer); mega.classList.add('is-open'); megaTrigger.setAttribute('aria-expanded', 'true'); };
    var close = function () { closeTimer = setTimeout(function () { mega.classList.remove('is-open'); megaTrigger.setAttribute('aria-expanded', 'false'); }, 120); };
    [megaTrigger, mega].forEach(function (el) {
      el.addEventListener('mouseenter', open);
      el.addEventListener('mouseleave', close);
    });
    megaTrigger.addEventListener('focus', open);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { clearTimeout(closeTimer); mega.classList.remove('is-open'); } });
  }

  /* ---- Mobile drawer ---- */
  var burger = $('[data-burger]');
  var drawer = $('[data-drawer]');
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      var isOpen = drawer.classList.toggle('is-open');
      burger.classList.toggle('is-open', isOpen);
      burger.setAttribute('aria-expanded', String(isOpen));
      document.body.classList.toggle('is-locked', isOpen);
    });
  }

  /* ---- FAQ accordion ---- */
  var collapse = function (item) {
    var panel = $('.faq__a', item);
    if (!panel) return;
    panel.style.height = panel.scrollHeight + 'px';
    void panel.offsetHeight; // force reflow so the height change transitions
    panel.style.height = '0px';
    item.classList.remove('is-open');
    $('.faq__q', item).setAttribute('aria-expanded', 'false');
  };
  var expand = function (item) {
    var panel = $('.faq__a', item);
    if (!panel) return;
    panel.style.height = panel.scrollHeight + 'px';
    item.classList.add('is-open');
    $('.faq__q', item).setAttribute('aria-expanded', 'true');
    // Release to auto once open so long answers reflow with the viewport.
    panel.addEventListener('transitionend', function onEnd(e) {
      if (e.propertyName !== 'height') return;
      panel.removeEventListener('transitionend', onEnd);
      if (item.classList.contains('is-open')) panel.style.height = 'auto';
    });
  };

  $$('[data-faq]').forEach(function (list) {
    list.addEventListener('click', function (e) {
      var btn = e.target.closest('.faq__q');
      if (!btn) return;
      var item = btn.parentElement;
      var wasOpen = item.classList.contains('is-open');
      if (!list.hasAttribute('data-faq-multi')) {
        $$('.faq__item.is-open', list).forEach(collapse);
      } else if (wasOpen) {
        collapse(item);
      }
      if (!wasOpen) expand(item);
    });
  });

  /* ---- Reviews carousel ---- */
  $$('[data-carousel]').forEach(function (root) {
    var pages = $$('[data-slide]', root);
    var dots = $$('button', $('.dots', root) || root);
    if (!pages.length || !dots.length) return;
    var show = function (i) {
      pages.forEach(function (p, n) { p.hidden = n !== i; });
      dots.forEach(function (d, n) { d.setAttribute('aria-current', String(n === i)); });
    };
    dots.forEach(function (d, i) { d.addEventListener('click', function () { show(i); }); });
    show(0);
  });

  /* ---- Case study / blog filters ---- */
  $$('[data-filter-group]').forEach(function (group) {
    var target = $('#' + group.dataset.filterGroup);
    if (!target) return;
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (!btn) return;
      e.preventDefault();
      $$('[data-filter]', group).forEach(function (b) { b.classList.toggle('is-active', b === btn); });
      var want = btn.dataset.filter;
      $$('[data-tags]', target).forEach(function (card) {
        var tags = card.dataset.tags.split('|');
        var hit = want === 'all' || tags.indexOf(want) !== -1;
        card.style.display = hit ? '' : 'none';
      });
    });
  });

  /* ---- Pricing billing toggle ---- */
  $$('[data-billing]').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      $$('button', group).forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });
      var mult = parseFloat(btn.dataset.mult || '1');
      var suffix = btn.dataset.suffix || '/monthly';
      $$('[data-base]').forEach(function (el) {
        var base = parseFloat(el.dataset.base);
        if (!base) return;
        el.firstChild.nodeValue = '$' + Math.round(base * mult).toLocaleString('en-US') + ' ';
        var per = $('span', el);
        if (per) per.textContent = suffix;
      });
    });
  });

  /* ---- Contact form (no backend; confirms locally) ---- */
  $$('[data-contact-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = $('.form-note', form);
      if (!note) return;
      note.textContent = 'This preview has not sent an enquiry. Email johnsantonyjo@gmail.com or WhatsApp +971 58 810 2728 to contact DuoNex.';
      note.classList.add('is-ok');
      form.reset();
    });
  });

  /* ---- Pause marquees while off-screen ---- */
  var marquees = $$('.marquee, .marquee-one, .marquee-two, .marquee-three');
  if (marquees.length && 'IntersectionObserver' in window) {
    var mo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var track = $('.marquee__track, .marquee-track', entry.target);
        if (track) track.style.animationPlayState = entry.isIntersecting ? 'running' : 'paused';
      });
    }, { rootMargin: '200px 0px' });
    marquees.forEach(function (el) { mo.observe(el); });
  }

  /* ---- Scroll reveal ---- */
  var reveals = $$('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        setTimeout(function () { entry.target.classList.add('is-in'); }, Math.min(i, 6) * 60);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }
})();
