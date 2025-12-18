(() => {
  const qs = new URLSearchParams(location.search);
  const duration = parseInt(qs.get('seconds') || '60', 10) || 60;
  const asciiEl = document.getElementById('ascii');
  const asciiSourceEl = document.getElementById('asciiSource');
  const asciiDetailEl = document.getElementById('asciiDetail');
  const musicSourceEl = document.getElementById('musicSource');
  const musicDetailEl = document.getElementById('musicDetail');
  const countdownEl = document.getElementById('countdown');
  const playbackStateEl = document.getElementById('playbackState');
  const chipsEl = document.getElementById('chips');
  const errorsEl = document.getElementById('errors');
  const asciiPicker = document.getElementById('asciiPicker');
  const musicPicker = document.getElementById('musicPicker');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const nextBtn = document.getElementById('nextBtn');
  const rotateToggle = document.getElementById('rotateToggle');
  const loopToggle = document.getElementById('loopToggle');
  const muteBtn = document.getElementById('muteBtn');
  const volumeEl = document.getElementById('volume');
  const prevTrackBtn = document.getElementById('prevTrack');
  const nextTrackBtn = document.getElementById('nextTrack');
  const dropZone = document.getElementById('dropZone');

  const embeddedArts = [
    `  ***     ***\n *****   *****\n******* *******\n****************\n \"I LOVE YOU\"\n****************\n ******* *******\n  *****   *****\n   ***     ***`,
    `  _   _   _   _\n ( \\ / ) ( \\ / )\n  \/ \/   \/ \/\n  _|_|_   _|_|_\n (     ) (     )\n  \   /   \   /\n   \ /     \ /\n    v       v\n   LOVE     LOVE`,
    `.-''''-.   .-''''-.\n/  .-.  \\/  .-.  \\\n| |  | |  | |  | |\n\ \\_/ /  \ \\_/ /\n '.   ;    '.   ;\n   ) (        ) (\n .'   '.    .'   '.\n/ love  \  / you   \\\n'-------'  '-------'\n-----FRAME-----\n .-''''-.   .-''''-.\n/  .-.  \\/  .-.  \\\n| |  | |  | |  | |\n| |  | |  | |  | |\n| |  | |  | |  | |\n \ \\_/ /  \ \\_/ /\n  '---'    '---'\n   LOVE     YOU`
  ];

  const state = {
    asciiPlaylist: [],
    audioPlaylist: [],
    autoRotate: true,
    loopPlaylist: true,
    running: false,
    tick: 0,
    currentAsciiIndex: 0,
    currentFrameIndex: 0,
    transition: null,
    startTimePerf: 0,
    startTimeWall: 0,
    timer: null,
    duration,
    muted: false,
    audioCtx: null,
    synthGain: null,
    synthNodes: [],
    synthTimer: null,
    audioEl: new Audio(),
    currentTrack: 0,
  };

  function setError(msg) {
    const p = document.createElement('div');
    p.textContent = msg;
    errorsEl.appendChild(p);
  }
  function clearErrors() { errorsEl.textContent = ''; }

  function renderChips() {
    const items = [];
    const asciiNames = state.asciiPlaylist.map((a, i) => `${i + 1}. ${a.detail}`).slice(0, 3);
    if (asciiNames.length) {
      items.push(...asciiNames);
      if (state.asciiPlaylist.length > asciiNames.length) items.push(`+${state.asciiPlaylist.length - asciiNames.length} more`);
    }
    if (state.audioPlaylist.length) {
      const names = state.audioPlaylist.map(t => t.name).slice(0, 2);
      items.push(`Music: ${state.audioPlaylist.length} track(s)`);
      items.push(...names);
      if (state.audioPlaylist.length > names.length) items.push(`+${state.audioPlaylist.length - names.length} more`);
    } else {
      items.push('Music: Synth pad');
    }

    chipsEl.innerHTML = '';
    items.forEach(txt => {
      const span = document.createElement('span');
      span.className = 'chip';
      span.textContent = txt;
      chipsEl.appendChild(span);
    });
  }

  function splitFrames(text) {
    const marker = '-----FRAME-----';
    if (text.includes(marker)) {
      return text.split(marker).map(f => f.trim()).filter(Boolean);
    }
    return [text.trim()];
  }

  function addAscii(text, source, detail) {
    const frames = splitFrames(text);
    state.asciiPlaylist.push({ source, detail, frames });
    asciiSourceEl.textContent = source;
    asciiDetailEl.textContent = detail;
  }

  function parseList(val) {
    if (!val) return [];
    return val.split(',').map(s => s.trim()).filter(Boolean);
  }

  function setPlaybackState(msg) { playbackStateEl.textContent = msg; }

  function updateCountdown(remain) { countdownEl.textContent = `${remain}s`; }

  function applyWave(lines, t) {
    const amp = 2 + Math.sin(t * 0.05) * 1.2;
    return lines.map((line, i) => {
      const shift = Math.round(Math.sin(t * 0.18 + i * 0.55) * amp);
      if (shift > 0) return ' '.repeat(shift) + line;
      const drop = Math.min(-shift, line.length);
      return line.slice(drop) + ' '.repeat(drop);
    });
  }
  function applyBob(lines, t) {
    if (Math.sin(t * 0.12) <= 0.35) return lines;
    return [' '.repeat(lines[0]?.length || 0), ...lines].slice(0, lines.length);
  }
  function maybeSparkle(lines, t) {
    if (t % 6 !== 0) return lines;
    const y = Math.floor(Math.random() * lines.length);
    const x = Math.floor(Math.random() * Math.max(1, lines[0]?.length || 1));
    const chars = lines[y].split('');
    if (chars[x] === ' ') { chars[x] = t % 12 === 0 ? '*' : '+'; }
    lines[y] = chars.join('');
    return lines;
  }
  function padLines(lines, width, height) {
    const copy = [...lines];
    while (copy.length < height) copy.push('');
    if (copy.length > height) copy.length = height;
    return copy.map(line => line.padEnd(width, ' '));
  }
  function wipeLTR(from, to, p) {
    const cut = Math.floor(from[0].length * p);
    return from.map((line, idx) => to[idx].slice(0, cut) + line.slice(cut));
  }
  function wipeCenter(from, to, p) {
    const width = from[0].length;
    const half = Math.floor((width / 2) * p);
    const c = Math.floor(width / 2);
    return from.map((line, idx) => {
      const chars = line.split('');
      const target = to[idx];
      for (let i = Math.max(0, c - half); i <= Math.min(width - 1, c + half); i++) {
        chars[i] = target[i];
      }
      return chars.join('');
    });
  }
  function smoothstep(x) {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  }
  function computeCanvas() {
    let w = 40, h = 10;
    state.asciiPlaylist.forEach(item => item.frames.forEach(f => {
      const lines = f.split('\n');
      h = Math.max(h, lines.length);
      lines.forEach(line => { w = Math.max(w, line.length); });
    }));
    return { w, h };
  }

  async function fetchText(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      setError(`ASCII load failed for ${url}: ${err.message} (likely CORS on file://).`);
      return null;
    }
  }

  async function loadAsciiFromParams() {
    const inline = qs.get('ascii');
    const asciiSrc = qs.get('asciiSrc');
    const asciiList = parseList(qs.get('asciiList'));

    if (inline) {
      state.autoRotate = false;
      rotateToggle.checked = false;
      addAscii(decodeURIComponent(inline), 'Inline', 'ascii=');
      return;
    }

    if (asciiSrc) {
      const txt = await fetchText(asciiSrc);
      if (txt) {
        state.autoRotate = false;
        rotateToggle.checked = false;
        addAscii(txt, 'URL', asciiSrc);
      }
    }

    if (asciiList.length) {
      const loaded = await Promise.all(asciiList.map(src => fetchText(src)));
      loaded.forEach((txt, i) => { if (txt) addAscii(txt, 'URL', asciiList[i]); });
    }
  }

  async function loadPlaylistFromParams() {
    const list = parseList(qs.get('playlist'));
    const playlistUrl = qs.get('playlistUrl');
    const single = qs.get('music');
    if (single) list.unshift(single);

    if (playlistUrl) {
      try {
        const res = await fetch(playlistUrl);
        const arr = await res.json();
        if (Array.isArray(arr)) list.push(...arr);
      } catch (err) {
        setError(`Playlist URL failed (${playlistUrl}): ${err.message}`);
      }
    }

    state.audioPlaylist = list.map(url => ({ type: 'url', url, name: url.split('/').pop() || url }));
    if (state.audioPlaylist.length) {
      musicSourceEl.textContent = 'URL';
      musicDetailEl.textContent = `${state.audioPlaylist.length} track(s)`;
    }
    renderChips();
  }

  function setAsciiChips() { renderChips(); }

  function startSynth() {
    if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = state.audioCtx;
    if (state.synthGain) return;
    const gain = ctx.createGain();
    gain.gain.value = parseFloat(volumeEl.value);
    gain.connect(ctx.destination);
    const notesA = [261.6, 329.6, 392.0];
    const notesB = [277.2, 349.2, 415.3];
    const makeOsc = (freq) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.value = 0.22;
      osc.connect(g).connect(gain);
      osc.start();
      return { osc, g };
    };
    const setChord = (notes) => {
      state.synthNodes.forEach(({ osc }, i) => { osc.frequency.setTargetAtTime(notes[i % notes.length], ctx.currentTime, 0.5); });
    };
    state.synthNodes = notesA.map(n => makeOsc(n));
    let flip = false;
    state.synthTimer = setInterval(() => { flip = !flip; setChord(flip ? notesB : notesA); }, 5200);
    state.synthGain = gain;
    musicSourceEl.textContent = 'Synth';
    musicDetailEl.textContent = 'Offline pad';
  }

  function stopSynth() {
    if (state.synthTimer) clearInterval(state.synthTimer);
    state.synthTimer = null;
    state.synthNodes.forEach(({ osc, g }) => { try { g.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + 0.3); osc.stop(state.audioCtx.currentTime + 0.35); } catch (_) {} });
    state.synthNodes = [];
    state.synthGain = null;
  }

  function updateVolume(v) {
    state.audioEl.volume = v;
    if (state.synthGain) state.synthGain.gain.setTargetAtTime(state.muted ? 0 : v, state.audioCtx?.currentTime || 0, 0.05);
  }

  function playTrack(idx) {
    if (!state.audioPlaylist.length) return false;
    state.currentTrack = (idx + state.audioPlaylist.length) % state.audioPlaylist.length;
    const track = state.audioPlaylist[state.currentTrack];
    stopSynth();
    state.audioEl.src = track.url;
    state.audioEl.currentTime = 0;
    state.audioEl.volume = state.muted ? 0 : parseFloat(volumeEl.value);
    state.audioEl.play().then(() => {
      musicSourceEl.textContent = track.type === 'file' ? 'File' : 'URL';
      musicDetailEl.textContent = track.name;
      setPlaybackState('Playing');
    }).catch(() => {
      setError('Audio playback failed (autoplay or CORS). Falling back to synth.');
      startSynth();
    });
    return true;
  }

  function startAudio() {
    if (state.muted) return;
    if (state.audioPlaylist.length) {
      playTrack(state.currentTrack);
    } else {
      startSynth();
    }
  }
  function stopAudio() {
    state.audioEl.pause();
    state.audioEl.currentTime = 0;
    stopSynth();
  }

  state.audioEl.addEventListener('ended', () => {
    if (!state.audioPlaylist.length) return;
    if (!state.loopPlaylist && state.currentTrack === state.audioPlaylist.length - 1) { startSynth(); return; }
    playTrack(state.currentTrack + 1);
  });
  state.audioEl.addEventListener('error', () => { setError('Audio error; using synth.'); startSynth(); });

  function computeFrame(now) {
    if (!state.asciiPlaylist.length) return 'Loading love...';
    const switchEvery = 4000;
    if (state.autoRotate && state.running) {
      const elapsed = now - state.startTimePerf;
      const idx = Math.floor(elapsed / switchEvery) % state.asciiPlaylist.length;
      if (idx !== state.currentAsciiIndex) {
        state.transition = { from: state.asciiPlaylist[state.currentAsciiIndex], to: state.asciiPlaylist[idx], tick: 0, mode: state.transition?.mode === 0 ? 1 : 0 };
        state.currentAsciiIndex = idx;
        state.currentFrameIndex = 0;
      }
    }
    const art = state.asciiPlaylist[state.currentAsciiIndex] || state.asciiPlaylist[0];
    if (art.frames.length > 1 && state.tick % 2 === 0) {
      state.currentFrameIndex = (state.currentFrameIndex + 1) % art.frames.length;
    }
    return art.frames[state.currentFrameIndex] || '';
  }

  function render() {
    const now = performance.now();
    const elapsed = state.running ? (Date.now() - state.startTimeWall) / 1000 : 0;
    const remaining = state.running ? Math.max(0, Math.ceil(state.duration - elapsed)) : state.duration;
    updateCountdown(remaining);
    if (state.running && remaining <= 0) { stop(); return; }

    const { w, h } = computeCanvas();
    const frameText = computeFrame(now);
    const lines = frameText.split('\n');
    const padded = padLines(lines, w, h);
    const waved = applyWave(applyBob(padded, state.tick), state.tick);
    const sparkled = maybeSparkle(waved, state.tick);

    let output = sparkled;
    if (state.transition) {
      state.transition.tick += 1;
      const progress = smoothstep(state.transition.tick / 14);
      const fromLines = padLines(state.transition.from.frames[0].split('\n'), w, h);
      const toLines = padLines(state.transition.to.frames[0].split('\n'), w, h);
      output = state.transition.mode === 0 ? wipeLTR(fromLines, toLines, progress) : wipeCenter(fromLines, toLines, progress);
      if (state.transition.tick >= 14) state.transition = null;
    }

    asciiEl.textContent = output.join('\n');
    state.tick++;
  }

  function loop() {
    if (!state.running) return;
    render();
    state.timer = setTimeout(loop, 50);
  }

  function start() {
    if (state.running) return;
    clearErrors();
    state.running = true;
    state.startTimeWall = Date.now();
    state.startTimePerf = performance.now();
    setPlaybackState('Playing');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    startAudio();
    loop();
  }
  function stop() {
    state.running = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    setPlaybackState('Stopped');
    stopAudio();
    if (state.timer) clearTimeout(state.timer);
  }

  startBtn.addEventListener('click', () => { state.audioCtx?.resume(); start(); });
  stopBtn.addEventListener('click', stop);
  nextBtn.addEventListener('click', () => { state.currentAsciiIndex = (state.currentAsciiIndex + 1) % Math.max(1, state.asciiPlaylist.length); state.transition = null; state.currentFrameIndex = 0; render(); });
  rotateToggle.addEventListener('change', (e) => { state.autoRotate = e.target.checked; });
  loopToggle.addEventListener('change', () => { state.loopPlaylist = loopToggle.checked; });

  asciiPicker.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    state.asciiPlaylist = [];
    addAscii(text, 'File', file.name);
    setAsciiChips();
    state.currentAsciiIndex = 0; state.currentFrameIndex = 0; state.autoRotate = false; rotateToggle.checked = false;
    render();
  });
  musicPicker.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    state.audioPlaylist = [{ type: 'file', url, name: file.name }];
    musicSourceEl.textContent = 'File';
    musicDetailEl.textContent = file.name;
    renderChips();
    if (state.running) playTrack(0);
  });

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith('audio/')) {
      musicPicker.files = e.dataTransfer.files;
      musicPicker.dispatchEvent(new Event('change'));
    } else {
      asciiPicker.files = e.dataTransfer.files;
      asciiPicker.dispatchEvent(new Event('change'));
    }
  }
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', (e) => { dropZone.classList.remove('dragging'); handleDrop(e); });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', handleDrop);

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); state.running ? stop() : start(); }
    if (e.key === 'n' || e.key === 'N') nextBtn.click();
    if (e.key === 'm' || e.key === 'M') muteBtn.click();
  });

  volumeEl.addEventListener('input', (e) => updateVolume(parseFloat(e.target.value)));
  muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? 'Unmute' : 'Mute';
    state.audioEl.muted = state.muted;
    if (state.synthGain && state.audioCtx) state.synthGain.gain.setValueAtTime(state.muted ? 0 : parseFloat(volumeEl.value), state.audioCtx.currentTime);
  });
  prevTrackBtn.addEventListener('click', () => playTrack(state.currentTrack - 1));
  nextTrackBtn.addEventListener('click', () => playTrack(state.currentTrack + 1));

  async function bootstrap() {
    await loadPlaylistFromParams();
    await loadAsciiFromParams();
    if (!state.asciiPlaylist.length) {
      embeddedArts.forEach((art, i) => addAscii(art, 'Embedded', `Default #${i + 1}`));
    }
    setAsciiChips();
    render();
    updateCountdown(state.duration);
  }

  bootstrap();
})();
