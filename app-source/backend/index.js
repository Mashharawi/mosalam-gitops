const http = require('http');
const { Pool } = require('pg');
const { createClient } = require('redis');

const PORT = 3000;
const CACHE_KEY = 'assets:all';

const pool = new Pool({
    host: process.env.PGHOST || 'postgres',
    user: process.env.PGUSER || 'mosalam_admin',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'mosalam_db',
    port: 5432,
    max: 5
});

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));

async function waitForDb(retries = 10, delayMs = 3000) {
    for (let i = 1; i <= retries; i++) {
        try {
            const client = await pool.connect();
            client.release();
            console.log('Connected to Postgres successfully');
            return;
        } catch (err) {
            console.log(`Postgres not ready yet (attempt ${i}/${retries}): ${err.message}`);
            await new Promise(res => setTimeout(res, delayMs));
        }
    }
    console.error('Could not connect to Postgres after multiple retries. Continuing anyway; requests will fail until DB is reachable.');
}

async function waitForRedis(retries = 10, delayMs = 3000) {
    for (let i = 1; i <= retries; i++) {
        try {
            await redisClient.connect();
            console.log('Connected to Redis successfully');
            return;
        } catch (err) {
            console.log(`Redis not ready yet (attempt ${i}/${retries}): ${err.message}`);
            await new Promise(res => setTimeout(res, delayMs));
        }
    }
    console.error('Could not connect to Redis after multiple retries. Continuing anyway; caching will be skipped until Redis is reachable.');
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/api/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'UP', message: 'Backend is healthy', version: 'v2' }));
        return;
    }

    if (req.url === '/api/assets' && req.method === 'GET') {
        try {
            if (redisClient.isReady) {
                const cached = await redisClient.get(CACHE_KEY);
                if (cached) {
                    res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'HIT' });
                    res.end(cached);
                    return;
                }
            }

            const result = await pool.query('SELECT id, name, department, status FROM assets ORDER BY id DESC');
            const payload = JSON.stringify(result.rows);

            if (redisClient.isReady) {
                await redisClient.set(CACHE_KEY, payload);
            }

            res.writeHead(200, { 'Content-Type': 'application/json', 'X-Cache': 'MISS' });
            res.end(payload);
        } catch (err) {
            console.error('Error fetching assets:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to fetch assets' }));
        }
        return;
    }

    if (req.url === '/api/assets' && req.method === 'POST') {
        try {
            const data = await readJsonBody(req);
            const { name, department, status } = data;

            if (!name || !department) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'name and department are required' }));
                return;
            }

            const allowedStatuses = ['Active', 'Maintenance', 'Decommissioned'];
            const finalStatus = allowedStatuses.includes(status) ? status : 'Active';

            const result = await pool.query(
                'INSERT INTO assets (name, department, status) VALUES ($1, $2, $3) RETURNING id',
                [name, department, finalStatus]
            );

            if (redisClient.isReady) {
                await redisClient.del(CACHE_KEY);
            }

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id: result.rows[0].id, name, department, status: finalStatus }));
        } catch (err) {
            console.error('Error creating asset:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to create asset' }));
        }
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    waitForDb();
    waitForRedis();
});
