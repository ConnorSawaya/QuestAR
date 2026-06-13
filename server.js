import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 4173);
const distDir = join(process.cwd(), 'dist');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const requestedPath = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const assetPath = join(distDir, requestedPath || 'index.html');
  const filePath = existsSync(assetPath) ? assetPath : join(distDir, 'index.html');
  const contentType = mimeTypes[extname(filePath)] || 'application/octet-stream';

  response.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`Quest AR server running on port ${port}`);
});
