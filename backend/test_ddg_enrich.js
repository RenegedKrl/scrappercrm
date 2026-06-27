const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const query = 'Clínica Odontológica Sorriso São Paulo instagram';
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a.result__url')).map(a => a.href);
  });
  
  console.log('Found links:', links);
  const igLink = links.find(href => href && href.includes('instagram.com') && !href.includes('/p/'));
  console.log('Found IG:', igLink);
  
  await browser.close();
})();
