const http = require('http');

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('FATAL: API_KEY environment variable is not set');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const providedKey = req.headers['x-api-key'];

  if (providedKey && providedKey === API_KEY) {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(401);
    res.end('Unauthorized');
  }
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`auth-service listening on port ${PORT}`);
});
