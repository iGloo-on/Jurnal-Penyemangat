/* ==========================================================================
   JURNAL SEMANGAT MAULIA - Vanilla JS book engine (tanpa dependensi)
   ========================================================================== */
const state = {
  isCoverOpen: false,
  currentChapter: 1,
  isWaxCracked: false,
  turning: false,
};
const $ = (id) => document.getElementById(id);
const spreadMQ = window.matchMedia("(min-width: 1000px)");
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const dom = {
  bookVolume: $("book-3d-container"),
  cover: $("book-cover"),
  stage: $("page-mesh-stage"),
  pageIndicator: $("page-indicator"),
  waxSeal: $("wax-seal"),
  waxEnvelope: $("wax-envelope"),
  nekoSpeechText: $("neko-speech-text"),
  boosterModal: $("booster-modal"),
  modalTitle: $("modal-title"),
  modalBody: $("modal-body"),
  modalBadge: $("modal-icon-badge"),
  lightboxModal: $("lightbox-modal"),
  lightboxImg: $("lightbox-img"),
  lightboxCaption: $("lightbox-caption"),
};

/* ---------- Audio synthesizer (Web Audio API) ---------- */
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function noiseBurst(
  dur,
  { type = "bandpass", freq = 3000, q = 1, gain = 0.1, sweepTo } = {},
) {
  const ctx = getAudioContext(),
    t = ctx.currentTime;
  const buf = ctx.createBuffer(
    1,
    Math.ceil(ctx.sampleRate * dur),
    ctx.sampleRate,
  );
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++)
    d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain();
  src.buffer = buf;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  src.start(t);
}
function tone(freq, dur, { type = "sine", gain = 0.1, to } = {}) {
  const ctx = getAudioContext(),
    t = ctx.currentTime,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}
const safe =
  (fn) =>
  (...a) => {
    try {
      fn(...a);
    } catch (e) {}
  };
const playPaperSound = safe(() =>
  noiseBurst(0.3, { freq: 2500, sweepTo: 6500, q: 0.7, gain: 0.12 }),
);
const playChimeSound = safe(() => {
  tone(880, 0.5, { gain: 0.09 });
  tone(1320, 0.7, { gain: 0.05 });
});
const playCrackSound = safe(() => {
  noiseBurst(0.12, { type: "highpass", freq: 1800, gain: 0.35 });
  tone(140, 0.15, { type: "triangle", gain: 0.25, to: 40 });
  setTimeout(
    safe(() => noiseBurst(0.08, { type: "highpass", freq: 2600, gain: 0.25 })),
    90,
  );
});
const playMeowSound = safe(() => {
  const ctx = getAudioContext(),
    t = ctx.currentTime;
  const o = ctx.createOscillator(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(420, t);
  o.frequency.linearRampToValueAtTime(820, t + 0.15);
  o.frequency.linearRampToValueAtTime(380, t + 0.45);
  f.type = "bandpass";
  f.frequency.value = 1400;
  f.Q.value = 3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.5);
});
const playPurrSound = safe(() => {
  const ctx = getAudioContext(),
    t = ctx.currentTime + 0.4;
  const o = ctx.createOscillator(),
    lfo = ctx.createOscillator(),
    depth = ctx.createGain(),
    g = ctx.createGain(),
    f = ctx.createBiquadFilter();
  o.type = "sawtooth";
  o.frequency.value = 55;
  f.type = "lowpass";
  f.frequency.value = 260;
  lfo.frequency.value = 24;
  depth.gain.value = 0.04;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.06, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  lfo.connect(depth);
  depth.connect(g.gain);
  o.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  lfo.start(t);
  o.stop(t + 1.2);
  lfo.stop(t + 1.2);
});

/* ---------- Buku: sampul & halaman ---------- */
function openBookCover() {
  if (state.isCoverOpen) return;
  state.isCoverOpen = true;
  dom.bookVolume.classList.replace("cover-closed", "cover-opened");
  $("toggle-cover-btn").classList.remove("hidden");
  playPaperSound();
}
function closeBookCover() {
  if (!state.isCoverOpen) return;
  state.isCoverOpen = false;
  dom.bookVolume.classList.replace("cover-opened", "cover-closed");
  $("toggle-cover-btn").classList.add("hidden");
  playPaperSound();
}

function showChapter(n, animateClass) {
  document.querySelectorAll(".chapter-page").forEach((p) => {
    p.classList.remove("page-active", "flip-in", "flip-back");
    p.classList.add("hidden-page");
  });
  const page = $(`page-chapter-${n}`);
  if (page) {
    page.classList.replace("hidden-page", "page-active");
    page.scrollTop = 0;
    if (animateClass) {
      void page.offsetWidth;
      page.classList.add(animateClass);
      page.addEventListener(
        "animationend",
        () => page.classList.remove(animateClass),
        { once: true },
      );
    }
  }
  state.currentChapter = n;
  dom.pageIndicator.innerText = `Halaman ${n} dari 11`;
  if (typeof onChapterEnter === "function") onChapterEnter(n);
}

function goToChapter(n) {
  if (!state.isCoverOpen) openBookCover();
  if (n < 1 || n > 11 || state.turning) return;
  const forward = n >= state.currentChapter;
  playChimeSound();
  playPaperSound();
  if (spreadMQ.matches && !reduceMotion && n !== state.currentChapter) {
    state.turning = true;
    const leaf = document.createElement("div");
    leaf.className = "turn-leaf" + (forward ? "" : " back");
    dom.stage.appendChild(leaf);
    setTimeout(() => showChapter(n, null), 430);
    setTimeout(() => {
      leaf.remove();
      state.turning = false;
    }, 980);
  } else {
    showChapter(n, forward ? "flip-in" : "flip-back");
  }
}
const nextPage = () =>
  state.currentChapter < 11 && goToChapter(state.currentChapter + 1);
const prevPage = () =>
  state.currentChapter > 1 && goToChapter(state.currentChapter - 1);

/* ---------- Bab 2: segel lilin ---------- */
function crackWaxSeal() {
  if (state.isWaxCracked) return;
  state.isWaxCracked = true;
  playCrackSound();
  dom.waxSeal.classList.add("cracked");
  setTimeout(() => {
    dom.waxEnvelope.classList.add("unsealed");
    playChimeSound();
  }, 600);
}

/* ---------- Bab 3: Neko & es krim ---------- */
const catQuotes = [
  "Purrr~ Maul jangan lupa minum air putih pas belajar ya!",
  "TKA itu cuma step kecil. Kemampuan Maul jauh lebih besar dari ujian apapun!",
  "Kalau kerasa capek, meowww... rebahan sebentar gak dosa kok!",
  "FEB UNAIR udah nungguin kamu kok, Maul! Semangat!",
];
function petNekoCat() {
  playMeowSound();
  playPurrSound();
  dom.nekoSpeechText.innerText =
    catQuotes[Math.floor(Math.random() * catQuotes.length)];
  const av = document.querySelector("#page-chapter-4 .neko-avatar-wrapper");
  [dom.nekoSpeechText, av].forEach((el, i) => {
    const c = i ? "purr" : "pop";
    el.classList.remove(c);
    void el.offsetWidth;
    el.classList.add(c);
  });
}
/* ---------- Bab 5: hati ungu V ---------- */
const vQuotes = [
  "Widihh disemangatin sama idolanya meoww! V bilang: 'Borahea Maulia!' 💜",
  "V bilang: 'Jangan lupa senyum hari ini ya Maul!' ✨💜",
  "V bilang: 'Kalau lelah, rehat sebentar sambil dengerin lagu favoritmu. Semangat TKA-nya Maul!' 🎶💜",
  "V bilang: 'Kamu sudah berusaha keras sejauh ini. Aku bangga sama kamu, Maulia!' 🌟💜",
  "Iri banget sama idolmu, bisa dapet cinta sebanyak itu dari Maul. When ya Neko dapet cinta sebanyak itu juga? meoww... 💜",
  "Kalau Neko berubah jadi Kim Taehyung, Maul bakal sedemikian sayangnya juga gak ya sama Neko? Meoww... 🥺💜",
];
let lastVQuote = -1;
function retrigger(el, classes) {
  el.classList.remove(...classes);
  void el.offsetWidth;
  el.classList.add(...classes);
}
function petVHeart() {
  playChimeSound();
  let i;
  do {
    i = Math.floor(Math.random() * vQuotes.length);
  } while (i === lastVQuote && vQuotes.length > 1);
  lastVQuote = i;
  const text = $("v-speech-text");
  text.innerText = vQuotes[i];
  retrigger($("v-heart-avatar"), ["heart-pop", "glow-on"]);
  retrigger(text, ["pop"]);
}

function openBoosterModal(title, body, icon) {
  playChimeSound();
  dom.modalTitle.innerText = title;
  dom.modalBody.innerText = body;
  dom.modalBadge.innerText = icon;
  dom.boosterModal.classList.remove("hidden-modal");
}
const closeBoosterModal = () => dom.boosterModal.classList.add("hidden-modal");
document.addEventListener("click", (e) => {
  const c = e.target.closest(".icecream-card");
  if (!c) return;
  c.classList.add("picked");
  setTimeout(() => c.classList.remove("picked"), 1200);
});

/* ---------- Bab 4: kartu ---------- */
function flipAffirmationCard(cardEl) {
  cardEl.classList.toggle("flipped");
  playChimeSound();
}
function shuffleCardDeck() {
  playPaperSound();
  const deck = document.querySelector(".card-deck-grid");
  const cards = [...deck.children];
  cards.forEach((c) => c.classList.remove("flipped"));
  const first = cards.map((c) => c.getBoundingClientRect());
  let order;
  do {
    order = [...cards].sort(() => Math.random() - 0.5);
  } while (order.every((c, i) => c === cards[i]));
  order.forEach((c) => deck.appendChild(c));
  cards.forEach((c, i) => {
    const l = c.getBoundingClientRect(),
      dx = first[i].left - l.left,
      dy = first[i].top - l.top;
    c.animate(
      [
        { transform: `translate(${dx}px,${dy}px)` },
        {
          transform: `translate(${dx / 2}px,${dy / 2 - 56}px) rotate(${(Math.random() - 0.5) * 26}deg) scale(1.1)`,
          offset: 0.5,
        },
        { transform: "none" },
      ],
      { duration: 850, easing: "cubic-bezier(.3,.8,.3,1)" },
    );
  });
  setTimeout(playPaperSound, 300);
}

/* ---------- Bab 5: balon & lightbox ---------- */
function launchPurpleBalloons() {
  playChimeSound();
  const add = (el, ms) => {
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  };
  for (let i = 0; i < 12; i++) {
    const b = document.createElement("div"),
      d = 4 + Math.random() * 3;
    b.className = "balloon";
    b.style.cssText = `left:${Math.random() * 90 + 3}vw;--w:${44 + Math.random() * 34}px;--d:${d}s;animation-delay:${Math.random() * 0.8}s,0s`;
    add(b, (d + 1) * 1000);
  }
  for (let i = 0; i < 18; i++) {
    const h = document.createElement("div"),
      d = 3 + Math.random() * 3;
    h.className = "heart-float";
    h.innerText = "💜";
    h.style.cssText = `left:${Math.random() * 94 + 2}vw;font-size:${16 + Math.random() * 22}px;--d:${d}s;--dx:${Math.random() * 90 - 45}px;--r:${Math.random() * 60 - 30}deg;animation-delay:${Math.random() * 1.2}s`;
    add(h, (d + 1.5) * 1000);
  }
}
function openLightbox(src, caption) {
  playChimeSound();
  dom.lightboxImg.src = src;
  dom.lightboxCaption.innerText = caption;
  dom.lightboxModal.classList.remove("hidden-modal");
}
const closeLightbox = () => dom.lightboxModal.classList.add("hidden-modal");

/* ---------- Suasana: lilin & audio latar ---------- */
function toggleCandlelight() {
  document.body.classList.toggle("candlelight-mode");
  playChimeSound();
}
let ambientActive = false,
  padNodes = null;
function cycleAmbientAudio() {
  ambientActive = !ambientActive;
  toggleAmbientPad(ambientActive);
  $("ambient-text").innerText = ambientActive ? "Borahae Lo-Fi" : "Audio Latar";
  playChimeSound();
}
function toggleAmbientPad(on) {
  try {
    const ctx = getAudioContext();
    if (on && !padNodes) {
      const master = ctx.createGain(),
        lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700;
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2);
      const oscs = [220, 277.18, 329.63, 440].map((f, i) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.detune.value = i * 4 - 6;
        o.connect(lp);
        o.start();
        return o;
      });
      lp.connect(master);
      master.connect(ctx.destination);
      padNodes = { master, oscs };
    } else if (!on && padNodes) {
      padNodes.master.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + 0.8,
      );
      padNodes.oscs.forEach((o) => o.stop(ctx.currentTime + 0.9));
      padNodes = null;
    }
    $("ambient-icon").innerText = on ? "🎶" : "🌧️";
  } catch (e) {}
}

/* ---------- Interaksi pointer: foil sampul + polaroid ---------- */
dom.cover.addEventListener("pointermove", (e) => {
  const r = dom.cover.getBoundingClientRect();
  dom.cover.style.setProperty(
    "--mx",
    `${((e.clientX - r.left) / r.width) * 100}%`,
  );
  dom.cover.style.setProperty(
    "--my",
    `${((e.clientY - r.top) / r.height) * 100}%`,
  );
});
document.addEventListener("pointermove", (e) => {
  const card = e.target.closest && e.target.closest(".polaroid-card");
  if (!card) return;
  const r = card.getBoundingClientRect(),
    x = (e.clientX - r.left) / r.width - 0.5,
    y = (e.clientY - r.top) / r.height - 0.5;
  card.style.setProperty("--ry", `${x * 16}deg`);
  card.style.setProperty("--rx", `${-y * 16}deg`);
  card.style.setProperty("--px", `${-x * 4}px`);
  card.style.setProperty("--py", `${-y * 4}px`);
});
document.addEventListener("pointerout", (e) => {
  const card = e.target.closest && e.target.closest(".polaroid-card");
  if (!card || card.contains(e.relatedTarget)) return;
  ["--rx", "--ry", "--px", "--py"].forEach((v) => card.style.removeProperty(v));
});
document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (
    (e.key === "Enter" || e.key === " ") &&
    t.matches &&
    t.matches('[role="button"][tabindex]')
  ) {
    e.preventDefault();
    t.click();
    return;
  }
  if (!state.isCoverOpen) {
    if (e.key === "Enter" && document.activeElement === dom.bookVolume)
      openBookCover();
    return;
  }
  if (e.key === "ArrowRight") nextPage();
  if (e.key === "ArrowLeft") prevPage();
  if (e.key === "Escape") {
    closeBoosterModal();
    closeLightbox();
  }
});

/* ---------- Partikel: bintang Borahae & orb cahaya lilin ---------- */
(function particles() {
  const cv = $("particles"),
    ctx = cv.getContext("2d");
  let W,
    H,
    dpr,
    items = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.width = innerWidth * dpr;
    H = cv.height = innerHeight * dpr;
    items = Array.from({ length: innerWidth < 700 ? 38 : 70 }, () => ({
      x: rnd(0, W),
      y: rnd(0, H),
      r: rnd(0.6, 2.2) * dpr,
      orb: Math.random() < 0.16,
      vy: rnd(0.08, 0.35) * dpr,
      ph: rnd(0, 6.28),
      sp: rnd(0.01, 0.03),
      hue: Math.random() < 0.5 ? "212,175,55" : "192,132,252",
    }));
    items.forEach((p) => {
      if (p.orb) p.r = rnd(14, 34) * dpr;
    });
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of items) {
      p.ph += p.sp;
      p.y -= p.vy * (p.orb ? 0.5 : 1);
      p.x += Math.sin(p.ph) * 0.25 * dpr;
      if (p.y < -p.r * 2) {
        p.y = H + p.r * 2;
        p.x = rnd(0, W);
      }
      const a = p.orb
        ? 0.07 + Math.sin(p.ph) * 0.03
        : 0.35 + Math.sin(p.ph * 3) * 0.35;
      const g = ctx.createRadialGradient(
        p.x,
        p.y,
        0,
        p.x,
        p.y,
        p.r * (p.orb ? 1 : 3),
      );
      g.addColorStop(0, `rgba(${p.hue},${Math.max(a, 0)})`);
      g.addColorStop(1, `rgba(${p.hue},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (p.orb ? 1 : 3), 0, 6.283);
      ctx.fill();
    }
    if (!reduceMotion && !document.hidden) requestAnimationFrame(frame);
  }
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !reduceMotion) requestAnimationFrame(frame);
  });
  resize();
  frame();
})();

/* ==========================================================================
    FASE 2 · BAB 6-10 (Pasca-TKA) — semua suara via Web Audio API murni
   ========================================================================== */
const PENTA = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
const seq = (
  freqs,
  step = 100,
  { dur = 0.45, type = "sine", gain = 0.08 } = {},
) =>
  freqs.forEach((f, i) =>
    setTimeout(
      safe(() => tone(f, dur, { type, gain })),
      i * step,
    ),
  );
const playBubblePopSound = safe(() => {
  noiseBurst(0.05, { type: "highpass", freq: 1500, gain: 0.3 });
  tone(300 + Math.random() * 500, 0.09, {
    type: "triangle",
    gain: 0.2,
    to: 90,
  });
});
const playLanternSound = safe(() => {
  tone(392, 0.9, { gain: 0.05, to: 587 });
  tone(587, 1.1, { gain: 0.04, to: 784 });
});
const playCompassTickSound = safe(() => {
  tone(1800, 0.03, { type: "square", gain: 0.02 });
  noiseBurst(0.02, { type: "highpass", freq: 4000, gain: 0.08 });
});
const playCompassSettleSound = safe(() => {
  tone(220, 0.6, { type: "triangle", gain: 0.12, to: 196 });
  seq([659.25, 783.99, 987.77], 110, { gain: 0.06 });
});
const playPotionSound = safe(() => {
  noiseBurst(0.5, { freq: 400, sweepTo: 2400, q: 2, gain: 0.1 });
  seq([440, 554.37, 659.25, 880], 120, { type: "triangle", gain: 0.07 });
});
const playAchievementSound = safe(() =>
  seq([523.25, 659.25, 783.99, 1046.5, 1318.5], 100, { gain: 0.08, dur: 0.6 }),
);
const playStarSound = safe((i) => {
  tone(PENTA[i % PENTA.length], 0.9, { gain: 0.07 });
  tone(PENTA[i % PENTA.length] * 2, 0.5, { gain: 0.025 });
});
const playSoftNopeSound = safe(() =>
  tone(180, 0.18, { type: "triangle", gain: 0.08, to: 130 }),
);

/* Hook dipanggil showChapter(): canvas Bab 10 hanya dihitung ulang saat terlihat */
function onChapterEnter(n) {
  if (n === 11 && window.enterConstellation) window.enterConstellation();
}
/* Cegah panah/spasi di kolom input memindahkan halaman buku */
document
  .querySelectorAll(".jm-input")
  .forEach((el) => el.addEventListener("keydown", (e) => e.stopPropagation()));

/* ---------- Bab 6: bubble wrap & lentera ---------- */
(function decompression() {
  const grid = $("bubble-grid");
  if (!grid) return;
  const TOTAL = 24;
  let popped = 0;
  const tips = [
    "Plop! Satu beban terlepas.",
    "Rasanya lega, kann??",
    "Bahu turun, napas panjang…",
    "Teruss, Maul. Kamu pantas beristirahat.",
    "Pop! Pop! Pop! 🫧",
  ];
  for (let i = 0; i < TOTAL; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bubble";
    b.setAttribute("aria-label", `Gelembung ${i + 1}, tekan untuk memecahkan`);
    grid.appendChild(b);
  }
  function update() {
    $("bubble-count").innerText = `${popped} / ${TOTAL}`;
    $("bubble-bar").style.width = `${(popped / TOTAL) * 100}%`;
  }
  function pop(b) {
    if (!b || b.classList.contains("popped")) return;
    b.classList.add("popped");
    b.setAttribute("aria-label", "Gelembung sudah pecah");
    popped++;
    playBubblePopSound();
    const f = document.createElement("span");
    f.className = "pop-float";
    f.innerText = "+lega";
    b.appendChild(f);
    setTimeout(() => f.remove(), 800);
    update();
    if (popped === TOTAL) {
      $("bubble-msg").innerText =
        "Semua gelembung udah pecahh! Capekmu sudah berkurang, Maul 💜";
      playAchievementSound();
      launchPurpleBalloons();
    } else if (popped % 4 === 0) {
      $("bubble-msg").innerText = tips[(popped / 4 - 1) % tips.length];
    }
  }
  grid.addEventListener("click", (e) => pop(e.target.closest(".bubble")));
  grid.addEventListener("pointerover", (e) => {
    if (e.buttons === 1) pop(e.target.closest(".bubble"));
  });
  $("bubble-reset").addEventListener("click", () => {
    grid
      .querySelectorAll(".bubble")
      .forEach((b) => b.classList.remove("popped"));
    popped = 0;
    update();
    $("bubble-msg").innerText =
      "Gelembungnya udah ditiup lagi. Pecahkan lagi sesukamu ya";
    playPaperSound();
  });

  let lanterns = 0;
  function release() {
    const input = $("lantern-input"),
      sky = $("lantern-sky");
    const l = document.createElement("div");
    l.className = "lantern";
    l.style.setProperty("--x", `${8 + Math.random() * 72}%`);
    const label = document.createElement("i");
    label.innerText = input.value.trim() || "lega";
    l.appendChild(label);
    sky.appendChild(l);
    while (sky.children.length > 6) sky.firstChild.remove();
    l.addEventListener("animationend", () => l.remove(), { once: true });
    input.value = "";
    $("lantern-count").innerText = `${++lanterns} terbang`;
    playLanternSound();
  }
  $("lantern-btn").addEventListener("click", release);
  $("lantern-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") release();
  });
})();

/* ---------- Bab 7: kompas ketenangan ---------- */
(function mindfulCompass() {
  const needle = $("compass-needle");
  if (!needle) return;
  const DIRS = [
    [
      "U",
      "Utara",
      "Fokus pada yang bisa kamu kendalikan",
      "Ada hal-hal yang memang tidak bisa kita genggam sampai akhir. Usahamu sudah selesai di titik itu; sisanya, biarkan dunia yang menyelesaikan bagiannya.",
      "Kamu sudah berjalan sejauh ini, Maul. Dan itu tidak pernah kecil. 😌💜",
    ],
    [
      "TL",
      "Timur Laut",
      "Proses lebih jujur daripada hasil",
      "Angka memang bisa naik dan turun seperti pasang surut, tetapi malam-malam ketika kamu memilih untuk tetap belajar tidak akan pernah hilang begitu saja. Ia tinggal di dalam dirimu, diam-diam membentuk versi dirimu yang lebih kuat.",
      "Allah melihat proses itu, dan Allah bangga padamu. 🤍",
    ],
    [
      "T",
      "Timur",
      "Setiap hari adalah fajar baru",
      "Hari kemarin mungkin meninggalkan jejak, tetapi ia tidak berhak menentukan seluruh langkahmu hari ini. Bangun pelan-pelan, minum air, lalu jalani satu hal kecil dengan baik.",
      "Matahari terbit lagi, dan pagi ini datang khusus untukmu, Maul. ✨",
    ],
    [
      "TG",
      "Tenggara",
      "Istirahat adalah bagian dari perjalanan",
      "Pelari terbaik pun tahu kapan harus berhenti sejenak untuk minum. Berhenti bukan berarti kalah; kadang, itu cara tubuhmu meminta ruang untuk kembali utuh.",
      "Rebahan sebentar tidak apa-apa, Maul. Dunia tidak akan lari entah ke mana. 🌙💜",
    ],
    [
      "S",
      "Selatan",
      "Mengikhlaskan bukan berarti menyerah",
      "Melepas sesuatu bukan berarti tanganmu kosong. Kadang, justru setelah melepaskan, kamu baru sadar ada banyak hal baik lain yang menunggu untuk digenggam.",
      "Ikhlas itu bukan tanda lemah, Maul. Ikhlas itu bentuk keberanian yang paling tenang. 💜",
    ],
    [
      "BD",
      "Barat Daya",
      "Cemas itu tamu, bukan penghuni",
      "Biarkan kecemasan duduk sebentar jika ia memang datang. Beri ia teh, dengarkan ia bicara, lalu pamitkan dengan tenang. Kamu tidak perlu memberinya kamar untuk tinggal selamanya.",
      "Ia akan lewat, Maul. Dan kamu tetap di sini, utuh seperti biasa. 🫶",
    ],
    [
      "B",
      "Barat",
      "Bandingkan dirimu hanya dengan dirimu kemarin",
      "Jalan orang lain bukan peta yang harus kamu ikuti. Mereka punya langkahnya, dan kamu punya jalurmu sendiri dengan kecepatan, luka, serta cerita yang tidak bisa dibandingkan.",
      "Kamu hari ini sudah melangkah lebih jauh daripada dirimu yang kemarin. Itu cukup. 💜",
    ],
    [
      "BL",
      "Barat Laut",
      "Apa pun hasilnyaa, kamu tetap utuh",
      "Ada pengumuman yang bisa membuat hati berdebar, tetapi tidak ada satu angka pun yang berhak menentukan berapa hargamu sebagai manusia. Kamu tetap Maul, sebelum dan sesudah semuanya.",
      "Kamu berharga bukan karena hasilnya. Kamu berharga karena kamu. Borahae. 💜",
    ],
  ];
  const face = $("compass-face"),
    dial = $("compass-dial"),
    btn = $("compass-spin"),
    res = $("compass-result");
  DIRS.forEach((d, i) => {
    const l = document.createElement("span");
    l.className = "compass-label";
    l.style.setProperty("--a", `${i * 45}deg`);
    l.innerText = d[0];
    face.insertBefore(l, needle);
  });
  const labels = face.querySelectorAll(".compass-label"),
    seen = new Set();
  let rot = 0,
    spinning = false;
  function spin() {
    if (spinning) return;
    spinning = true;
    btn.disabled = true;
    res.classList.remove("show");
    labels.forEach((l) => l.classList.remove("lit"));
    dial.classList.add("spinning");
    const D = reduceMotion ? 500 : 4200,
      add = 1440 + Math.random() * 360,
      n = Math.round(add / 45);
    rot += add;
    needle.style.transition = `transform ${D}ms cubic-bezier(.12,.7,.1,1)`;
    needle.style.transform = `rotate(${rot}deg)`;
    for (let i = 1; i <= n; i++)
      setTimeout(playCompassTickSound, D * (1 - Math.pow(1 - i / n, 1 / 3)));
    setTimeout(settle, D + 60);
  }
  function settle() {
    const norm = ((rot % 360) + 360) % 360,
      idx = Math.round(norm / 45) % 8,
      delta = ((idx * 45 - norm + 540) % 360) - 180;
    rot += delta; /* jarum "mengunci" magnetis ke arah terdekat */
    needle.style.transition = "transform .4s cubic-bezier(.3,1.6,.5,1)";
    needle.style.transform = `rotate(${rot}deg)`;
    labels[idx].classList.add("lit");
    playCompassSettleSound();
    const d = DIRS[idx];
    res.innerHTML = `<h3>🧭 ${d[1]}: ${d[2]}</h3><p>${d[3]}</p><p class="aff">${d[4]}</p>`;
    retrigger(res, ["show"]);
    seen.add(idx);
    $("compass-found").innerText = `${seen.size} / 8 arah ditemukan`;
    dial.classList.remove("spinning");
    btn.disabled = false;
    spinning = false;
    if (seen.size === 8) {
      setTimeout(playAchievementSound, 500);
      launchPurpleBalloons();
    }
  }
  btn.addEventListener("click", spin);
  dial.addEventListener("click", spin);
})();

/* ---------- Bab 8: Campus Quest · Dynamic Checklist & Personal Planner ---------- */
(function campusNotebook() {
  const nb = $("campus-notebook");
  if (!nb) return;
  const STORE_KEY = "jsm-campus-planner-v1",
    MAX_PER_TAB = 50,
    tabs = [...nb.querySelectorAll('[role="tab"]')],
    panels = [...nb.querySelectorAll('[role="tabpanel"]')],
    lists = [...nb.querySelectorAll(".nb-list")],
    keys = lists.map((l) => l.dataset.key),
    input = $("nb-input"),
    preview = $("nb-preview"),
    msg = $("nb-msg"),
    resetBtn = $("nb-reset"),
    resetLabel = resetBtn.innerText;

  /* ----- Suara (Web Audio API murni) ----- */
  const sndCheck = safe((on) =>
    on
      ? seq([987.77, 1318.5, 1760], 65, {
          dur: 0.55,
          gain: 0.055,
        }) /* golden chime */
      : tone(520, 0.12, { type: "triangle", gain: 0.06, to: 400 }),
  );
  const sndDelete = safe(() => {
    /* paper rustle + soft pop */
    noiseBurst(0.24, { freq: 1800, sweepTo: 5200, q: 0.6, gain: 0.1 });
    tone(320, 0.09, { type: "triangle", gain: 0.1, to: 120 });
  });
  const sndAdd = safe(() => {
    /* tink + goresan pena */
    tone(1760, 0.07, { type: "triangle", gain: 0.05 });
    noiseBurst(0.09, { type: "highpass", freq: 3500, gain: 0.05 });
    setTimeout(
      safe(() => tone(2093, 0.1, { type: "triangle", gain: 0.04 })),
      70,
    );
  });

  /* ----- Rich text parser: **tebal**, *miring*, ==highlight==, <b> <i> <mark> ----- */
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function rich(raw) {
    return esc(String(raw))
      .replace(
        /&lt;(\/?)(b|strong|i|em|mark)&gt;/gi,
        (m, c, t) => `<${c}${t.toLowerCase()}>`,
      )
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/==(.+?)==/g, "<mark>$1</mark>")
      .replace(/\*([^*\s](?:[^*]*[^*\s])?)\*/g, "<i>$1</i>");
  }

  /* ----- State & localStorage ----- */
  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let persistOK = true;
  /* Item bawaan dibaca dari <li> di index.html, jadi isi awal tetap bisa diedit di HTML */
  const SEED = {};
  lists.forEach((ul) => {
    SEED[ul.dataset.key] = [...ul.children].map((li) =>
      li.innerHTML
        .trim()
        .replace(/\s+/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&"),
    );
  });
  const fresh = () => ({
    active: 0,
    data: Object.fromEntries(
      keys.map((k) => [
        k,
        SEED[k].map((text) => ({ id: uid(), text, checked: false })),
      ]),
    ),
  });
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && s.data && keys.every((k) => Array.isArray(s.data[k]))) {
        return {
          active: Math.min(Math.max(+s.active || 0, 0), tabs.length - 1),
          data: Object.fromEntries(
            keys.map((k) => [
              k,
              s.data[k].map((x) => ({
                id: String(x.id || uid()),
                text: String(x.text || "").slice(0, 300),
                checked: !!x.checked,
              })),
            ]),
          ),
        };
      }
    } catch (e) {}
    return fresh();
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      persistOK = true;
    } catch (e) {
      persistOK = false;
    }
  }
  let state = load(),
    wasComplete = false;

  /* ----- Render ----- */
  function makeRow(item, enter) {
    const li = document.createElement("li"),
      label = document.createElement("label"),
      cb = document.createElement("input"),
      span = document.createElement("span"),
      del = document.createElement("button");
    li.className = "nb-row" + (enter && !reduceMotion ? " entering" : "");
    li.dataset.id = item.id;
    label.className = "nb-item";
    cb.type = "checkbox";
    cb.checked = item.checked;
    span.className = "nb-text";
    span.innerHTML = rich(item.text);
    label.append(cb, span);
    del.type = "button";
    del.className = "nb-del";
    del.innerText = "🗑️";
    del.setAttribute("aria-label", `Hapus: ${span.textContent}`);
    li.append(label, del);
    return li;
  }
  function syncEmpty(ul) {
    const has = ul.querySelector(".nb-row:not(.leaving)"),
      e = ul.querySelector(".nb-empty");
    if (has && e) e.remove();
    if (!has && !e) {
      const li = document.createElement("li");
      li.className = "nb-empty";
      li.innerText = "Belum ada item. Tulis satu di bawah ✨";
      ul.appendChild(li);
    }
  }
  function renderAll() {
    lists.forEach((ul) => {
      ul.replaceChildren(
        ...state.data[ul.dataset.key].map((it) => makeRow(it, false)),
      );
      syncEmpty(ul);
    });
  }
  function progress(initial) {
    const all = keys.flatMap((k) => state.data[k]),
      t = all.length,
      n = all.filter((x) => x.checked).length,
      complete = t > 0 && n === t;
    $("nb-count").innerText = `${n} / ${t}`;
    $("nb-bar").style.width = t ? `${(n / t) * 100}%` : "0%";
    if (complete) {
      msg.innerHTML = '<span class="nb-stamp">MABA SIAP TEMPUR!</span>';
      if (!wasComplete && !initial) {
        playAchievementSound();
        launchPurpleBalloons();
      }
    } else {
      msg.innerText = !persistOK
        ? "⚠️ Penyimpanan peramban tidak aktif, daftar tidak akan tersimpan."
        : t === 0
          ? "Belum ada item. Tambahkan yang pertama!"
          : n > 0 && n >= t / 2
            ? "Sudah separuh jalan, lanjut terus!"
            : "";
    }
    wasComplete = complete;
  }

  /* ----- Tab ----- */
  function select(i, focus, silent) {
    state.active = i;
    tabs.forEach((t, j) => {
      t.setAttribute("aria-selected", j === i);
      t.tabIndex = j === i ? 0 : -1;
      panels[j].hidden = j !== i;
    });
    input.placeholder = lists[i].dataset.placeholder || "Tambah item baru…";
    input.setAttribute(
      "aria-label",
      `Tambah item ke ${tabs[i].innerText.trim()}`,
    );
    if (focus) tabs[i].focus();
    if (!silent) {
      playPaperSound();
      save();
    }
  }
  tabs.forEach((t, i) => t.addEventListener("click", () => select(i)));
  nb.querySelector('[role="tablist"]').addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.stopPropagation(); /* jangan ikut membalik halaman buku */
    e.preventDefault();
    const i = tabs.indexOf(document.activeElement);
    select(
      (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length,
      true,
    );
  });

  /* ----- Centang & hapus (event delegation) ----- */
  const findItem = (li) => {
    const key = li.closest(".nb-list").dataset.key;
    return { key, item: state.data[key].find((x) => x.id === li.dataset.id) };
  };
  nb.addEventListener("change", (e) => {
    const li = e.target.closest(".nb-row");
    if (!li || e.target.type !== "checkbox") return;
    const { item } = findItem(li);
    if (!item) return;
    item.checked = e.target.checked;
    save();
    sndCheck(item.checked);
    progress();
  });
  nb.addEventListener("click", (e) => {
    const del = e.target.closest(".nb-del");
    if (!del) return;
    const li = del.closest(".nb-row");
    if (li.classList.contains("leaving")) return;
    const ul = li.closest(".nb-list"),
      { key } = findItem(li);
    state.data[key] = state.data[key].filter((x) => x.id !== li.dataset.id);
    save();
    progress();
    sndDelete();
    li.style.maxHeight = `${li.offsetHeight}px`;
    void li.offsetWidth;
    li.classList.add("leaving");
    setTimeout(
      () => {
        li.remove();
        syncEmpty(ul);
      },
      reduceMotion ? 0 : 430,
    );
  });

  /* ----- Tambah item + toolbar format ----- */
  function add() {
    const text = input.value.trim(),
      key = keys[state.active],
      ul = lists[state.active];
    if (!text) {
      input.focus();
      return;
    }
    if (state.data[key].length >= MAX_PER_TAB) {
      msg.innerText = `Daftar ini sudah penuh (maksimal ${MAX_PER_TAB} item).`;
      return;
    }
    const item = { id: uid(), text: text.slice(0, 300), checked: false };
    state.data[key].push(item);
    const row = makeRow(item, true);
    ul.querySelector(".nb-empty")?.remove();
    ul.appendChild(row);
    row.scrollIntoView({
      block: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    input.value = "";
    updatePreview();
    save();
    progress();
    sndAdd();
    input.focus();
  }
  function updatePreview() {
    const v = input.value.trim();
    preview.hidden = !v;
    if (v) preview.innerHTML = rich(v);
  }
  function wrap(mark) {
    const v = input.value,
      s = input.selectionStart ?? v.length,
      e = input.selectionEnd ?? s,
      sel = v.slice(s, e),
      n = mark.length;
    const wrapped =
      sel &&
      v.slice(s - n, s) === mark &&
      v.slice(e, e + n) === mark &&
      !(mark === "*" && v[s - 2] === "*");
    if (wrapped) {
      input.value = v.slice(0, s - n) + sel + v.slice(e + n);
      input.setSelectionRange(s - n, e - n);
    } else {
      input.value = v.slice(0, s) + mark + sel + mark + v.slice(e);
      input.setSelectionRange(s + n, e + n);
    }
    input.focus();
    updatePreview();
    tone(1568, 0.05, { type: "triangle", gain: 0.04 });
  }
  const toolbar = nb.querySelector(".nb-toolbar");
  toolbar.addEventListener("mousedown", (e) => {
    if (e.target.closest(".nb-fmt"))
      e.preventDefault(); /* pertahankan fokus & seleksi teks */
  });
  toolbar.addEventListener("click", (e) => {
    const b = e.target.closest(".nb-fmt");
    if (b) wrap(b.dataset.fmt);
  });
  input.addEventListener("input", updatePreview);
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "i")) {
      e.preventDefault();
      wrap(e.key === "b" ? "**" : "*");
    }
  });
  $("nb-add").addEventListener("click", add);

  /* ----- Kembalikan bawaan (konfirmasi 2 langkah) ----- */
  let armed = 0;
  resetBtn.addEventListener("click", () => {
    if (!armed) {
      resetBtn.innerText = "Yakin? Klik lagi";
      armed = setTimeout(() => {
        resetBtn.innerText = resetLabel;
        armed = 0;
      }, 3200);
      return;
    }
    clearTimeout(armed);
    armed = 0;
    resetBtn.innerText = resetLabel;
    state = fresh();
    save();
    renderAll();
    select(0, false, true);
    progress(true);
    sndDelete();
  });

  /* ----- Sinkron antar tab browser & inisialisasi ----- */
  addEventListener("storage", (e) => {
    if (e.key !== STORE_KEY) return;
    state = load();
    renderAll();
    select(state.active, false, true);
    progress(true);
  });
  renderAll();
  select(state.active, false, true);
  save(); /* simpan keadaan awal agar item bawaan langsung persisten */
  progress(true);
})();

/* ---------- Bab 9: BTS Magic Shop ---------- */
(function magicShop() {
  const shelf = $("burden-shelf");
  if (!shelf) return;
  const BURDENS = [
    {
      id: "tugas",
      icon: "📚",
      name: "Tumpukan Tugas",
      potion: "Potion Fokus Bintang",
      pc: "#60a5fa",
      fx: { fokus: 25, energi: 8 },
      d: "Tugas yang tadinya menumpuk seperti awan mendung, perlahan berubah menjadi langkah kecil yang bisa dilalui satu per satu.",
    },
    {
      id: "canggung",
      icon: "🫣",
      name: "Rasa Canggung",
      potion: "Potion Percaya Diri Bersinar",
      pc: "#f472b6",
      fx: { berani: 25, tenang: 8 },
      d: "Menyapa orang baru tidak lagi terasa seperti berjalan di atas jembatan rapuh; ia mulai terasa semudah menyapa teman lama.",
    },
    {
      id: "capek",
      icon: "😴",
      name: "Capek",
      potion: "Potion Pelukan Senja",
      pc: "#34d399",
      fx: { tenang: 20, energi: 12 },
      d: "Tubuh yang lelah diberi ruang untuk berhenti sejenak, seperti pelari yang akhirnya menemukan bangku kosong di bawah langit senja.",
    },
    {
      id: "ovt",
      icon: "🌧️",
      name: "Overthinking",
      potion: "Potion Sejati",
      pc: "#d4af37",
      fx: { fokus: 12, berani: 12, tenang: 12, energi: 12 },
      d: "Pikiran yang terlalu lama berputar akhirnya menemukan jalan keluar; seperti hujan yang berhenti dan meninggalkan udara yang lebih ringan untuk ditarik napas.",
    },
  ];
  const STATS = {
    fokus: "🎯 Fokus",
    berani: "🦁 Keberanian",
    tenang: "🌙 Ketenangan",
    energi: "⚡ Energi",
  };
  const RANKS = [
    "Murid Baru",
    "Penyihir Magang",
    "Peracik Potion",
    "Master Borahae",
    "Penyihir Agung",
  ];
  const vals = { fokus: 20, berani: 20, tenang: 20, energi: 20 },
    done = new Set(),
    btn = $("brew-btn"),
    card = $("potion-card");
  let sel = null,
    brewing = false;
  BURDENS.forEach((b) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "burden";
    el.dataset.id = b.id;
    el.innerHTML = `<span>${b.icon}</span><span>${b.name}</span>`;
    el.addEventListener("click", () => {
      if (brewing || done.has(b.id)) return;
      sel = b;
      shelf
        .querySelectorAll(".burden")
        .forEach((x) => x.classList.toggle("selected", x === el));
      btn.disabled = false;
      playPaperSound();
    });
    shelf.appendChild(el);
  });
  const statBox = $("shop-stats");
  Object.keys(STATS).forEach((k) => {
    const r = document.createElement("div");
    r.className = "stat-row";
    r.id = `stat-${k}`;
    r.innerHTML = `<span>${STATS[k]}</span><div class="jm-bar"><i style="width:${vals[k]}%"></i></div><b>${vals[k]}</b>`;
    statBox.appendChild(r);
  });
  function render() {
    Object.keys(vals).forEach((k) => {
      const r = $(`stat-${k}`);
      r.querySelector("i").style.width = `${vals[k]}%`;
      r.querySelector("b").innerText = vals[k];
    });
    $("shop-level").innerText = `Lv. ${1 + done.size} · ${RANKS[done.size]}`;
  }
  btn.addEventListener("click", () => {
    if (!sel || brewing) return;
    brewing = true;
    btn.disabled = true;
    const b = sel;
    $("cauldron").classList.add("brewing");
    card.innerHTML = "<p>Meracik… gelembung ajaib mulai muncul ✨</p>";
    [0, 280, 560, 840, 1120].forEach((t) => setTimeout(playBubblePopSound, t));
    setTimeout(() => {
      $("cauldron").classList.remove("brewing");
      playPotionSound();
      const fx = Object.entries(b.fx);
      fx.forEach(([k, v]) => {
        vals[k] = Math.min(100, vals[k] + v);
        retrigger($(`stat-${k}`), ["boost"]);
      });
      card.style.setProperty("--pc", b.pc);
      card.innerHTML = `<h3>🧪 ${b.potion}</h3><p>${b.d}</p><p class="fx">${fx.map(([k, v]) => `+${v} ${STATS[k].split(" ")[1]}`).join(" · ")}</p>`;
      retrigger(card, ["fresh"]);
      done.add(b.id);
      const el = shelf.querySelector(`[data-id="${b.id}"]`);
      el.classList.remove("selected");
      el.classList.add("done");
      el.insertAdjacentText("beforeend", " ✓");
      sel = null;
      brewing = false;
      render();
      if (done.size === BURDENS.length) {
        const lv = document.createElement("p");
        lv.className = "levelup";
        lv.innerText = "✨ LEVEL UP! Semua beban sudah jadi semangat ✨";
        card.appendChild(lv);
        setTimeout(playAchievementSound, 600);
        launchPurpleBalloons();
      }
    }, 1500);
  });
})();

/* ---------- Bab 10: konstelasi impian & kapsul waktu ---------- */
(function constellation() {
  const cv = $("constellation");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const STARS = [
    { x: 0.08, y: 0.8, n: "Berani", t: "Berani mencoba, walau belum yakin." },
    { x: 0.22, y: 0.58, n: "Tenang", t: "Tenang menunggu hasil, apa pun itu." },
    {
      x: 0.34,
      y: 0.76,
      n: "Masa Depan",
      t: "Melangkah ke masa depan dengan kepala tegak.",
    },
    {
      x: 0.47,
      y: 0.5,
      n: "Sahabat",
      t: "Bertemu teman seperjuangan yang tulus.",
    },
    {
      x: 0.58,
      y: 0.7,
      n: "IPK Emas",
      t: "Belajar dengan cara yang sehat dan konsisten.",
    },
    { x: 0.7, y: 0.42, n: "Magang", t: "Pengalaman pertama di dunia kerja." },
    { x: 0.82, y: 0.6, n: "Bangga", t: "Membuat orang tua tersenyum bangga." },
    {
      x: 0.9,
      y: 0.22,
      n: "Maulia ✨",
      t: "Menjadi Maulia yang utuh dan bersinar.",
    },
  ];
  const PAD = 28;
  let W = 0,
    H = 0,
    next = 0,
    bg = [],
    shoots = [],
    running = false,
    finished = false;
  const pos = (i) => ({
    x: PAD + STARS[i].x * (W - PAD * 2),
    y: PAD + STARS[i].y * (H - PAD * 2),
  });
  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bg = Array.from({ length: 55 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.4 + Math.random() * 1.1,
      p: Math.random() * 6.28,
    }));
    frame(performance.now());
  }
  function frame(t) {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    bg.forEach((s) => {
      ctx.fillStyle = `rgba(243,232,255,${0.3 + 0.4 * Math.sin(t / 700 + s.p)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.283);
      ctx.fill();
    });
    if (next > 1) {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(246,231,166,${finished ? 0.75 + 0.2 * Math.sin(t / 400) : 0.85})`;
      ctx.shadowColor = "#d4af37";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let i = 0; i < next; i++) {
        const p = pos(i);
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = "center";
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    STARS.forEach((s, i) => {
      const p = pos(i),
        lit = i < next;
      if (lit) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
        g.addColorStop(0, "rgba(255,243,196,.95)");
        g.addColorStop(1, "rgba(212,175,55,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = "#fff3c4";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.5, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = "#f6e7a6";
        ctx.fillText(
          s.n,
          Math.min(W - 30, Math.max(30, p.x)),
          p.y + (i % 2 ? -14 : 20),
        );
      } else {
        ctx.fillStyle = "rgba(196,181,253,.75)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, 6.283);
        ctx.fill();
        if (i === next && !finished) {
          ctx.strokeStyle = `rgba(246,231,166,${0.5 + 0.4 * Math.sin(t / 220)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 9 + 3 * Math.sin(t / 220), 0, 6.283);
          ctx.stroke();
        }
      }
    });
    if (finished && !reduceMotion && Math.random() < 0.012)
      shoots.push({
        x: Math.random() * W * 0.6,
        y: Math.random() * H * 0.4,
        life: 1,
      });
    shoots = shoots.filter((s) => s.life > 0);
    shoots.forEach((s) => {
      ctx.strokeStyle = `rgba(255,255,255,${s.life})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - 28, s.y - 14);
      ctx.stroke();
      s.x += 6;
      s.y += 3;
      s.life -= 0.03;
    });
  }
  function loop(t) {
    if (state.currentChapter !== 11 || document.hidden) {
      running = false;
      return;
    }
    frame(t);
    requestAnimationFrame(loop);
  }
  function start() {
    if (reduceMotion || running) return;
    running = true;
    requestAnimationFrame(loop);
  }
  window.enterConstellation = () => {
    resize();
    start();
  };
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.currentChapter === 11) start();
  });

  function connect() {
    if (finished) return;
    playStarSound(next);
    $("const-caption").innerText = `⭐ ${next + 1}. ${STARS[next].t}`;
    next++;
    $("const-count").innerText = `${next} / ${STARS.length} bintang`;
    if (next === STARS.length) {
      finished = true;
      playAchievementSound();
      launchPurpleBalloons();
      $("epilogue").hidden = false;
      $("epilogue").scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "nearest",
      });
    }
    frame(performance.now());
  }
  cv.addEventListener("pointerdown", (e) => {
    const r = cv.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    const hit = STARS.findIndex(
      (s, i) => Math.hypot(pos(i).x - x, pos(i).y - y) < 24,
    );
    if (hit < 0 || finished) return;
    if (hit === next) connect();
    else if (hit > next) {
      playSoftNopeSound();
      $("const-caption").innerText = "Ikuti bintang yang berdenyut dulu ya ✨";
    }
  });
  cv.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    connect();
  });
  $("const-reset").addEventListener("click", () => {
    next = 0;
    finished = false;
    $("const-count").innerText = `0 / ${STARS.length} bintang`;
    $("const-caption").innerText =
      "Ketuk bintang yang berdenyut untuk memulai ✨";
    $("epilogue").hidden = true;
    playPaperSound();
    frame(performance.now());
  });

  /* Kapsul waktu: pesan disimpan di peramban ini (localStorage) */
  const KEY = "jsm-time-capsule",
    inp = $("capsule-input"),
    cbtn = $("capsule-btn"),
    status = $("capsule-status");
  const opens = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 5);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  function lock(text) {
    inp.disabled = cbtn.disabled = true;
    cbtn.innerText = "🔒 Terkunci";
    status.innerText = text;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved)
      lock(`Kapsulmu sudah terkunci rapi. Sampai jumpa di ${saved.open}. 💜`);
  } catch (e) {}
  cbtn.addEventListener("click", () => {
    const text = inp.value.trim() || "Aku bangga sama kamu, Maul.",
      open = opens();
    try {
      localStorage.setItem(KEY, JSON.stringify({ text, open, at: Date.now() }));
    } catch (e) {}
    const r = cbtn.getBoundingClientRect(),
      c = document.createElement("div");
    c.className = "capsule-fly";
    c.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top}px`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 1900);
    playAchievementSound();
    lock(`Kapsul terkunci! Sampai jumpa di ${open}, Maul. 💜`);
  });
})();
