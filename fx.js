// Motion layer shared by index.html and project.html.
// Content is fully readable without it; reduced-motion users get none of it.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  if (reduce || !window.gsap) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('fx');

  /* smooth scroll */
  let lenis;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: .1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => { const t = $(a.getAttribute('href')); if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -80 }); } }));
  }

  /* scroll progress */
  const bar = document.createElement('div'); bar.className = 'progress'; document.body.appendChild(bar);
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: s => bar.style.transform = `scaleX(${s.progress})` });

  /* cursor glow */
  if (fine) {
    const glow = document.createElement('div'); glow.className = 'glow'; document.body.appendChild(glow);
    const gx = gsap.quickTo(glow, 'x', { duration: .9, ease: 'power3' }), gy = gsap.quickTo(glow, 'y', { duration: .9, ease: 'power3' });
    addEventListener('pointermove', e => { gx(e.clientX); gy(e.clientY); }, { passive: true });
    // magnetic buttons
    $$('.btn').forEach(b => {
      const qx = gsap.quickTo(b, 'x', { duration: .5, ease: 'power3' }), qy = gsap.quickTo(b, 'y', { duration: .5, ease: 'power3' });
      b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); qx((e.clientX - r.left - r.width / 2) * .3); qy((e.clientY - r.top - r.height / 2) * .3); });
      b.addEventListener('pointerleave', () => { qx(0); qy(0); });
    });
  }

  /* headline: characters rise in */
  $$('.split').forEach(el => {
    el.innerHTML = el.innerHTML.split(/(<br>)/).map(part => part === '<br>' ? part :
      `<span class="line">${[...part].map(c => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</span>`).join('');
    gsap.from($$('.ch', el), { yPercent: 115, duration: 1.1, ease: 'expo.out', stagger: .045, delay: .45 });
  });
  gsap.from('.hero .cta, .hero .awards-list li, .hero .who, .d-hero .sub, .d-hero .back, .d-hero .label, .d-hero .pill', { y: 24, opacity: 0, duration: .9, ease: 'power3.out', stagger: .07, delay: .7 });

  /* hero headline: lines rise, then the example word cycles through real projects */
  if ($('.mega .in')) {
    gsap.from('.mega .in', { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: .14, delay: .4 });
  }

  /* typing: text appears character by character behind a blinking caret */
  const caret = document.createElement('span'); caret.className = 'caret';
  const prep = el => {
    const walk = n => [...n.childNodes].forEach(c => {
      if (c.nodeType === 3) { const f = document.createDocumentFragment();
        [...c.textContent].forEach(ch => { const s = document.createElement('span'); s.className = 'tc'; s.textContent = ch; f.appendChild(s); });
        c.replaceWith(f); }
      else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
    });
    walk(el); return $$('.tc', el);
  };
  const typeOut = (chars, ms) => new Promise(done => {
    let i = 0;
    (function step() {
      if (i >= chars.length) return done();
      const c = chars[i++]; c.classList.add('on'); c.after(caret);
      setTimeout(step, c.textContent === ' ' ? ms * .4 : /[,.]/.test(c.textContent) ? ms * 7 : ms);
    })();
  });
  const typed = $$('.type').map(el => ({ el, chars: prep(el) }));
  const T = el => typed.find(t => t.el === el);
  const tag = $('.hero .tagline.type'), desc = $('.hero .desc.type');
  setTimeout(() => [tag, desc].filter(Boolean).reduce((p, el) => p.then(() => typeOut(T(el).chars, el === tag ? 55 : 28)), Promise.resolve()), 1500);
  $$('.contact .type').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 75%', once: true, onEnter: () => typeOut(T(el).chars, 30) }));

  /* marquee: drifts on its own, can be dragged or flicked either way */
  const mq = $('.marquee .track');
  if (mq) {
    const box = mq.parentElement; let x = 0, vel = 0, drag = false, last = 0;
    box.addEventListener('pointerdown', e => { drag = true; last = e.clientX; vel = 0; box.setPointerCapture(e.pointerId); box.classList.add('grab'); });
    box.addEventListener('pointermove', e => { if (!drag) return; const d = e.clientX - last; last = e.clientX; x += d; vel = d; });
    const up = () => { drag = false; box.classList.remove('grab'); };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    gsap.ticker.add(() => {
      if (!drag) { x += vel - .7; vel *= .94; }
      const w = mq.scrollWidth / 2; x = ((x % w) - w) % w;
      mq.style.transform = `translate3d(${x}px,0,0)`;
    });
  }

  /* count-up for plain numeric values */
  const num = /^([−-]?)(\d+(?:\.\d+)?)(%|ms|px|개|건|초)?$/;
  $$('.stats b, .pcard .nums b, .result b, .perf b').forEach(el => {
    const m = el.textContent.trim().match(num); if (!m) return;
    const to = +m[2], dec = (m[2].split('.')[1] || '').length, o = { v: 0 };
    el.textContent = m[1] + (0).toFixed(dec) + (m[3] || '');
    ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () =>
      gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: () => el.textContent = m[1] + o.v.toFixed(dec) + (m[3] || '') }) });
  });

  /* images: wipe in from below, then drift slightly */
  $$('.demo figure, .shots figure').forEach(el => {
    gsap.fromTo(el, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });

  /* evidence bars fill when seen */
  $$('.bar .fl').forEach(f => gsap.from(f, { width: 0, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: f, start: 'top 92%' } }));

  /* section titles slide */
  $$('.sec-head h2, .case h3').forEach(h => gsap.from(h, { y: 40, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%' } }));
})();
