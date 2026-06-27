const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const query = 'Clínica Odontológica Sorriso São Paulo instagram';
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => a.href);
  });
  
  const igLink = links.find(href => href && href.includes('instagram.com') && !href.includes('/p/'));
  console.log('Found IG:', igLink);
  
  await browser.close();
})();
