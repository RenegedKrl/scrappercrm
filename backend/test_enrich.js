const axios = require('axios');
const cheerio = require('cheerio');

async function searchInstagram(companyName, city) {
  try {
    const query = encodeURIComponent(`${companyName} ${city} instagram`);
    const response = await axios.get(`https://duckduckgo.com/html/?q=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const links = [];
    $('a.result__url').each((i, el) => {
      links.push($(el).attr('href'));
    });
    
    console.log('Results:', links);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

searchInstagram('Clínica Odontológica Sorriso', 'São Paulo');
