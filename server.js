import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const cache = new Map();
const TTL = 60 * 60 * 1000; // 1 hour

async function cachedFetch(url) {
  const entry = cache.get(url);
  if (entry && Date.now() - entry.ts < TTL) return entry.data;
  const response = await fetch(url);
  const data = await response.json();
  cache.set(url, { data, ts: Date.now() });
  return data;
}

app.use(express.static(join(__dirname, 'public')));

app.get('/api/holidays', async (req, res) => {
  const { year } = req.query;
  try {
    const data = await cachedFetch(`https://api.dagsmart.se/holidays?year=${year}&weekends=false`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/bridge-days', async (req, res) => {
  const { year } = req.query;
  try {
    const data = await cachedFetch(`https://api.dagsmart.se/bridge-days?year=${year}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Aftersummer → http://localhost:${PORT}`));
