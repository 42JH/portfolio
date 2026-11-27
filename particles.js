// Scroll-driven particle object: one shape per section (sphere → cards → eye → wave → track).
// Falls back silently to the 2D hero field when WebGL or motion is unavailable.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('gl');
if (!reduce && canvas && window.gsap && window.ScrollTrigger) {
  try { init(); } catch (e) { console.warn('3D disabled', e); }
}

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 8;

  const N = innerWidth < 700 ? 6000 : 12000;
  const R = Math.random;

  /* ---------- shapes (each returns N xyz points) ---------- */
  const fill = f => { const a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const p = f(i); a.set(p, i * 3); } return a; };
  const sphere = fill(i => {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), t = i * 2.39996;
    const k = 1.55 + (R() - .5) * .04; return [Math.cos(t) * r * k, y * k, Math.sin(t) * r * k];
  });
  const cloud = fill(() => { const v = new THREE.Vector3().randomDirection().multiplyScalar(2.2 + R() * 2.2); return [v.x, v.y, v.z]; });
  // a fanned stack of screenshot cards
  const cards = fill(i => {
    const c = i % 5, w = 1.25, h = 2.2, e = R() < .55;           // e: on the edge, else sparse fill
    let x, y;
    if (e) { const s = R() * 2 * (w + h); x = s < w ? s : s < w + h ? w : s < 2 * w + h ? 2 * w + h - s : 0;
             y = s < w ? 0 : s < w + h ? s - w : s < 2 * w + h ? h : 2 * (w + h) - s; x -= w / 2; y -= h / 2; }
    else { x = (R() - .5) * w; y = (R() - .5) * h; if (R() < .6) y = Math.round(y * 6) / 6; }   // text lines
    const a = (c - 2) * .22;
    return [x * Math.cos(a) - y * Math.sin(a) + (c - 2) * .45, x * Math.sin(a) + y * Math.cos(a), (c - 2) * .25];
  });
  // an eye: lids, iris, pupil
  const eye = fill(() => {
    const u = R();
    if (u < .45) { const t = (R() * 2 - 1) * 1.0, top = R() < .5 ? 1 : -1; const x = t * 2.1; return [x, top * .95 * (1 - t * t) + (R() - .5) * .03, 0]; }
    if (u < .8) { const t = R() * Math.PI * 2, r = .62 + (R() - .5) * .05; return [Math.cos(t) * r, Math.sin(t) * r, .05]; }
    const t = R() * Math.PI * 2, r = Math.sqrt(R()) * .28; return [Math.cos(t) * r, Math.sin(t) * r, .1];
  });
  // a voice waveform (stacked lines)
  const wave = fill(() => {
    const x = (R() * 2 - 1) * 2.4, l = Math.floor(R() * 5), env = Math.exp(-x * x * .45);
    const y = Math.sin(x * (3 + l) + l) * env * (1.1 - l * .15) + (l - 2) * .08;
    return [x, y, (l - 2) * .2];
  });
  // a racing track (figure eight ribbon)
  const track = fill(() => {
    const t = R() * Math.PI * 2, s = 2.1, d = 1 + Math.sin(t) ** 2;
    const x = s * Math.cos(t) / d, y = s * Math.sin(t) * Math.cos(t) / d, w = (R() - .5) * .22;
    return [x + w * .3, y * 1.2 + w, (R() - .5) * .15];
  });

  const geo = new THREE.BufferGeometry();
  const from = sphere.slice(), to = sphere.slice();
  geo.setAttribute('position', new THREE.BufferAttribute(from, 3));
  geo.setAttribute('aTo', new THREE.BufferAttribute(to, 3));
  const rnd = new Float32Array(N); for (let i = 0; i < N; i++) rnd[i] = R();
  geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));

  const uni = { uMix: { value: 0 }, uTime: { value: 0 }, uSize: { value: 2.2 * renderer.getPixelRatio() }, uAlpha: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aTo; attribute float aRnd; uniform float uMix, uTime, uSize; varying float vR;
      void main(){
        float m = smoothstep(0., 1., clamp(uMix * 1.4 - aRnd * .4, 0., 1.));
        vec3 p = mix(position, aTo, m);
        p += .03 * vec3(sin(uTime + aRnd * 40.), cos(uTime * .8 + aRnd * 30.), sin(uTime * .6 + aRnd * 20.));
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (1. + aRnd) * (8. / -mv.z); vR = aRnd;
      }`,
    fragmentShader: `
      uniform float uAlpha; varying float vR;
      void main(){
        float d = length(gl_PointCoord - .5); if (d > .5) discard;
        vec3 c = mix(vec3(.94,.93,.90), vec3(1.,.35,.12), step(.78, vR));
        gl_FragColor = vec4(c, (1. - d * 2.) * uAlpha * .85);
      }`
  });
  const pts = new THREE.Points(geo, mat);
  const group = new THREE.Group(); group.add(pts); scene.add(group);

  /* ---------- morphing ---------- */
  let cur = null;
  function morph(target) {
    if (target === cur) return; cur = target;
    const m = uni.uMix.value;
    for (let i = 0; i < N * 3; i++) {              // freeze current blend as the new start
      const k = Math.min(Math.max(m * 1.4 - rnd[(i / 3) | 0] * .4, 0), 1), s = k * k * (3 - 2 * k);
      from[i] = from[i] + (to[i] - from[i]) * s;
    }
    to.set(target);
    geo.attributes.position.needsUpdate = geo.attributes.aTo.needsUpdate = true;
    uni.uMix.value = 0;
    gsap.to(uni.uMix, { value: 1, duration: 1.8, ease: 'power2.inOut', overwrite: true });
  }

  /* where the object sits for each section (x offset, scale, opacity) */
  const wide = () => innerWidth > 900;
  const place = { x: 0, y: 0, s: 1, a: 1 };
  const steps = [
    // [x, y, scale, opacity] — projects sit top-right, in the empty space beside the big title
    ['.hero', sphere, () => wide() ? [3.1, .5, 1, 1] : [.5, .9, .85, .8]],
    ['.statement', cloud, () => [0, 0, 1.2, .4]],
    ['#p-modera', cards, () => wide() ? [3.4, 1.5, .62, .7] : [.7, 2.3, .4, .35]],
    ['#p-sia', eye, () => wide() ? [3.3, 1.6, .62, .7] : [.7, 2.3, .4, .35]],
    ['#p-dva', wave, () => wide() ? [3.3, 1.6, .6, .7] : [.7, 2.3, .4, .35]],
    ['#p-more', track, () => wide() ? [3.2, 1.4, .6, .6] : [.7, 2.3, .4, .35]],
    ['.contact', sphere, () => wide() ? [3.0, .2, 1.05, .9] : [.6, -.6, .8, .6]],
  ];
  steps.forEach(([sel, shape, pos]) => {
    const el = document.querySelector(sel); if (!el) return;
    ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 45%', onToggle: s => {
      if (!s.isActive) return; morph(shape);
      const [x, y, sc, a] = pos(); gsap.to(place, { x, y, s: sc, a, duration: 1.6, ease: 'power3.inOut', overwrite: true });
    } });
  });
  morph(sphere); uni.uMix.value = 1; [place.x, place.y, place.s, place.a] = steps[0][2]();

  /* ---------- loop ---------- */
  let mx = 0, my = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);
  const light = () => document.documentElement.classList.contains('lightmode');
  const clock = new THREE.Clock();
  (function tick() {
    const t = clock.getElapsedTime(); uni.uTime.value = t;
    uni.uAlpha.value += ((light() ? 0 : place.a) - uni.uAlpha.value) * .08;
    group.position.set(place.x, place.y, 0); group.scale.setScalar(place.s);
    group.rotation.y += ((mx * .9 + t * .05) - group.rotation.y) * .04;   // the object turns toward where you look
    group.rotation.x += ((my * .6) - group.rotation.x) * .04;
    renderer.render(scene, camera); requestAnimationFrame(tick);
  })();
  document.documentElement.classList.add('has-3d');
}
