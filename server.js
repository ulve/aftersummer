import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.static(join(__dirname, 'public')));

app.get('/api/holidays', async (req, res) => {
  const { year } = req.query;
  try {
    const response = await fetch(`https://api.dagsmart.se/holidays?year=${year}&weekends=false`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/bridge-days', async (req, res) => {
  const { year } = req.query;
  try {
    const response = await fetch(`https://api.dagsmart.se/bridge-days?year=${year}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Aftersummer → http://localhost:${PORT}`));
