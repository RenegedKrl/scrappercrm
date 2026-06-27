const axios = require('axios');
const tag = 'amenity=hospital';
const radius = 5000;
const lat = -23.5505;
const lng = -46.6333;
const query = `
    [out:json][timeout:25];
    (
      node[${tag}](around:${radius},${lat},${lng});
      way[${tag}](around:${radius},${lat},${lng});
    );
    out body;
    >;
    out skel qt;
  `;
console.log("Query:", query);
axios.get('https://overpass-api.de/api/interpreter', { 
  params: { data: query },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Scrapper/1.0',
    'Accept': '*/*'
  }
})
  .then(r => console.log("SUCCESS. Elements:", r.data.elements.length))
  .catch(e => {
      console.log("ERROR STATUS:", e.response?.status);
      console.log("ERROR DATA:", e.response?.data);
  });
