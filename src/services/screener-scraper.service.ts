import { Page } from 'puppeteer';
import dotenv from 'dotenv';
dotenv.config();
import { StockData, StockScrapingResult, ScrapingConfig } from '../types/fund.types';
import { BrowserManager } from '../utils/browser.util';
import { Stock } from '../models/Stock';

export class ScreenerScraperService {
  private browserManager: BrowserManager;
  private readonly SCREENER_LOGIN_URL = 'https://www.screener.in/login/';
  private readonly SCREENER_DASHBOARD_URL = 'https://www.screener.in/dash/';
  private readonly SCREENER_BASE_URL = 'https://www.screener.in';
  private readonly LOGIN_EMAIL = process.env.SCREENER_EMAIL ?? '';
  private readonly LOGIN_PASSWORD = process.env.SCREENER_PASSWORD ?? '';

  constructor(options?: { headless?: boolean; timeoutMs?: number }) {
    const config: ScrapingConfig = {
      url: this.SCREENER_BASE_URL,
      headless: options?.headless ?? false, // default to showing the browser so user can watch
      timeout: options?.timeoutMs ?? 60000,
      delay: 1000,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };
    this.browserManager = new BrowserManager(config);
  }

  // Login to screener.in
  private async loginToScreener(page: Page): Promise<boolean> {
    try {
      console.log('🔐 Logging into screener.in...');

      // Resolve creds at runtime (support multiple env key names)
      const emailKeys = ['SCREENER_EMAIL', 'SCREENER_USER', 'SCREENER_USERNAME', 'EMAIL'];
      const passKeys = ['SCREENER_PASSWORD', 'SCREENER_PASS', 'PASSWORD'];
      const findKey = (keys: string[]): { key: string | null; value: string | null } => {
        for (const k of keys) {
          const v = process.env[k];
          if (typeof v === 'string' && v.trim().length > 0) return { key: k, value: v };
        }
        return { key: null, value: null };
      };
      const { key: emailKey, value: email } = findKey(emailKeys);
      const { key: passKey, value: password } = findKey(passKeys);

      if (!email || !password) {
        console.error(`❌ Missing Screener credentials. Checked email keys: ${emailKeys.join(', ')}; password keys: ${passKeys.join(', ')}`);
        throw new Error('Screener credentials not set in env');
      }
      console.log(`🔑 Using env keys -> email: ${emailKey}; password: ${passKey}`);
      
      // Navigate to login page
      await page.goto(this.SCREENER_LOGIN_URL, { waitUntil: 'networkidle0', timeout: 60000 });
      await this.browserManager.delay(2500);
      await page.waitForSelector('body', { timeout: 60000 });

      // Dismiss possible banners/popups that may block inputs
      try {
        await page.evaluate(() => {
          const clickIfVisible = (el: Element | null) => {
            if (!(el instanceof HTMLElement)) return;
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) (el as HTMLElement).click();
          };
          // Common cookie/consent buttons
          const texts = ['Accept', 'I agree', 'Got it', 'Close'];
          const buttons = Array.from(document.querySelectorAll('button, a')) as HTMLElement[];
          for (const b of buttons) {
            const t = (b.innerText || '').trim();
            if (texts.some(x => t.toLowerCase().includes(x.toLowerCase()))) {
              clickIfVisible(b);
            }
          }
        });
      } catch {}

      // Fill email and password by typing to satisfy native validation
      const emailSelector = 'input[type="email"], input[name="email"], input[name*="email" i], input#id_username, input[name="username"], input[placeholder*="Email" i]';
      const passwordSelector = 'input[type="password"], input[name="password"], input[name*="password" i], input#id_password, input[placeholder*="Password" i]';

      // Ensure fields exist
      const emailHandle = await page.waitForSelector(emailSelector, { timeout: 30000 }).catch(() => null);
      const passHandle = await page.waitForSelector(passwordSelector, { timeout: 30000 }).catch(() => null);
      console.log('🔎 Email field found:', !!emailHandle, '| Password field found:', !!passHandle);

      if (!emailHandle || !passHandle) {
        throw new Error('Login fields not found');
      }

      // Clear and type via DOM to satisfy validation
      await page.evaluate((eSel: string, pSel: string, eVal: string, pVal: string) => {
        const e = document.querySelector(eSel) as HTMLInputElement | null;
        const p = document.querySelector(pSel) as HTMLInputElement | null;
        if (e) {
          e.focus();
          e.value = '';
        }
        if (p) {
          p.value = '';
        }
      }, emailSelector, passwordSelector, email, password);
      await this.browserManager.delay(100);

      await page.click(emailSelector, { clickCount: 3 }).catch(() => {});
      await page.type(emailSelector, email, { delay: 20 });
      await page.click(passwordSelector, { clickCount: 3 }).catch(() => {});
      await page.type(passwordSelector, password, { delay: 20 });

      // Ensure inputs are considered filled by the browser
      await page.evaluate((eSel: string, pSel: string) => {
        const e = document.querySelector(eSel) as HTMLInputElement | null;
        const p = document.querySelector(pSel) as HTMLInputElement | null;
        if (e) {
          e.dispatchEvent(new Event('input', { bubbles: true }));
          e.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (p) {
          p.dispatchEvent(new Event('input', { bubbles: true }));
          p.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, emailSelector, passwordSelector);
      await this.browserManager.delay(500);

      // Click login button
      const loginButtonSelector = 'button[type="submit"], input[type="submit"], button[name="login"], button#login, button[aria-label*="Login" i], form button';
      const loginButton = await page.$(loginButtonSelector);
      if (loginButton) {
        await loginButton.click();
      } else {
        // Try pressing Enter
        await page.keyboard.press('Enter');
      }

      // Wait for navigation to dashboard; if native tooltip persists, remove required and retry
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await this.browserManager.delay(2000);

      // Fallback: if still on login, try removing required attributes and submit again
      if (page.url().includes('/login')) {
        await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];
          inputs.forEach(i => i.removeAttribute('required'));
        });
        const loginBtnSel = 'button[type="submit"], input[type="submit"], button[name="login"], button#login, button[aria-label*="Login" i]';
        const btn = await page.$(loginBtnSel);
        if (btn) await btn.click().catch(() => {});
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      }
      
      // Verify we're on dashboard
      const currentUrl = page.url();
      if (currentUrl.includes('/dash/') || currentUrl.includes('screener.in')) {
        console.log('✅ Successfully logged into screener.in');
        return true;
      } else {
        console.log('❌ Login failed - not on dashboard');
        return false;
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      return false;
    }
  }

  // Search for a stock on screener.in
  private async searchStock(page: Page, stockName: string): Promise<string | null> {
    try {
      const cleanName = this.cleanStockName(stockName);
      console.log(`🔍 Searching for stock: ${cleanName}`);
      // Attempt 1: use homepage/global search suggestions for more reliable company picks
      try {
        await page.goto(this.SCREENER_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.browserManager.delay(600);
        const searchInputSelectors = [
          'input[type="search"]',
          'input#search-input',
          'input[name="q"]',
          'input[placeholder*="Search" i]'
        ];
        let foundInput = false;
        for (const sel of searchInputSelectors) {
          const handle = await page.$(sel);
          if (handle) {
            await handle.click({ clickCount: 3 }).catch(() => {});
            await page.type(sel, cleanName, { delay: 15 }).catch(() => {});
            foundInput = true;
            break;
          }
        }
        if (foundInput) {
          // Wait for suggestion dropdown with company links
          const suggestionSelector = 'a[href^="/company/"]';
          await page.waitForSelector(suggestionSelector, { timeout: 4000 }).catch(() => {});
          // Try to match from suggestions - check both title and description
          const suggHref = await page.evaluate((selector: string, targetName: string) => {
            const normalize = (s: string) => (s || '')
              .toLowerCase()
              .replace(/&/g, ' and ')
              .replace(/limited\b/g, 'ltd')
              .replace(/\./g, ' ')
              .replace(/[^a-z0-9 ]+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const stop = new Set(['ltd','limited','the','co','company','plc','pvt','private','inc','corp','corporation']);
            const toTokens = (s: string) => normalize(s)
              .split(' ')
              .filter(Boolean)
              .map(t => t.endsWith('s') && t.length > 3 ? t.slice(0, -1) : t)
              .filter(t => !stop.has(t));
            
            const wantNorm = normalize(targetName);
            const wantTokens = toTokens(targetName);
            
            // Extract key words from target (like "affle", "india")
            const keyWords = wantTokens.filter(t => t.length > 2);
            
            let exact: string | null = null;
            let best: { href: string | null; score: number } = { href: null, score: 0 };
            
            const links = Array.from(document.querySelectorAll(selector));
            for (const a of links) {
              const anchor = a as HTMLAnchorElement;
              const tEl = anchor.querySelector('span.hover-link') || anchor;
              const raw = (tEl?.textContent || '').trim();
              if (!raw) continue;
              
              // Check title match
              const norm = normalize(raw);
              if (norm === wantNorm || norm === wantNorm.replace(/\blimited\b/g, 'ltd') || norm === wantNorm.replace(/\bltd\b/g, 'limited')) {
                exact = anchor.getAttribute('href');
                break;
              }
              
              // Check description text for "formerly known as" or similar
              const parentEl = anchor.closest('div, li, tr') || anchor.parentElement;
              const descText = parentEl ? (parentEl.textContent || '') : '';
              const descNorm = normalize(descText);
              
              // Look for "formerly known as" patterns
              const formerlyMatch = descText.match(/formerly known as\s+([^)]+)/i);
              if (formerlyMatch) {
                const formerName = normalize(formerlyMatch[1]);
                if (formerName === wantNorm || formerName.includes(wantNorm) || wantNorm.includes(formerName)) {
                  exact = anchor.getAttribute('href');
                  break;
                }
              }
              
              // Enhanced token matching - check if key words are present
              const titleTokens = toTokens(raw);
              const descTokens = toTokens(descText);
              const allTokens = [...new Set([...titleTokens, ...descTokens])];
              
              let keyWordMatches = 0;
              keyWords.forEach(kw => {
                if (allTokens.some(t => t.includes(kw) || kw.includes(t))) {
                  keyWordMatches++;
                }
              });
              
              const keyWordScore = keyWordMatches / Math.max(keyWords.length, 1);
              
              // Traditional token overlap
              const setW = new Set(wantTokens);
              const setT = new Set(allTokens);
              let overlap = 0; setW.forEach(t => { if (setT.has(t)) overlap++; });
              const denom = Math.max(setW.size, setT.size, 1);
              const tokenScore = overlap / denom;
              
              // Combined score with higher weight for key words
              const combinedScore = (keyWordScore * 0.7) + (tokenScore * 0.3);
              const lengthRatio = Math.min(allTokens.length, wantTokens.length) / Math.max(allTokens.length, wantTokens.length);
              
              if (combinedScore >= 0.6 && lengthRatio >= 0.4 && combinedScore > best.score) {
                best = { href: anchor.getAttribute('href'), score: combinedScore };
              }
            }
            return exact || best.href || null;
          }, suggestionSelector, cleanName);
          if (suggHref) {
            await page.click(`a[href='${suggHref}']`).catch(() => {});
            const ok = await page.waitForFunction(() => /\/company\//.test(location.pathname), { timeout: 8000 }).then(() => true).catch(() => false);
            if (ok) {
              await this.browserManager.delay(500);
              const final = page.url();
              console.log(`✅ Navigated via suggestions: ${final}`);
              return final;
            }
          }
        }
      } catch {}

      // Attempt 2 (fallback): Navigate to full-text search and try to match from results
      const searchUrl = `${this.SCREENER_BASE_URL}/full-text-search/?q=${encodeURIComponent(cleanName)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.browserManager.delay(800);

      const companyLinkSelector = 'a[href^="/company/"]';
      await page.waitForSelector('body', { timeout: 10000 });
      // Give the page a chance to load dynamic results and scroll a bit
      await page.evaluate(() => { window.scrollTo(0, 400); });
      await this.browserManager.delay(400);
      await page.evaluate(() => { window.scrollTo(0, 0); });
      await page.waitForSelector(companyLinkSelector, { timeout: 10000 }).catch(() => {});
      // Debug: log discovered company links and texts to help diagnose
      try {
        const debugLinks = await page.evaluate((selector: string) => {
          const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
          return Array.from(document.querySelectorAll(selector)).slice(0, 10).map(a => {
            const el = a as HTMLAnchorElement;
            const textEl = el.querySelector('span.hover-link') || el;
            return { href: el.getAttribute('href') || '', text: normalize(textEl?.textContent || '') };
          });
        }, companyLinkSelector);
        console.log('🔎 company links found:', debugLinks);
      } catch {}

      // Enhanced matching - check title, description, and "formerly known as" patterns
      const matchedHref = await page.evaluate((selector: string, targetName: string) => {
        const normalize = (s: string) => (s || '')
          .toLowerCase()
          .replace(/&/g, ' and ')
          .replace(/limited\b/g, 'ltd')
          .replace(/\./g, ' ')
          .replace(/[^a-z0-9 ]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const stop = new Set(['ltd','limited','the','co','company','plc','pvt','private','inc','corp','corporation']);
        const toTokens = (s: string) => normalize(s)
          .split(' ')
          .filter(Boolean)
          .map(t => t.endsWith('s') && t.length > 3 ? t.slice(0, -1) : t)
          .filter(t => !stop.has(t));

        const wantNorm = normalize(targetName);
        const wantTokens = toTokens(targetName);
        const keyWords = wantTokens.filter(t => t.length > 2);

        let exactHref: string | null = null;
        let bestHref: string | null = null;
        let bestScore = 0;

        const links = Array.from(document.querySelectorAll(selector));
        for (const a of links) {
          const anchor = a as HTMLAnchorElement;
          const textEl = anchor.querySelector('span.hover-link') || anchor;
          const rawText = (textEl.textContent || '').trim();
          if (!rawText) continue;
          
          // Check title match
          const textNorm = normalize(rawText);
          if (textNorm === wantNorm || textNorm === wantNorm.replace(/\blimited\b/g, 'ltd') || textNorm === wantNorm.replace(/\bltd\b/g, 'limited')) {
            exactHref = anchor.getAttribute('href');
            break;
          }

          // Check description text for "formerly known as" or similar
          const parentEl = anchor.closest('div, li, tr') || anchor.parentElement;
          const descText = parentEl ? (parentEl.textContent || '') : '';
          
          // Look for "formerly known as" patterns
          const formerlyMatch = descText.match(/formerly known as\s+([^)]+)/i);
          if (formerlyMatch) {
            const formerName = normalize(formerlyMatch[1]);
            if (formerName === wantNorm || formerName.includes(wantNorm) || wantNorm.includes(formerName)) {
              exactHref = anchor.getAttribute('href');
              break;
            }
          }

          // Enhanced token matching - check if key words are present
          const titleTokens = toTokens(rawText);
          const descTokens = toTokens(descText);
          const allTokens = [...new Set([...titleTokens, ...descTokens])];
          
          let keyWordMatches = 0;
          keyWords.forEach(kw => {
            if (allTokens.some(t => t.includes(kw) || kw.includes(t))) {
              keyWordMatches++;
            }
          });
          
          const keyWordScore = keyWordMatches / Math.max(keyWords.length, 1);
          
          // Traditional token overlap
          const setWant = new Set(wantTokens);
          const setText = new Set(allTokens);
          let overlap = 0;
          setWant.forEach(t => { if (setText.has(t)) overlap++; });
          const denom = Math.max(setWant.size, setText.size, 1);
          const tokenScore = overlap / denom;

          // Combined score with higher weight for key words
          const combinedScore = (keyWordScore * 0.7) + (tokenScore * 0.3);
          const lengthRatio = Math.min(allTokens.length, wantTokens.length) / Math.max(allTokens.length, wantTokens.length);
          
          if (combinedScore >= 0.6 && lengthRatio >= 0.4 && combinedScore > bestScore) {
            bestScore = combinedScore;
            bestHref = anchor.getAttribute('href');
          }
        }

        return exactHref || bestHref || null;
      }, companyLinkSelector, cleanName);

      if (!matchedHref) {
        console.log(`❌ No matching company link for: ${cleanName}`);
        // Final fallback: use Screener's internal search API to resolve company slug
        try {
          const apiHref = await page.evaluate(async (query: string) => {
            const normalize = (s: string) => (s || '')
              .toLowerCase()
              .replace(/&/g, ' and ')
              .replace(/limited\b/g, 'ltd')
              .replace(/\./g, ' ')
              .replace(/[^a-z0-9 ]+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const stop = new Set(['ltd','limited','the','co','company','plc','pvt','private','inc','corp','corporation']);
            const toTokens = (s: string) => normalize(s)
              .split(' ')
              .filter(Boolean)
              .map(t => t.endsWith('s') && t.length > 3 ? t.slice(0, -1) : t)
              .filter(t => !stop.has(t));
            const wantNorm = normalize(query);
            const wantTokens = toTokens(query);
            try {
              const res = await fetch(`/api/company/search/?q=${encodeURIComponent(query)}`, { credentials: 'include' });
              if (!res.ok) return null;
              const data = await res.json();
              const entries = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
              let exact: string | null = null;
              let best: { href: string | null; score: number } = { href: null, score: 0 };
              for (const item of entries) {
                const name = normalize((item?.name ?? item?.title ?? ''));
                const url = (item?.url ?? item?.slug ?? '') as string;
                const href = url.startsWith('/company/') ? url : (url ? `/company/${url}/` : null);
                if (!href) continue;
                if (name === wantNorm || name === wantNorm.replace(/\blimited\b/g, 'ltd') || name === wantNorm.replace(/\bltd\b/g, 'limited')) {
                  exact = href; break;
                }
                const tokens = toTokens(item?.name ?? '');
                const setW = new Set(wantTokens); const setT = new Set(tokens);
                let overlap = 0; setW.forEach(t => { if (setT.has(t)) overlap++; });
                const denom = Math.max(setW.size, setT.size, 1);
                const score = overlap / denom;
                if (score >= 0.7 && score > best.score) best = { href, score };
              }
              return exact || best.href || null;
            } catch { return null; }
          }, cleanName);

          if (apiHref) {
            const finalUrl = `${this.SCREENER_BASE_URL}${apiHref.replace(this.SCREENER_BASE_URL, '')}`;
            await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
            const ok = await page.waitForFunction(() => /\/company\//.test(location.pathname), { timeout: 10000 }).then(() => true).catch(() => false);
            if (ok) {
              await this.browserManager.delay(400);
              console.log(`✅ Navigated via API fallback: ${page.url()}`);
              return page.url();
            }
          }
        } catch {}
        return null;
      }

      if (matchedHref) {
        await page.click(`a[href='${matchedHref}']`).catch(() => {});
      }
      // Wait until URL switches to a company page; fallback: navigate directly using href
      const switched = await page.waitForFunction(() => /\/company\//.test(location.pathname), { timeout: 30000 }).then(() => true).catch(() => false);
      if (!switched && matchedHref) {
        // Use known base URL on Node side (no window.location here)
        const fallbackUrl = `${this.SCREENER_BASE_URL}${matchedHref}`;
        await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await page.waitForFunction(() => /\/company\//.test(location.pathname), { timeout: 10000 }).catch(() => {});
      }
      await this.browserManager.delay(800);

      const finalUrl = page.url();
      console.log(`✅ Navigated via search results: ${finalUrl}`);
      return finalUrl;
    } catch (error) {
      console.error(`❌ Search error for ${stockName}:`, error);
      return null;
    }
  }

  private cleanStockName(name: string): string {
    return name
      .replace(/[\r\n\t]+/g, ' ')            // collapse whitespace
      .replace(/^[-–—•·\s]+/, '')            // remove leading bullets/dashes
      .replace(/\s+/g, ' ')                   // collapse multiple spaces
      .trim();
  }

  // Extract stock details from screener.in page
  private async extractStockDetails(page: Page, stockName: string, stockSymbol: string, sector: string): Promise<StockData | null> {
    try {
      console.log(`📊 Extracting details for: ${stockName}`);
      
      const stockData: StockData = {
        stockName,
        stockSymbol,
        sector,
        screenerUrl: page.url()
      };

      // Wait for page to load
      await page.waitForSelector('body', { timeout: 10000 });

      // Extract basic info from header
      try {
        const priceSelector = '.company-price, .price, [data-testid="price"]';
        const priceElement = await page.$(priceSelector);
        if (priceElement) {
          const priceText = await page.evaluate(el => el.textContent, priceElement);
          const price = this.parseNumber(priceText);
          if (price) stockData.currentPrice = price;
        }
      } catch (error) {
        console.log('Could not extract current price');
      }

      // Extract market cap (label-value pairs commonly used on Screener)
      {
        const v = await this.findMetricNumber(page, ['Market Cap', 'Market cap']);
        if (v !== null) stockData.marketCap = v;
      }

      // Extract PE ratio
      {
        const v = await this.findMetricNumber(page, ['P/E', 'PE']);
        if (v !== null) stockData.pe = v;
      }

      // Extract PB ratio
      {
        const v = await this.findMetricNumber(page, ['P/B', 'PB']);
        if (v !== null) stockData.pb = v;
      }

      // Extract Debt to Equity
      {
        const v = await this.findMetricNumber(page, ['Debt to equity', 'Debt/Equity']);
        if (v !== null) stockData.debtToEquity = v;
      }

      // Extract ROE
      {
        const v = await this.findMetricNumber(page, ['ROE']);
        if (v !== null) stockData.roe = v;
      }

      // Extract ROA
      {
        const v = await this.findMetricNumber(page, ['ROA']);
        if (v !== null) stockData.roa = v;
      }

      // Extract EPS
      {
        const v = await this.findMetricNumber(page, ['EPS']);
        if (v !== null) stockData.eps = v;
      }

      // Extract Book Value
      {
        const v = await this.findMetricNumber(page, ['Book Value']);
        if (v !== null) stockData.bookValue = v;
      }

      // Extract Dividend Yield
      {
        const v = await this.findMetricNumber(page, ['Dividend yield', 'Dividend Yield']);
        if (v !== null) stockData.dividendYield = v;
      }

      // Extract Face Value
      {
        const v = await this.findMetricNumber(page, ['Face value', 'Face Value']);
        if (v !== null) stockData.faceValue = v;
      }

      // Try to navigate to Balance Sheet tab (top nav)
      try {
        console.log('🖱️ Looking for Balance Sheet tab...');
        const tabSelector = 'a[href="#balance-sheet"]';
        const tab = await page.$(tabSelector);
        if (tab) {
          console.log('✅ Clicking Balance Sheet tab');
          // Use JS click to avoid overlay issues and ensure visibility
          await page.evaluate((sel: string) => {
            const a = document.querySelector(sel) as HTMLAnchorElement | null;
            if (a) {
              a.scrollIntoView({ behavior: 'instant', block: 'center' });
              (a as HTMLElement).click();
            }
          }, tabSelector);
          await page.waitForSelector('#balance-sheet', { timeout: 20000 }).catch(() => {});
          await page.waitForSelector('#balance-sheet table', { timeout: 20000 }).catch(() => {});
          await this.browserManager.delay(500);
        } else {
          // Fallback: scroll to section by id
          await page.evaluate(() => {
            const el = document.getElementById('balance-sheet');
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
          });
        }
      } catch {}

      // If still not on balance sheet, scroll to section and parse
      try {
        console.log('📑 Parsing balance sheet...');
        const bsData = await this.extractBalanceSheet(page);
        if (bsData) {
          stockData.balanceSheet = bsData;
          console.log(`📄 Balance sheet rows: ${bsData.rows.length}`);
        }
      } catch {}

      // Peers table extraction using section#peers
      try {
        console.log('📑 Parsing peers table...');
        // Click the anchor and ensure section visible
        await page.evaluate(() => {
          const a = document.querySelector('a[href="#peers"]') as HTMLElement | null;
          if (a) { a.scrollIntoView({ behavior: 'instant', block: 'center' }); a.click(); }
        });
        await page.waitForSelector('section#peers', { timeout: 20000 }).catch(() => {});
        await page.evaluate(() => {
          const sec = document.querySelector('section#peers') as HTMLElement | null;
          if (sec) sec.scrollIntoView({ behavior: 'instant', block: 'start' });
        });
        await this.browserManager.delay(600);

        const peers = await page.evaluate(() => {
          const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
          const section = document.querySelector('section#peers');
          const table = section ? section.querySelector('table') : null;
          if (!table) return null;
          const headers: string[] = [];
          const ths = table.querySelectorAll('thead th, thead td');
          if (ths && ths.length > 0) ths.forEach(th => headers.push(normalize(th.textContent || '')));
          else {
            const fr = table.querySelector('tr');
            if (fr) fr.querySelectorAll('th,td').forEach(th => headers.push(normalize(th.textContent || '')));
          }
          const rows: Array<{ label: string; values: number[] }> = [];
          const body = table.querySelector('tbody') || table;
          body.querySelectorAll('tr').forEach(tr => {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length === 0) return;
            const label = normalize(tds[1]?.textContent || tds[0]?.textContent || '');
            if (!label) return;
            const values: number[] = [];
            for (let i = 2; i < tds.length; i++) {
              const raw = normalize(tds[i].textContent || '').replace(/[₹,\s]/g, '');
              const num = parseFloat(raw);
              values.push(Number.isFinite(num) ? num : 0);
            }
            rows.push({ label, values });
          });
          return { headers, rows };
        });

        if (peers && peers.rows && peers.rows.length > 0) {
          stockData.peers = peers;
          console.log(`👥 Peers rows: ${peers.rows.length}`);
        }
      } catch {}

      // Additional sections: cash-flow, profit-loss, ratios, shareholding/investors
      const parseSectionTable = async (sectionId: string, label: string): Promise<{ headers: string[]; rows: Array<{ label: string; values: number[] }> } | null> => {
        try {
          await page.bringToFront().catch(() => {});
          // Click sub-nav anchor if available to ensure the section is active/visible
          const anchorSel = `a[href="#${sectionId}"]`;
          const hasAnchor = await page.$(anchorSel);
          if (hasAnchor) {
            await page.evaluate((sel: string) => {
              const a = document.querySelector(sel) as HTMLElement | null;
              if (a) {
                a.scrollIntoView({ behavior: 'instant', block: 'center' });
                a.click();
              }
            }, anchorSel);
          }
          // Ensure section is in view
          await page.waitForSelector(`section#${sectionId}`, { timeout: 20000 }).catch(() => {});
          await page.evaluate((sid: string) => {
            const sec = document.querySelector(`section#${sid}`) as HTMLElement | null;
            if (sec) sec.scrollIntoView({ behavior: 'instant', block: 'start' });
          }, sectionId);
          await this.browserManager.delay(800);
          const data = await page.evaluate((sid: string) => {
            const normalize = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
            const section = document.querySelector(`section#${sid}`);
            const table = section ? section.querySelector('table') : null;
            if (!table) return null;
            const headers: string[] = [];
            const ths = table.querySelectorAll('thead th, thead td');
            if (ths && ths.length > 0) ths.forEach(th => headers.push(normalize(th.textContent || '')));
            else {
              const fr = table.querySelector('tr');
              if (fr) fr.querySelectorAll('th,td').forEach(th => headers.push(normalize(th.textContent || '')));
            }
            const rows: Array<{ label: string; values: number[] }> = [];
            const body = table.querySelector('tbody') || table;
            body.querySelectorAll('tr').forEach(tr => {
              const tds = Array.from(tr.querySelectorAll('td'));
              if (tds.length === 0) return;
              const label = normalize(tds[0]?.textContent || '');
              if (!label) return;
              const values: number[] = [];
              for (let i = 1; i < tds.length; i++) {
                const raw = normalize(tds[i].textContent || '').replace(/[₹,\s]/g, '');
                const num = parseFloat(raw);
                values.push(Number.isFinite(num) ? num : 0);
              }
              rows.push({ label, values });
            });
            return { headers, rows };
          }, sectionId);
          if (data && data.rows.length > 0) {
            console.log(`📄 ${label} rows: ${data.rows.length}`);
            return data;
          }
          return null;
        } catch {
          return null;
        }
      };

      // Parse each section
      const cashFlow = await parseSectionTable('cash-flow', 'Cash Flow');
      if (cashFlow) stockData.cashFlow = cashFlow;
      const profitLoss = await parseSectionTable('profit-loss', 'Profit & Loss');
      if (profitLoss) stockData.profitLoss = profitLoss;
      const ratios = await parseSectionTable('ratios', 'Ratios');
      if (ratios) stockData.ratios = ratios;
      const investors = await parseSectionTable('shareholding', 'Investors');
      if (investors) stockData.investors = investors;

      // Quarters table
      const quarters = await parseSectionTable('quarters', 'Quarters');
      if (quarters) stockData.quarters = quarters;

      // Analysis pros/cons texts
      try {
        await page.evaluate(() => {
          const a = document.querySelector('a[href="#analysis"]') as HTMLElement | null;
          if (a) { a.scrollIntoView({ behavior: 'instant', block: 'center' }); a.click(); }
        });
        await page.waitForSelector('section#analysis', { timeout: 10000 }).catch(() => {});
        await this.browserManager.delay(400);
        const analysis = await page.evaluate(() => {
          const getList = (sel: string) => Array.from(document.querySelectorAll(`${sel} li`)).map(el => (el.textContent || '').trim()).filter(Boolean);
          const pros = getList('section#analysis .pros');
          const cons = getList('section#analysis .cons');
          return { pros, cons };
        });
        if (analysis && (analysis.pros.length > 0 || analysis.cons.length > 0)) {
          stockData.analysis = analysis;
          console.log(`📝 Analysis: pros ${analysis.pros.length}, cons ${analysis.cons.length}`);
        }
      } catch {}

      console.log(`✅ Extracted data for: ${stockName}`);
      return stockData;
    } catch (error) {
      console.error(`❌ Error extracting details for ${stockName}:`, error);
      return null;
    }
  }

  // Helper method to parse numbers from text
  private parseNumber(text: string | null): number | null {
    if (!text) return null;
    
    // Remove common suffixes and clean text
    const cleanText = text.replace(/[₹,\s]/g, '').replace(/[Kk]/g, '000').replace(/[Mm]/g, '000000').replace(/[Bb]/g, '000000000');
    
    // Extract number
    const match = cleanText.match(/-?\d+\.?\d*/);
    if (match) {
      const num = parseFloat(match[0]);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  // Helper: set input value reliably by selector list and dispatch events
  private async setInputValue(page: Page, selectors: string[], value: string): Promise<void> {
    for (const sel of selectors) {
      try {
        const handle = await page.$(sel);
        if (handle) {
          await handle.click({ clickCount: 3 }).catch(() => {});
          await page.keyboard.type(value, { delay: 10 }).catch(() => {});
          await page.evaluate((s, v) => {
            const el = document.querySelector(s) as HTMLInputElement | null;
            if (!el) return;
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, sel, value);
          return;
        }
      } catch {}
    }

    // Fallback: try to find by heuristic
    await page.evaluate((v) => {
      const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];
      const target = inputs.find(i => /email/i.test(i.type) || /email/i.test(i.name) || /email/i.test(i.placeholder) || /password/i.test(i.type));
      if (target) {
        target.value = v;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, value);
  }

  // Extract balance sheet table from current company page
  private async extractBalanceSheet(page: Page): Promise<{ headers: string[]; rows: Array<{ label: string; values: number[] }>; unit?: string; scope?: 'Consolidated' | 'Standalone' } | null> {
    try {
      // Ensure we are at balance section; scroll a bit to load tables
      await this.browserManager.delay(800);
      await page.evaluate(() => {
        const sec = document.querySelector('section#balance-sheet');
        if (sec) {
          (sec as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'start' });
        } else {
          window.scrollBy(0, 400);
        }
      });
      await this.browserManager.delay(500);
      
      const result = await page.evaluate(() => {
        const text = (el?: Element | null) => (el?.textContent || '').trim();
        const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

        // Target table strictly inside the balance-sheet section
        const section = document.querySelector('section#balance-sheet');
        let table = section ? section.querySelector('table') : null;
        // Fallback: nearest table after the section heading anchor
        if (!table) {
          const anchor = document.querySelector('a[href="#balance-sheet"]');
          if (anchor) {
            let el: Element | null = anchor.parentElement;
            while (el && !table) { table = el.querySelector('table'); el = el.parentElement; }
          }
        }
        // As a last resort, pick the first table inside any section with id containing balance-sheet
        if (!table) table = document.querySelector('section[id*="balance-sheet" i] table');
        if (!table) return null;

        const headers: string[] = [];
        const rows: Array<{ label: string; values: number[] }> = [];
        const thead = table.querySelector('thead');
        if (thead) {
          const ths = Array.from(thead.querySelectorAll('th'));
          for (const th of ths) headers.push(normalize(text(th)));
        } else {
          const firstRow = table.querySelector('tr');
          if (firstRow) {
            headers.push(...Array.from(firstRow.querySelectorAll('th,td')).map(el => normalize(text(el))));
          }
        }

        // Collect body rows (some tables may not have tbody tag)
        const body = table.querySelector('tbody') || table;
        const trs = Array.from(body.querySelectorAll('tr'));
        for (const tr of trs) {
          const tds = Array.from(tr.querySelectorAll('td'));
          if (tds.length === 0) continue;
          const label = normalize(text(tds[0]));
          if (!label) continue;
          const values: number[] = [];
          for (let i = 1; i < tds.length; i++) {
            const raw = normalize(text(tds[i])).replace(/[,₹]/g, '');
            const num = parseFloat(raw);
            values.push(isNaN(num) ? 0 : num);
          }
          rows.push({ label, values });
        }

        const metaEl = Array.from(document.querySelectorAll('*')).find(el => /Consolidated Figures/i.test(el.textContent || ''));
        const unitMatch = metaEl ? (metaEl.textContent || '').match(/Figures in\s+(.+?)\s+\/|Figures in\s+(.+)/i) : null;
        const unit = unitMatch ? (unitMatch[1] || unitMatch[2] || '').trim() : undefined;

        // Scope detection via presence of 'View Standalone'
        // If there is a button/link saying 'View Standalone', current scope is Consolidated; vice-versa
        let scope: 'Consolidated' | 'Standalone' | undefined;
        const bodyText = document.body.innerText || '';
        if (/View\s+Standalone/i.test(bodyText)) scope = 'Consolidated';
        else if (/View\s+Consolidated/i.test(bodyText)) scope = 'Standalone';

        return { headers, rows, unit, scope };
      });

      return result;
    } catch (error) {
      console.log('Balance sheet extraction failed');
      return null;
    }
  }
  // Try to find a numeric metric by its label anywhere on the page
  private async findMetricNumber(page: Page, labels: string[]): Promise<number | null> {
    try {
      const valueText = await page.evaluate((metricLabels: string[]) => {
        const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
        for (const el of all) {
          const txt = (el.textContent || '').trim();
          if (!txt) continue;
          for (const label of metricLabels) {
            if (txt.toLowerCase() === label.toLowerCase() || txt.toLowerCase().includes(label.toLowerCase())) {
              // Prefer next sibling text
              const next = el.nextElementSibling as HTMLElement | null;
              if (next && next.textContent) return next.textContent.trim();
              // Or a value within same container
              const parent = el.parentElement as HTMLElement | null;
              if (parent) {
                const spans = parent.querySelectorAll('span, div, td');
                if (spans.length > 1) {
                  const candidate = spans[spans.length - 1] as HTMLElement;
                  if (candidate && candidate !== el && candidate.textContent) {
                    return candidate.textContent.trim();
                  }
                }
              }
            }
          }
        }
        return null;
      }, labels);

      return this.parseNumber(valueText);
    } catch {
      return null;
    }
  }

  // Scrape stock details for a list of stocks
  public async scrapeStockDetails(stocks: Array<{stockName: string, stockSymbol: string, sector: string}>): Promise<StockScrapingResult> {
    const result: StockScrapingResult = {
      success: false,
      data: [],
      timestamp: new Date(),
      totalStocks: 0
    };

    try {
      console.log(`🚀 Starting stock scraping for ${stocks.length} stocks`);
      
      const browser = await this.browserManager.launch();
      
      // Prepare a temporary page for login
      const loginPage = await this.browserManager.createPage();
      await loginPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Login to screener.in
      const loginSuccess = await this.loginToScreener(loginPage);
      if (!loginSuccess) {
        throw new Error('Failed to login to screener.in');
      }
      await loginPage.close().catch(() => {});

      const scrapedStocks: StockData[] = [];
      
      for (const stock of stocks) {
        try {
          console.log(`\n📈 Processing: ${stock.stockName}`);

          // Use a fresh page per stock to avoid detached frames/closed sessions
          const page = await this.browserManager.createPage();
          try {
            // Search for the stock
            let stockUrl = await this.searchStock(page, stock.stockName);
            if (!stockUrl) {
              // one retry after short backoff
              await this.browserManager.delay(1000);
              stockUrl = await this.searchStock(page, stock.stockName);
            }
            if (!stockUrl) {
              console.log(`❌ Could not find stock: ${stock.stockName}`);
              await page.close().catch(() => {});
              continue;
            }

            // Extract stock details
            const stockData = await this.extractStockDetails(page, stock.stockName, stock.stockSymbol, stock.sector);
            if (stockData) {
              scrapedStocks.push(stockData);
              // Save to database
              await this.saveStockToDatabase(stockData);
            }
          } finally {
            await page.close().catch(() => {});
            await this.browserManager.delay(300); // small gap between stocks
          }

        } catch (error) {
          console.error(`❌ Error processing ${stock.stockName}:`, error);
          continue;
        }
      }

      result.success = true;
      result.data = scrapedStocks;
      result.totalStocks = scrapedStocks.length;
      
      console.log(`✅ Successfully scraped ${scrapedStocks.length} stocks`);
      
    } catch (error) {
      console.error('❌ Stock scraping failed:', error);
      result.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      await this.browserManager.close();
    }

    return result;
  }

  // Save stock data to database
  private async saveStockToDatabase(stockData: StockData): Promise<void> {
    try {
      // Check if stock already exists
      const existingStock = await Stock.findOne({ stockSymbol: stockData.stockSymbol });
      
      if (existingStock) {
        // Update existing stock
        await Stock.updateOne(
          { stockSymbol: stockData.stockSymbol },
          { 
            ...stockData,
            date: new Date(),
            updatedAt: new Date()
          }
        );
        console.log(`📝 Updated stock: ${stockData.stockName}`);
      } else {
        // Create new stock
        const newStock = new Stock({
          ...stockData,
          date: new Date()
        });
        await newStock.save();
        console.log(`💾 Saved new stock: ${stockData.stockName}`);
      }
    } catch (error) {
      console.error(`❌ Error saving stock ${stockData.stockName}:`, error);
    }
  }

  // Get unique stocks from DB holdings
  public async getUniqueStocksFromDB(): Promise<Array<{stockName: string, stockSymbol: string, sector: string}>> {
    try {
      const { MongoDBService } = await import('./mongodb.service');
      const mongo = new MongoDBService();
      const stocks = await mongo.getUniqueStocksFromHoldings();
      console.log(`📊 Found ${stocks.length} unique stocks from DB holdings`);
      return stocks;
    } catch (error) {
      console.error('❌ Error getting unique stocks from DB:', error);
      return [];
    }
  }
}
