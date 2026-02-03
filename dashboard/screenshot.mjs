import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://localhost:3456';
const output = process.argv[3] || 'screenshot.png';
const width = parseInt(process.argv[4]) || 1440;
const height = parseInt(process.argv[5]) || 900;

async function screenshot() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  
  console.log(`Loading ${url} at ${width}x${height}...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Wait for dashboard to load
  await page.waitForSelector('main', { timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000)); // Extra wait for charts
  
  // Full page screenshot
  await page.screenshot({ path: output, fullPage: true });
  console.log(`Saved to ${output}`);
  
  await browser.close();
}

screenshot().catch(e => {
  console.error(e);
  process.exit(1);
});
