const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const searchUrl = 'https://cnpj.biz/procura/dentista%20sao%20paulo?page=2';
  console.log('Navigating to', searchUrl);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  
  const title = await page.title();
  console.log('Page title:', title);
  
  const urls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => a.href);
  });
  
  const cnpjs = [];
  for (const url of urls) {
     const match = url.match(/\/\d{14}$/); // Look for /12345678000199 at the end of URL
     if (match) cnpjs.push(match[0]);
  }
  
  console.log('Found CNPJs:', cnpjs.slice(0, 10));
  
  await browser.close();
})();
