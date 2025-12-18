const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'src/index.html');
const cssPath = path.join(root, 'src/styles.css');
const jsPath = path.join(root, 'src/app.js');
const distDir = path.join(root, 'dist');
const distFile = path.join(distDir, 'love.html');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

const inlined = html
  .replace('<!--INLINE_STYLES-->', `<style>\n${css}\n</style>`)
  .replace('<!--INLINE_SCRIPT-->', `<script>\n${js}\n</script>`);

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(distFile, inlined, 'utf8');
console.log('built', path.relative(root, distFile));
