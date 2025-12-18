const qs = new URLSearchParams(location.search);

const configPath = 'config.json';
const asciiDisplay = document.getElementById('asciiDisplay');
const statusText = document.getElementById('statusText');
const countdownEl = document.getElementById('countdown');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const transitionLabel = document.getElementById('transitionLabel');
const overlayEffect = document.getElementById('overlayEffect');
const asciiFileInput = document.getElementById('asciiFileInput');
const audioFileInput = document.getElementById('audioFileInput');
const trackInfo = document.getElementById('trackInfo');
const musicStatus = document.getElementById('musicStatus');
const progressBar = document.getElementById('progressBar');
const nextTrackBtn = document.getElementById('nextTrack');
const prevTrackBtn = document.getElementById('prevTrack');

// ------------ Helpers ------------
const frameMarker = '-----FRAME-----';
const defaultAscii = `  _   _     _   _   _   _     _   _   _   _
 / \ / \   / \ / \ / \ / \   / \ / \ / \ / \
( L | O ) ( V | E |   | Y ) ( O | U | ! | ! )
 \_/ \_/   \_/ \_/ \_/ \_/   \_/ \_/ \_/ \_/

    (¯`·._.·(¯`·._.· Love ·._.·´¯)·._.·´¯)

     ❤    ❤     ❤    ❤     ❤    ❤    ❤
`; // safe ASCII hearts

const defaultPlaylist = [
  'https://archive.org/download/love_202310/love_song_1.mp3',
  'https://archive.org/download/love_202310/love_song_2.mp3',
  'https://archive.org/download/love_202310/love_song_3.mp3'
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSafe(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  return res.text();
}

function splitFrames(content) {
  if (content.includes(frameMarker)) {
    return content
      .split(frameMarker)
      .map((f) => f.trim().replace(/\s+$/g, ''))
      .filter(Boolean);
  }
  const trimmed = content.trimEnd();
  return trimmed ? [trimmed] : [];
}

function linesOf(str) {
  return str.split('\n');
}

function padLines(lines, width, height) {
  const out = [...lines];
  if (out.length < height) out.push(...Array(height - out.length).fill(''));
  const padded = out.slice(0, height).map((line) => {
    const missing = Math.max(0, width - line.length);
    return line + ' '.repeat(missing);
  });
  return padded;
}

function smoothstep(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function shuffle(arr) {
  return arr
    .map((v) => ({ v, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ v }) => v);
}

// ------------ Loader ------------
async function loadConfig() {
  try {
    const res = await fetch(configPath);
    if (!res.ok) return {};
    return await res.json();
  } catch (err) {
    console.warn('config.json missing or invalid', err);
    return {};
  }
}

function parseList(value) {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

async function resolveAsciiSources(config) {
  const asciiInline = qs.get('ascii');
  if (asciiInline) {
    return { type: 'inline', sources: [asciiInline], description: 'Query string inline ASCII' };
  }

  const asciiSrc = qs.get('asciiSrc') || config.asciiSrc;
  if (asciiSrc) {
    return { type: 'single', sources: [asciiSrc], description: `Single source: ${asciiSrc}` };
  }

  const asciiListParam = qs.get('asciiList');
  if (asciiListParam) {
    return { type: 'list', sources: parseList(asciiListParam), description: 'List from query asciiList' };
  }

  const asciiDirParam = qs.get('asciiDir') || config.asciiDir;
  if (asciiDirParam) {
    // Expect manifest.json inside dir
    try {
      const manifest = await fetchSafe(`${asciiDirParam.replace(/\/$/, '')}/manifest.json`);
      const files = JSON.parse(manifest);
      if (Array.isArray(files) && files.length) {
        return { type: 'list', sources: files.map((f) => `${asciiDirParam.replace(/\/$/, '')}/${f}`), description: `Directory manifest: ${asciiDirParam}` };
      }
    } catch (err) {
      console.warn('Failed to read manifest', err);
    }
  }

  if (config.asciiList && Array.isArray(config.asciiList)) {
    return { type: 'list', sources: config.asciiList, description: 'config.json asciiList' };
  }

  return { type: 'inline', sources: [defaultAscii], description: 'Built-in default' };
}

async function loadAsciiContents(sourceInfo) {
  const framesByArt = [];

  if (sourceInfo.type === 'inline') {
    const inlineFrames = splitFrames(sourceInfo.sources[0] || defaultAscii);
    if (inlineFrames.length) framesByArt.push(inlineFrames);
  } else {
    for (const src of sourceInfo.sources) {
      try {
        const text = await fetchSafe(src);
        const frames = splitFrames(text);
        if (frames.length) framesByArt.push(frames);
      } catch (err) {
        console.error('ASCII fetch failed', err);
        statusText.textContent = `ASCII load failed for ${src}: ${err.message}`;
      }
    }
  }

  if (!framesByArt.length) {
    framesByArt.push(splitFrames(defaultAscii));
  }
  return framesByArt;
}

function resolveSeconds(config) {
  const param = parseInt(qs.get('seconds') || '', 10);
  if (!Number.isNaN(param) && param > 0) return param;
  if (config.seconds) return config.seconds;
  return 60;
}

function resolveMusic(config) {
  const playlistUrl = qs.get('playlistUrl') || config.playlistUrl;
  const playlistParam = qs.get('playlist');
  const musicParam = qs.get('music');

  if (playlistUrl) {
    return { mode: 'playlistUrl', value: playlistUrl };
  }
  if (playlistParam) {
    return { mode: 'playlist', value: parseList(playlistParam) };
  }
  if (musicParam) {
    return { mode: 'single', value: [musicParam] };
  }
  if (config.playlist && Array.isArray(config.playlist)) {
    return { mode: 'playlist', value: config.playlist };
  }
  if (config.music) {
    return { mode: 'single', value: [config.music] };
  }
  return { mode: 'playlist', value: defaultPlaylist };
}

async function loadPlaylist(musicConfig) {
  if (musicConfig.mode === 'playlistUrl') {
    try {
      const text = await fetchSafe(musicConfig.value);
      const json = JSON.parse(text);
      if (Array.isArray(json)) return json;
      if (Array.isArray(json.tracks)) return json.tracks;
    } catch (err) {
      console.warn('Failed to load playlistUrl', err);
    }
  }
  if (Array.isArray(musicConfig.value) && musicConfig.value.length) {
    return musicConfig.mode === 'playlist' && !qs.get('playlist')
      ? shuffle(musicConfig.value)
      : musicConfig.value;
  }
  return shuffle(defaultPlaylist);
}

// ------------ Animation ------------
class LoveAnimator {
  constructor(framesByArt, seconds) {
    this.framesByArt = framesByArt;
    this.maxWidth = 0;
    this.maxHeight = 0;
    this.tick = 0;
    this.timer = null;
    this.seconds = seconds;
    this.startedAt = null;
    this.switchEvery = 4000; // ms
    this.frameEveryTicks = 2;
    this.transitionTicks = 14;
    this.transitioning = false;
    this.transitionMode = 0;
    this.fromLines = [];
    this.toLines = [];
    this.currentArt = 0;
    this.currentFrame = 0;
    this.lastArt = -1;
    this.sparklePositions = new Set();
    this.computeCanvas();
  }

  computeCanvas() {
    let w = 40;
    let h = 10;
    this.framesByArt.forEach((frames) => {
      frames.forEach((f) => {
        const lines = linesOf(f);
        h = Math.max(h, lines.length);
        lines.forEach((line) => {
          w = Math.max(w, line.length);
        });
      });
    });
    this.maxWidth = w;
    this.maxHeight = h;
  }

  start() {
    this.startedAt = Date.now();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tickForward(), 50); // ~20 FPS
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  remainingSeconds() {
    if (!this.startedAt) return this.seconds;
    const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    return Math.max(0, this.seconds - elapsed);
  }

  chooseArt() {
    const elapsed = this.startedAt ? Date.now() - this.startedAt : 0;
    const idx = Math.floor(elapsed / this.switchEvery) % this.framesByArt.length;
    this.currentArt = idx;
    if (this.lastArt === -1) this.lastArt = idx;
    if (idx !== this.lastArt && !this.transitioning) {
      this.transitioning = true;
      this.transitionTick = 0;
      this.transitionMode = (this.transitionMode + 1) % 2;
      const fromFrame = this.pickFrame(this.lastArt);
      const toFrame = this.pickFrame(idx);
      this.fromLines = padLines(linesOf(fromFrame), this.maxWidth, this.maxHeight);
      this.toLines = padLines(linesOf(toFrame), this.maxWidth, this.maxHeight);
      this.lastArt = idx;
    }
  }

  pickFrame(artIdx) {
    const frames = this.framesByArt[artIdx];
    if (!frames) return defaultAscii;
    if (frames.length > 1 && this.tick % this.frameEveryTicks === 0) {
      this.currentFrame = (this.currentFrame + 1) % frames.length;
    }
    return frames[this.currentFrame % frames.length];
  }

  applyWave(lines) {
    const t = this.tick * 0.18;
    const amp = 2 + 1.2 * Math.sin(t * 0.35);
    return lines.map((line, i) => {
      const phase = t + i * 0.55;
      const shift = Math.round(Math.sin(phase) * amp);
      if (shift === 0) return line;
      if (shift > 0) return ' '.repeat(shift) + line;
      const drop = Math.min(-shift, line.length);
      return line.slice(drop) + ' '.repeat(drop);
    });
  }

  applyBob(lines) {
    const t = this.tick * 0.12;
    const padTop = Math.sin(t) > 0.35 ? 1 : 0;
    if (!padTop) return lines;
    const blank = ' '.repeat(this.maxWidth);
    const out = [blank, ...lines];
    return out.slice(0, this.maxHeight);
  }

  applySparkle(lines) {
    if (this.tick % 6 !== 0) return lines;
    const y = Math.floor(Math.random() * this.maxHeight);
    const x = Math.floor(Math.random() * this.maxWidth);
    const line = lines[y] || '';
    if (!line) return lines;
    if (x >= line.length) return lines;
    const chars = line.split('');
    if (chars[x] === ' ') {
      chars[x] = this.tick % 12 === 0 ? '*' : '.';
      const updated = [...lines];
      updated[y] = chars.join('');
      return updated;
    }
    return lines;
  }

  wipeLTR(from, to, progress) {
    const cut = Math.floor(this.maxWidth * progress);
    return from.map((line, idx) => {
      const a = line.split('');
      const b = to[idx].split('');
      for (let i = 0; i < Math.min(cut, this.maxWidth); i++) {
        a[i] = b[i];
      }
      return a.join('');
    });
  }

  wipeCenter(from, to, progress) {
    const half = Math.floor((this.maxWidth / 2) * progress);
    const c = Math.floor(this.maxWidth / 2);
    const l = Math.max(0, c - half);
    const r = Math.min(this.maxWidth - 1, c + half);
    return from.map((line, idx) => {
      const a = line.split('');
      const b = to[idx].split('');
      for (let i = l; i <= r; i++) {
        a[i] = b[i];
      }
      return a.join('');
    });
  }

  render() {
    this.chooseArt();
    let lines;
    if (this.transitioning) {
      this.transitionTick += 1;
      const p = smoothstep(this.transitionTick / this.transitionTicks);
      lines = this.transitionMode === 0 ? this.wipeLTR(this.fromLines, this.toLines, p) : this.wipeCenter(this.fromLines, this.toLines, p);
      if (this.transitionTick >= this.transitionTicks) this.transitioning = false;
      transitionLabel.textContent = this.transitionMode === 0 ? 'Left wipe' : 'Center reveal';
    } else {
      const frame = this.pickFrame(this.currentArt);
      lines = padLines(linesOf(frame), this.maxWidth, this.maxHeight);
      transitionLabel.textContent = 'Wavey';
    }

    lines = this.applyWave(lines);
    lines = this.applyBob(lines);
    lines = this.applySparkle(lines);

    asciiDisplay.textContent = lines.join('\n');
  }

  tickForward() {
    this.tick += 1;
    this.render();
    countdownEl.textContent = this.remainingSeconds();
  }
}

// ------------ Audio ------------
class LoveAudio {
  constructor(tracks) {
    this.tracks = tracks && tracks.length ? [...tracks] : defaultPlaylist;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.idx = 0;
    this.userStarted = false;
    this.bindEvents();
  }

  bindEvents() {
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('error', () => {
      musicStatus.textContent = 'Audio failed to load — animation continues.';
    });
  }

  updateProgress() {
    const { currentTime, duration } = this.audio;
    if (!duration || Number.isNaN(duration)) return;
    const p = Math.min(100, (currentTime / duration) * 100);
    progressBar.style.width = `${p}%`;
  }

  currentTrack() {
    return this.tracks[this.idx % this.tracks.length];
  }

  async play() {
    if (!this.tracks.length) return;
    const track = this.currentTrack();
    this.audio.src = track;
    trackInfo.textContent = `Playing: ${track}`;
    progressBar.style.width = '0%';
    musicStatus.textContent = 'Loading…';
    try {
      await this.audio.play();
      musicStatus.textContent = 'Playing';
    } catch (err) {
      musicStatus.textContent = 'Awaiting user interaction (autoplay blocked)';
      throw err;
    }
  }

  async start() {
    try {
      await this.play();
    } catch (err) {
      console.warn('Autoplay blocked until click', err);
    }
  }

  async next() {
    this.idx = (this.idx + 1) % this.tracks.length;
    await this.play();
  }

  async prev() {
    this.idx = (this.idx - 1 + this.tracks.length) % this.tracks.length;
    await this.play();
  }

  pause() {
    this.audio.pause();
  }

  setLocalFile(file) {
    const url = URL.createObjectURL(file);
    this.tracks = [url];
    this.idx = 0;
    this.play();
  }
}

// ------------ Bootstrap ------------
async function main() {
  const config = await loadConfig();
  const seconds = resolveSeconds(config);
  countdownEl.textContent = seconds;

  const asciiSources = await resolveAsciiSources(config);
  statusText.textContent = `ASCII source: ${asciiSources.description}`;
  const framesByArt = await loadAsciiContents(asciiSources);
  const animator = new LoveAnimator(framesByArt, seconds);

  const musicConfig = resolveMusic(config);
  const playlist = await loadPlaylist(musicConfig);
  const audio = new LoveAudio(playlist);
  musicStatus.textContent = `Tracks: ${playlist.length}. Source: ${musicConfig.mode}`;

  let running = false;

  async function startExperience() {
    if (running) return;
    running = true;
    statusText.textContent = 'Animating…';
    animator.start();
    try {
      await audio.start();
    } catch (err) {
      musicStatus.textContent = 'Click Start to allow audio (autoplay blocked).';
    }
  }

  function stopExperience() {
    running = false;
    animator.stop();
    audio.pause();
    statusText.textContent = 'Stopped';
  }

  startBtn.addEventListener('click', startExperience);
  stopBtn.addEventListener('click', stopExperience);
  nextTrackBtn.addEventListener('click', () => audio.next());
  prevTrackBtn.addEventListener('click', () => audio.prev());

  asciiFileInput.addEventListener('change', async (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    const frames = splitFrames(content);
    if (frames.length) {
      animator.framesByArt = [frames];
      animator.computeCanvas();
      statusText.textContent = `ASCII source: local file ${file.name}`;
    }
  });

  audioFileInput.addEventListener('change', (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;
    audio.setLocalFile(file);
    musicStatus.textContent = `Local audio: ${file.name}`;
  });

  // decorative overlay glow
  const gradient = document.createElement('div');
  gradient.className = 'absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/10 mix-blend-screen pointer-events-none animate-pulse';
  overlayEffect.appendChild(gradient);
}

main().catch((err) => {
  console.error(err);
  statusText.textContent = `Error: ${err.message}`;
});
