export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { city } = req.query;
  const key = '756f12d0c20d29f76808839251369ef7';
  try {
    const resp = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${key}&units=metric&lang=es&cnt=40`);
    const data = await resp.json();
    res.status(200).json(data);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}