const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const query = `site:casadosdados.com.br/solucao/cnpj OR site:cnpj.biz "Dentista" "São Paulo"`;
  const searchUrl = 'https://www.google.com/search?q=' + encodeURIComponent(query) + '&num=30';
  console.log('Navigating to', searchUrl);
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  
  const title = await page.title();
  console.log('Page title:', title);
  
  const urls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => a.href);
  });
  
  const targetUrls = urls.filter(href => href && (href.includes('casadosdados.com.br') || href.includes('cnpj.biz')));
  console.log('Target URLs:', targetUrls.slice(0, 5));
  
  await browser.close();
})();
