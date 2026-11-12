const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const output = path.join(root, 'dist', 'pages');
const repository = 'https://github.com/CodesbyFebin/PayPal-Vibe-Trading-One-App-All-Trades';
const configured = process.env.WEB_APP_URL?.trim();
const webApp = configured ? new URL(configured) : null;

if (webApp && (webApp.protocol !== 'https:' || webApp.username || webApp.password || webApp.href !== webApp.origin + '/')) {
  throw new Error('WEB_APP_URL must be an HTTPS origin without credentials or a path.');
}

const links = {
  '/': './',
  '/landing/': './',
  '/#vibe-it': webApp ? new URL('/#vibe-it', webApp).href : repository + '#run-locally',
  '/webapp/': webApp ? new URL('/webapp/', webApp).href : repository + '#judge-walkthrough',
  '/mobile/': webApp ? new URL('/mobile/', webApp).href : repository + '#judge-walkthrough',
};

let html = fs.readFileSync(path.join(root, 'public', 'landing', 'index.html'), 'utf8');
html = html.replace('<a href="/">Vibe It</a>', '<a href="/#vibe-it">Vibe It</a>');
html = html.replace(/(href|src)="(\/[^"]*)"/g, (_, attribute, href) => {
  const target = href.startsWith('/assets/') ? '.' + href : links[href];
  if (!target) throw new Error('Unexpected landing page link: ' + href);
  return attribute + '="' + target + '"';
});

fs.mkdirSync(path.join(output, 'assets'), { recursive: true });
for (const name of ['app.css', 'vibe-icon.svg', 'vibe-mascot.webp']) {
  fs.copyFileSync(path.join(root, 'public', 'assets', name), path.join(output, 'assets', name));
}
fs.writeFileSync(path.join(output, 'index.html'), html);
fs.writeFileSync(path.join(output, '.nojekyll'), '');
