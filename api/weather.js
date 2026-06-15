export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { city, lat, lon } = req.query;
  const key = '756f12d0c20d29f76808839251369ef7';
  
  let url;
  if (lat && lon) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=es`;
  } else {
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${key}&units=metric&lang=es`;
  }
  
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    res.status(200).json(data);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}