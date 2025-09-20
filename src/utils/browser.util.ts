import puppeteer, { Browser, Page } from 'puppeteer';
import { ScrapingConfig } from '../types/fund.types';

export class BrowserManager {
  private browser: Browser | null = null;
  private config: ScrapingConfig;

  constructor(config: ScrapingConfig) {
    this.config = config;
  }

  async launch(): Promise<Browser> {
    // Reuse existing browser if already launched
    if (this.browser) {
      return this.browser;
    }

    const launchOptions: any = {
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--user-agent=' + this.config.userAgent
      ]
    };

    // Add Render-specific configuration
    if (process.env.NODE_ENV === 'production') {
      // Try to find Chrome in common locations
      const fs = require('fs');
      const path = require('path');
      
      const possiblePaths = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        '/opt/render/.cache/puppeteer/chrome/linux-140.0.7339.80/chrome-linux64/chrome',
        '/opt/render/.cache/puppeteer/chrome/linux-140.0.7339.80/chrome-linux64/chrome-linux64/chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
      ];
      
      for (const chromePath of possiblePaths) {
        if (chromePath && fs.existsSync(chromePath)) {
          launchOptions.executablePath = chromePath;
          console.log(`✅ Found Chrome at: ${chromePath}`);
          break;
        }
      }
      
      if (!launchOptions.executablePath) {
        console.log('⚠️ Chrome not found, using default Puppeteer configuration');
        // Remove executablePath to let Puppeteer use its default
        delete launchOptions.executablePath;
      }
      
      launchOptions.args.push('--single-process');
      launchOptions.args.push('--disable-background-timer-throttling');
      launchOptions.args.push('--disable-backgrounding-occluded-windows');
      launchOptions.args.push('--disable-renderer-backgrounding');
    }

    this.browser = await puppeteer.launch(launchOptions);

    return this.browser;
  }

  async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const tryCreate = async (): Promise<Page> => {
      const page = await this.browser!.newPage();
      await page.setUserAgent(this.config.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });
      page.setDefaultTimeout(this.config.timeout);
      page.setDefaultNavigationTimeout(Math.max(this.config.timeout, 120000));
      return page;
    };

    const maxAttempts = 3;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await tryCreate();
      } catch (error) {
        lastError = error;
        console.log(`⚠️ createPage attempt ${attempt} failed, retrying...`, (error as Error).message);
        await this.delay(1000);
        // On final retry, try relaunching browser
        if (attempt === maxAttempts) {
          try {
            await this.close();
            await this.launch();
            return await tryCreate();
          } catch (relaunchErr) {
            lastError = relaunchErr;
          }
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to create page');
  }

  async navigateToPage(page: Page, url: string): Promise<void> {
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout 
    });
    
    console.log('Page loaded, waiting for content...');
    // Wait a bit for dynamic content
    await this.delay(3000);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async delay(ms: number = 1000): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }
}
