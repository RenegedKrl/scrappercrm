const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Go to first page to get pagination links
  await page.goto('https://cnpj.biz/procura/dentista%20sao%20paulo', { waitUntil: 'domcontentloaded' });
  
  const paginationLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes('procura/dentista'));
  });
  
  console.log('Pagination links on page 1:', paginationLinks);
  
  await browser.close();
})();
