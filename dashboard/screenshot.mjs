import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function takeScreenshots() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  
  // Wait for page to be fully loaded
  await page.goto('http://localhost:3456', { 
    waitUntil: 'networkidle0',
    timeout: 30000 
  });

  // Wait for dashboard to render
  await page.waitForSelector('main', { timeout: 10000 });
  await new Promise(resolve => setTimeout(resolve, 3000)); // Extra time for charts

  // Check console for errors
  const consoleMessages = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleMessages.push(`ERROR: ${msg.text()}`);
    }
  });

  // Desktop screenshot
  console.log('Taking desktop screenshot (1280x900)...');
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.screenshot({ 
    path: path.join(__dirname, 'screenshot-desktop.png'),
    fullPage: true
  });
  console.log('✓ Desktop screenshot saved');

  // Mobile screenshot
  console.log('Taking mobile screenshot (375x812)...');
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await new Promise(resolve => setTimeout(resolve, 1000));
  await page.screenshot({ 
    path: path.join(__dirname, 'screenshot-mobile.png'),
    fullPage: true
  });
  console.log('✓ Mobile screenshot saved');

  // Log any console errors
  if (consoleMessages.length > 0) {
    console.log('\n⚠️ Console errors detected:');
    consoleMessages.forEach(msg => console.log('  ' + msg));
  } else {
    console.log('✓ No console errors detected');
  }

  await browser.close();
  console.log('\n✅ Screenshots complete!');
}

takeScreenshots().catch(console.error);
