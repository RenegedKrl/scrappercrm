const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://cnpj.biz/procura/dentista%20sao%20paulo', { waitUntil: 'domcontentloaded' });
  
  const nextUrl = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const next = links.find(a => a.href.includes('?id='));
    return next ? next.href : null;
  });
  
  console.log('Next URL is:', nextUrl);
  
  await browser.close();
})();
