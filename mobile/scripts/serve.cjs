const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
http
  .createServer((req, res) => {
    const relative = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404);
        return res.end();
      }
      res.setHeader(
        'Content-Type',
        file.endsWith('.js')
          ? 'text/javascript'
          : file.endsWith('.html')
            ? 'text/html; charset=utf-8'
            : 'application/octet-stream',
      );
      res.end(data);
    });
  })
  .listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'));
