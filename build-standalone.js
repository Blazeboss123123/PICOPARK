// Builds a single self-contained HTML file (local play only) from public/.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const game = fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8');
const out = html.replace('<script src="game.js"></script>', () => '<script>window.HP_STANDALONE=true;\n' + game + '\n</script>');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/huddle-peak.html'), out);
console.log('wrote dist/huddle-peak.html', out.length, 'bytes');
