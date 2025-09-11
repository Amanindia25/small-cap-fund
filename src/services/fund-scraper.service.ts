import { Page } from 'puppeteer';
import { FundData, ScrapingResult, StockHolding, PortfolioSummary, ReturnsData, RiskRatios } from '../types/fund.types';
import { BrowserManager } from '../utils/browser.util';

export class FundScraperService {
  private browserManager: BrowserManager;
  // Ensure one-time UI actions (like typing India in search)
  private indiaFilterApplied: boolean = false;

  // Smoothly scroll the page so the user can see motion
  private async slowScroll(page: Page, targetY: number): Promise<void> {
    const step = 200;
    const delayMs = 150;
    const currentY = await page.evaluate(() => window.scrollY);
    const direction = targetY > currentY ? 1 : -1;
    let y = currentY;
    while ((direction === 1 && y < targetY) || (direction === -1 && y > targetY)) {
      y = y + direction * step;
      await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'auto' }), y);
      await this.browserManager.delay(delayMs);
    }
    await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'auto' }), targetY);
  }

  // Temporarily highlight an element for visibility
  private async highlightElement(page: Page, element: any): Promise<void> {
    try {
      await page.evaluate((el) => {
        const prev = (el as HTMLElement).style.outline;
        (el as HTMLElement).setAttribute('data-prev-outline', prev || '');
        (el as HTMLElement).style.outline = '3px solid #ff5252';
        (el as HTMLElement).scrollIntoView({ block: 'center' });
      }, element);
      await this.browserManager.delay(800);
      await page.evaluate((el) => {
        const prev = (el as HTMLElement).getAttribute('data-prev-outline') || '';
        (el as HTMLElement).style.outline = prev;
      }, element);
    } catch {}
  }

  // Ensure India filter is applied on the list page; visibly scroll and type if missing
  private async ensureIndiaFilterOnList(page: Page): Promise<void> {
    try {
      const searchBox = await page.$('input[type="search"]');
      if (!searchBox) return;
      const currentVal = await page.evaluate((el) => (el as HTMLInputElement).value || '', searchBox);
      if (currentVal.toLowerCase() === 'india') return; // already applied

      const box = await searchBox.boundingBox();
      if (box) {
        await this.slowScroll(page, Math.max(0, box.y - 200));
      }
      await searchBox.click({ clickCount: 3 });
      await this.browserManager.delay(300);
      await searchBox.evaluate((el) => (el as HTMLInputElement).value = '');
      await this.browserManager.delay(300);
      await searchBox.type('india', { delay: 150 });
      await this.browserManager.delay(300);
      await searchBox.press('Enter');
      await this.browserManager.delay(1200);
      console.log('🔁 Re-applied India filter');
    } catch {}
  }

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  async scrapeSmallCapFunds(): Promise<ScrapingResult> {
    const result: ScrapingResult = {
      success: false,
      data: [],
      timestamp: new Date(),
      totalFunds: 0
    };

    try {
      const page = await this.browserManager.createPage();
      
      // Capture console logs from the browser
      page.on('console', msg => {
        console.log('BROWSER LOG:', msg.text());
      });
      
      // Navigate to the small cap funds page
      await this.browserManager.navigateToPage(
        page, 
        'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html'
      );

      // Wait for page to fully load
      await this.browserManager.delay(5000);

      // Check if page loaded correctly
      const pageTitle = await page.title();
      console.log('Page title:', pageTitle);
      
      if (pageTitle === 'Error' || pageTitle.includes('Error')) {
        console.log('❌ Page shows error, trying to reload...');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await this.browserManager.delay(5000);
      }

      // Wait for the actual portfolio data to load - look for portfolio-specific content
      try {
        await page.waitForFunction(() => {
          const text = document.body.textContent || '';
          return text.includes('Direct Plan') && text.includes('Growth') && text.includes('Equity Holding');
        }, { timeout: 20000 });
        console.log('Portfolio data loaded');
      } catch (error) {
        console.log('Portfolio data not loaded, checking page content...');
        
        // Check what's actually on the page
        const bodyText = await page.evaluate(() => document.body.textContent);
        console.log('Page body text:', bodyText?.substring(0, 500));
        
        if (bodyText && bodyText.length < 200) {
          console.log('❌ Page content too short, likely an error page');
          throw new Error('Page failed to load properly');
        }
      }

      // Search for "india" to filter only India-related funds (run once)
      if (!this.indiaFilterApplied) {
        console.log('Filtering for India data...');
        try {
          // Use the correct selector for the portfolio search box
          const searchBox = await page.$('input[type="search"]');
          
          if (searchBox) {
            console.log('🔍 Found correct search box');
            
            // Get search box position and scroll to it
            console.log('📜 Scrolling to search box...');
            const box = await searchBox.boundingBox();
            if (box) {
              // Smoothly scroll to search box so the user sees motion
              await this.slowScroll(page, Math.max(0, box.y - 200));
            }
            
            console.log('👆 Clicking on search box...');
            await searchBox.click();
            await this.browserManager.delay(1000);
            
            console.log('🧹 Clearing search box...');
            await searchBox.evaluate((el) => (el as HTMLInputElement).value = '');
            await this.browserManager.delay(1000);
            
            console.log('✍️ Typing "india" in search box...');
            await searchBox.type('india', { delay: 200 }); // Slower typing for visibility
            await this.browserManager.delay(1000);
            
            // Press Enter to trigger search
            console.log('🔍 Pressing Enter to trigger search...');
            await searchBox.press('Enter');
            await this.browserManager.delay(3000); // Wait for search results to load
            console.log('✅ Applied India filter - you should see filtered results now!');
            this.indiaFilterApplied = true;
          } else {
            console.log('❌ Search box not found, proceeding without filter');
          }
        } catch (error) {
          console.log('Error applying India filter:', error);
        }
      } else {
        console.log('ℹ️ India filter already applied earlier - skipping.');
      }

      // Ensure Direct Plans checkbox is checked
      await this.ensureDirectPlansChecked(page);

      // Wait for table to update
      await this.browserManager.delay(3000);

      // Extract fund data from the table
      let funds = await this.extractFundData(page);
      
      // If no funds found after India filter, try without filter
      if (funds.length === 0) {
        console.log('🔄 No funds found with India filter, trying without filter...');
        
        // Clear the search box
        try {
          const searchBox = await page.$('input[type="search"]');
          if (searchBox) {
            await searchBox.click();
            await searchBox.evaluate((el) => (el as HTMLInputElement).value = '');
            await searchBox.press('Enter');
            await this.browserManager.delay(2000);
            console.log('🧹 Cleared search filter');
          }
        } catch (error) {
          console.log('Error clearing search:', error);
        }
        
        // Try extracting again
        funds = await this.extractFundData(page);
        console.log(`📊 Found ${funds.length} funds without filter`);
      }
      
      result.data = funds;
      result.totalFunds = funds.length;
      result.success = true;

      await page.close();
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Scraping failed:', result.error);
    }

    return result;
  }

  private async ensureDirectPlansChecked(page: Page): Promise<void> {
    try {
      // Look for Direct Plans checkbox and check it if not already checked
      const directPlansCheckbox = await page.$('input[type="checkbox"]');
      if (directPlansCheckbox) {
        const isChecked = await page.evaluate((el) => el.checked, directPlansCheckbox);
        if (!isChecked) {
          await directPlansCheckbox.click();
          console.log('Checked Direct Plans checkbox');
          await this.browserManager.delay(1000); // Wait for page to update
        }
      }
    } catch (error) {
      console.log('Could not find or interact with Direct Plans checkbox:', error);
    }
  }

  private async extractFundData(page: Page): Promise<FundData[]> {
    console.log('Extracting fund data...');
    
    const funds = await page.evaluate(() => {
      const fundRows: FundData[] = [];
      
      // Debug: Check what's actually on the page
      console.log('=== DEBUGGING PAGE STRUCTURE ===');
      console.log('Page title:', document.title);
      console.log('Body text length:', document.body.textContent?.length || 0);
      console.log('All divs with class containing "table":', document.querySelectorAll('div[class*="table"]').length);
      console.log('All divs with class containing "section":', document.querySelectorAll('div[class*="section"]').length);
      console.log('All tables:', document.querySelectorAll('table').length);
      console.log('All divs:', document.querySelectorAll('div').length);
      
      // Try multiple selectors for the table
      const possibleSelectors = [
        '.table_section',
        '.table-section', 
        '.portfolio-table',
        '.fund-table',
        'table',
        '.data-table',
        '[class*="table"]',
        '[class*="portfolio"]'
      ];
      
      let tableSection = null;
      for (const selector of possibleSelectors) {
        tableSection = document.querySelector(selector);
        if (tableSection) {
          console.log(`Found table with selector: ${selector}`);
          break;
        }
      }
      
      if (!tableSection) {
        console.log('No table section found with any selector');
        console.log('Available classes:', Array.from(document.querySelectorAll('*')).map(el => el.className).filter(c => c).slice(0, 20));
        return [];
      }
      
      console.log('Found table section, looking for rows...');
      
      // Look for table rows or divs that contain fund data
      const rows = tableSection.querySelectorAll('tr, div[class*="row"], div[class*="item"]');
      console.log(`Found ${rows.length} potential rows`);
      
      rows.forEach((row, index) => {
        try {
          const rowText = row.textContent || '';
          console.log(`Row ${index + 1}: ${rowText.substring(0, 200)}...`);
          
          // Check if this row contains a fund name and portfolio data
          if (rowText.includes('Direct Plan') && 
              rowText.includes('Growth') && 
              !rowText.includes('Sponsored Adv') &&
              (rowText.includes('%') || rowText.includes('stars'))) {
            
            console.log(`Processing fund row ${index + 1}`);
            
            // Extract fund name and URL - look for the pattern before "Direct Plan" or "Regular Plan"
            let fundName = '';
            let fundUrl = '';
            const directIndex = rowText.indexOf('Direct Plan');
            const regularIndex = rowText.indexOf('Regular Plan');
            const planIndex = directIndex > 0 ? directIndex : regularIndex;
            
            if (planIndex > 0) {
              const beforePlan = rowText.substring(0, planIndex).trim();
              // Clean up the fund name
              fundName = beforePlan.replace(/\s+/g, ' ').trim();
              
              // Remove "Sponsored Adv" and "Invest Now" if present
              fundName = fundName.replace(/Sponsored Adv.*?Invest Now/g, '').trim();
              
              // Take the full fund name (don't truncate)
              if (fundName.length > 100) {
                // Only truncate if extremely long
                fundName = fundName.substring(0, 100) + '...';
              }
            }
            
            // No need to extract URL since we'll click on fund names directly
            // The fund name link will be used for clicking in scrapeIndividualHoldings
            
            if (!fundName) {
              console.log(`No fund name found in row ${index + 1}`);
              return;
            }
            
            console.log(`Fund name: "${fundName}"`);
            
            // Extract portfolio data from the row text
            const parts = rowText.trim().split(/\s+/);
            console.log(`Row parts: ${parts.slice(0, 20).join(' | ')}...`);
            
            let crisilRating: number | undefined;
            let turnoverRatio: number | undefined;
            let equityHolding: number | undefined;
            let numberOfStocks: number | undefined;
            let debtHolding: number | undefined;
            let numberOfDebtHoldings: number | undefined;
            let cashHolding: number | undefined;

            // Find CRISIL rating (look for numbers 1-5)
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              if (part.match(/^[1-5]$/)) {
                crisilRating = parseInt(part);
                console.log(`Found CRISIL rating: ${crisilRating}`);
                break;
              }
            }

            // Find percentage values and numbers
            const percentages: number[] = [];
            const numbers: number[] = [];

            for (let i = 0; i < parts.length; i++) {
              const part = parts[i].replace(/,/g, '');

              // Check for percentage values (like 99.28%, 0.72%)
              if (part.includes('%')) {
                const value = parseFloat(part.replace('%', ''));
                if (!isNaN(value) && value >= 0 && value <= 100) {
                  percentages.push(value);
                  console.log(`Found percentage: ${value}%`);
                }
              }
              // Check for whole numbers (likely stock counts like 80, 70, 68)
              else if (!isNaN(parseFloat(part)) && parseFloat(part) > 0 && parseFloat(part) < 1000 && !part.includes('.')) {
                numbers.push(parseFloat(part));
                console.log(`Found number: ${parseFloat(part)}`);
              }
              // Check for decimal numbers (like turnover ratios 26.00)
              else if (!isNaN(parseFloat(part)) && parseFloat(part) > 0 && parseFloat(part) < 1000 && part.includes('.')) {
                numbers.push(parseFloat(part));
                console.log(`Found decimal number: ${parseFloat(part)}`);
              }
            }
            
            console.log(`Total percentages found: ${percentages.length}, numbers found: ${numbers.length}`);
            
            // Assign values based on the portfolio table structure from screenshot
            // Order: Turnover ratio, Equity Holding %, Number of stocks, Debt Holding %, Number of debt holdings, Cash Holding %
            
            // First percentage is usually turnover ratio (if present and > 10)
            if (percentages.length >= 1 && percentages[0] > 10) {
              turnoverRatio = percentages[0];
            }
            
            // Largest percentage is usually equity holding
            if (percentages.length >= 1) {
              const maxPercentage = Math.max(...percentages);
              if (maxPercentage > 50) { // Equity holding should be > 50%
                equityHolding = maxPercentage;
              }
            }
            
            // Find the number of stocks - it's usually the largest number that's not a rating
            if (numbers.length >= 1) {
              // Filter out CRISIL ratings (1-5) and find the largest remaining number
              const stockNumbers = numbers.filter(num => num > 5 && num < 1000);
              if (stockNumbers.length > 0) {
                // Take the largest number that's likely a stock count
                numberOfStocks = Math.max(...stockNumbers);
              } else {
                // If no numbers > 5, take the largest number
                numberOfStocks = Math.max(...numbers);
              }
            }
            
            // Look for debt holding (smaller percentage)
            if (percentages.length >= 2) {
              const debtPercentage = percentages.find(p => p > 0 && p < 10); // Debt is usually small
              if (debtPercentage) {
                debtHolding = debtPercentage;
              }
            }
            
            // Second number might be debt holdings count
            if (numbers.length >= 2) {
              numberOfDebtHoldings = numbers[1];
            }
            
            // Look for cash holding (small percentage)
            if (percentages.length >= 2) {
              const cashPercentage = percentages.find(p => p > 0 && p < 10 && p !== debtHolding);
              if (cashPercentage) {
                cashHolding = cashPercentage;
              }
            }
            
            const fund: FundData = {
              schemeName: fundName,
              crisilRating: crisilRating,
              portfolio: {
                turnoverRatio: turnoverRatio,
                equityHolding: equityHolding,
                numberOfStocks: numberOfStocks,
                debtHolding: debtHolding,
                numberOfDebtHoldings: numberOfDebtHoldings,
                mfHolding: undefined,
                cashHolding: cashHolding,
                otherHolding: undefined
              },
              planType: 'Direct Plan',
              isSponsored: false
            };
            
            fundRows.push(fund);
            console.log(`✅ Added fund: ${fundName} with equity: ${equityHolding}%, stocks: ${numberOfStocks}`);
          }
        } catch (error) {
          console.log(`❌ Error processing row ${index + 1}:`, error);
        }
      });
      
      return fundRows;
    });

    return funds;
  }

  private parseReturn(text: string | null | undefined): number | undefined {
    if (!text) return undefined;
    const cleaned = text.trim().replace('%', '').replace('-', '');
    if (cleaned === '' || cleaned === '-') return undefined;
    return parseFloat(cleaned) || undefined;
  }

  private parseReturnFromParts(parts: string[], period: string): number | undefined {
    // This is a simplified version - in a real implementation, you'd need to map
    // the parts array to the correct return values based on the table structure
    return undefined;
  }

  async scrapeIndividualHoldings(fundName: string, page: Page): Promise<{ holdings: StockHolding[], portfolioSummary?: PortfolioSummary, returns?: ReturnsData, riskRatios?: RiskRatios }> {
    try {
      console.log(`\n🔍 ===== STARTING ENHANCED SCRAPING FOR: ${fundName} =====`);
      console.log(`📊 Step 1: Locating fund link on the main list page...`);
      
      // Find fund link using robust selector and click with navigation wait
      let linkHandle: any = null;
      const handle = await page.evaluateHandle((name) => {
        const root = name.split(' - ')[0];
        console.log(`🔎 Looking for fund: "${name}" or root: "${root}"`);
        
        // Find the table row that contains the fund text and is not sponsored
        const rows = Array.from(document.querySelectorAll('tr')) as HTMLElement[];
        console.log(`📋 Found ${rows.length} table rows to search through`);
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowTextFull = (row.textContent || '').trim();
          const rowText = rowTextFull.toLowerCase();
          if (!rowText) continue;
          
          console.log(`🔍 Checking row ${i + 1}: ${rowText.substring(0, 100)}...`);
          
          if (rowText.includes('sponsored')) {
            console.log(`⏭️ Skipping sponsored row ${i + 1}`);
            continue; // skip sponsored rows
          }
          
          const isMatch = rowTextFull.includes(name) || (rowTextFull.includes(root) && (rowTextFull.includes('Direct') || rowTextFull.includes('Regular')));
          if (isMatch) {
            console.log(`✅ Found matching row ${i + 1} for fund: ${name}`);
            // Click the first anchor with robo_medium inside this row
            const anchor = row.querySelector('a.robo_medium, a');
            if (anchor) {
              console.log(`🔗 Found clickable link in row ${i + 1}`);
              return anchor;
            }
          }
        }
        console.log(`❌ No matching fund link found for: ${name}`);
        return null;
      }, fundName);
      linkHandle = handle.asElement();

      if (!linkHandle) {
        console.log(`⚠️ Could not find fund link for: ${fundName}`);
        return { holdings: [] };
      }

      console.log(`📜 Step 2: Scrolling to fund link and highlighting it...`);
      const box = await linkHandle.boundingBox();
      if (box) {
        console.log(`📍 Fund link position: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);
        await this.slowScroll(page, Math.max(0, box.y - 200));
        await this.highlightElement(page, linkHandle);
        console.log(`✅ Successfully scrolled to and highlighted fund link`);
      }

      // Open fund in a new visible tab instead of navigating away
      console.log(`🔗 Step 3: Opening fund in a new tab...`);
      const href: string | null = await page.evaluate((el: Element) => (el as HTMLAnchorElement).getAttribute('href'), linkHandle);
      if (!href) {
        console.log('⚠️ Link has no href, skipping');
        return { holdings: [] };
      }
      const absoluteUrl = href.startsWith('http') ? href : `https://www.moneycontrol.com${href}`;
      console.log(`🌐 Fund URL: ${absoluteUrl}`);
      
      const fundPage = await this.browserManager.createPage();
      console.log(`📄 Created new page for fund details`);
      
      console.log(`⏳ Navigating to fund page...`);
      await fundPage.goto(absoluteUrl, { waitUntil: 'networkidle2' });
      console.log(`✅ Successfully loaded fund page`);
      
      // Wait for the fund page to load
      console.log(`⏳ Waiting for fund page to fully load...`);
      await this.browserManager.delay(3000);
      console.log(`✅ Fund page loaded and ready for scraping`);

      // Scrape Portfolio tab data
      console.log(`\n📊 ===== SCRAPING PORTFOLIO TAB =====`);
      const portfolioData = await this.scrapePortfolioTab(fundPage);
      console.log(`✅ Portfolio tab scraping completed: ${portfolioData.holdings.length} holdings found`);
      
      // Scrape Returns tab data
      console.log(`\n📈 ===== SCRAPING RETURNS TAB =====`);
      const returnsData = await this.scrapeReturnsTab(fundPage);
      console.log(`✅ Returns tab scraping completed: ${returnsData ? Object.keys(returnsData).length : 0} return periods found`);
      
      // Scrape Risk ratios data
      console.log(`\n⚠️ ===== SCRAPING RISK RATIOS TAB =====`);
      const riskRatios = await this.scrapeRiskRatios(fundPage);
      console.log(`✅ Risk ratios scraping completed: ${riskRatios ? Object.keys(riskRatios).length : 0} risk metrics found`);
      
      // Close the fund tab and show the main list again
      console.log(`\n↩️ ===== RETURNING TO MAIN LIST =====`);
      console.log(`🔄 Closing fund tab...`);
      await fundPage.close();
      await this.browserManager.delay(500);
      console.log(`✅ Fund tab closed`);
      
      // Re-apply India filter after returning to list (some sites reset filter)
      console.log(`🔁 Re-applying India filter on main list...`);
      await this.ensureIndiaFilterOnList(page);
      console.log(`✅ India filter re-applied`);
      
      console.log(`\n📊 ===== SCRAPING SUMMARY FOR ${fundName} =====`);
      console.log(`✅ Individual Holdings: ${portfolioData.holdings.length} stocks scraped`);
      
      // Log extracted data for debugging
      if (portfolioData.portfolioSummary) {
        console.log(`📋 Portfolio Summary: Equity ${portfolioData.portfolioSummary.equityHolding}%, Stocks ${portfolioData.portfolioSummary.numberOfStocks}`);
        if (portfolioData.portfolioSummary.largeCapPercentage) console.log(`📊 Large Cap: ${portfolioData.portfolioSummary.largeCapPercentage}%`);
        if (portfolioData.portfolioSummary.midCapPercentage) console.log(`📊 Mid Cap: ${portfolioData.portfolioSummary.midCapPercentage}%`);
        if (portfolioData.portfolioSummary.smallCapPercentage) console.log(`📊 Small Cap: ${portfolioData.portfolioSummary.smallCapPercentage}%`);
      }
      
      if (returnsData && Object.keys(returnsData).length > 0) {
        console.log(`📈 Returns Data Found:`);
        if (returnsData.oneMonth) console.log(`   - 1 Month: ${returnsData.oneMonth}%`);
        if (returnsData.threeMonth) console.log(`   - 3 Month: ${returnsData.threeMonth}%`);
        if (returnsData.sixMonth) console.log(`   - 6 Month: ${returnsData.sixMonth}%`);
        if (returnsData.oneYear) console.log(`   - 1 Year: ${returnsData.oneYear}%`);
        if (returnsData.threeYear) console.log(`   - 3 Year: ${returnsData.threeYear}%`);
      } else {
        console.log(`❌ No returns data found`);
      }
      
      if (riskRatios && Object.keys(riskRatios).length > 0) {
        console.log(`⚠️ Risk Ratios Found:`);
        if (riskRatios.sharpeRatio) console.log(`   - Sharpe Ratio: ${riskRatios.sharpeRatio}`);
        if (riskRatios.beta) console.log(`   - Beta: ${riskRatios.beta}`);
        if (riskRatios.standardDeviation) console.log(`   - Standard Deviation: ${riskRatios.standardDeviation}`);
        if (riskRatios.treynorRatio) console.log(`   - Treynor Ratio: ${riskRatios.treynorRatio}`);
        if (riskRatios.jensenAlpha) console.log(`   - Jensen Alpha: ${riskRatios.jensenAlpha}`);
      } else {
        console.log(`❌ No risk ratios data found`);
      }
      
      console.log(`\n✅ ===== ENHANCED SCRAPING COMPLETED FOR ${fundName} =====\n`);
      
      return {
        holdings: portfolioData.holdings,
        portfolioSummary: portfolioData.portfolioSummary,
        returns: returnsData,
        riskRatios: riskRatios
      };
      
    } catch (error) {
      console.error(`\n❌ ===== ERROR IN ENHANCED SCRAPING FOR ${fundName} =====`);
      console.error(`💥 Error details:`, error);
      console.error(`❌ ===== END ERROR =====\n`);
      return { holdings: [] };
    }
  }


  async scrapePortfolioTab(fundPage: Page): Promise<{ holdings: StockHolding[], portfolioSummary?: PortfolioSummary }> {
    try {
      console.log('📊 Step 1: Looking for Portfolio/Holdings tab...');
      
      // Try to find and click on "Portfolio" or "Holdings" tab
      const clicked = await fundPage.evaluate(() => {
        console.log('🔍 Searching for Portfolio/Holdings tab...');
        const links = Array.from(document.querySelectorAll('a, .nav-link, .tab, li')) as HTMLElement[];
        console.log(`📋 Found ${links.length} potential tab links`);
        
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          const text = link.textContent?.toLowerCase() || '';
          console.log(`🔍 Checking link ${i + 1}: "${text}"`);
          
          if (text.includes('portfolio') || text.includes('holdings') || text.includes('equity')) {
            console.log(`✅ Found Portfolio tab: "${text}"`);
            (link as HTMLElement).click();
            return true;
          }
        }
        console.log('❌ No Portfolio tab found');
        return false;
      });
      
      if (clicked) {
        console.log('✅ Successfully clicked on Portfolio tab');
        await this.browserManager.delay(3000);
        console.log('⏳ Waiting for Portfolio tab to load...');
      } else {
        console.log('⚠️ Portfolio tab not found with text search, trying selectors...');
        // Fallback to selector-based approach
        const portfolioSelectors = [
          'a[href*="portfolio"]',
          'a[href*="holdings"]',
          '.tab[data-tab*="portfolio"]',
          '.nav-link[href*="portfolio"]',
          '.nav-link[href*="holdings"]'
        ];
        
        for (const selector of portfolioSelectors) {
          try {
            console.log(`🔍 Trying selector: ${selector}`);
            const tab = await fundPage.$(selector);
            if (tab) {
              console.log(`✅ Found tab with selector: ${selector}`);
              await tab.click();
              await this.browserManager.delay(3000);
              console.log(`✅ Clicked on Portfolio tab with selector: ${selector}`);
              break;
            } else {
              console.log(`❌ No element found with selector: ${selector}`);
            }
          } catch (selectorError) {
            console.log(`❌ Selector ${selector} failed:`, selectorError);
          }
        }
      }

      // Wait for holdings table to load
      console.log('📊 Step 2: Waiting for holdings table to load...');
      try {
        console.log('🔍 Looking for table elements...');
        await fundPage.waitForSelector('.table-responsive table, table', { timeout: 15000 });
        console.log('✅ Found table elements');
        
        console.log('🔍 Waiting for table rows to populate...');
        await fundPage.waitForFunction(() => {
          const candidates = Array.from(document.querySelectorAll('.table-responsive table, table')) as HTMLTableElement[];
          console.log(`📋 Found ${candidates.length} table candidates`);
          
          for (let i = 0; i < candidates.length; i++) {
            const t = candidates[i];
            const body = t.querySelector('tbody') || t;
            const rows = body.querySelectorAll('tr');
            console.log(`📊 Table ${i + 1}: ${rows.length} rows`);
            if (rows.length > 0) {
              console.log(`✅ Table ${i + 1} has data rows`);
              return true;
            }
          }
          console.log('⏳ No tables with data rows yet, waiting...');
          return false;
        }, { timeout: 15000 });
        console.log('✅ Holdings table loaded with data rows');
      } catch (error) {
        console.log('⚠️ No populated holdings rows detected:', error);
      }

      // Check if "View complete holding" link exists and click it
      console.log('📊 Step 3: Looking for "View complete holding" link...');
      const hasCompleteHoldings = await fundPage.evaluate(() => {
        console.log('🔍 Searching for "View complete holding" link...');
        const links = Array.from(document.querySelectorAll('a, button')) as HTMLElement[];
        console.log(`📋 Found ${links.length} potential links to check`);
        
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          const text = link.textContent?.toLowerCase() || '';
          console.log(`🔍 Checking link ${i + 1}: "${text}"`);
          
          if (text.includes('view complete') || text.includes('complete holding') || text.includes('all holdings')) {
            console.log(`✅ Found "View complete holding" link: "${text}"`);
            (link as HTMLElement).click();
            return true;
          }
        }
        console.log('❌ No "View complete holding" link found');
        return false;
      });

      if (hasCompleteHoldings) {
        console.log('✅ Successfully clicked "View complete holding" link');
        console.log('⏳ Waiting for complete holdings to load...');
        await this.browserManager.delay(3000); // Wait for complete holdings to load
        console.log('✅ Complete holdings should be loaded now');
      } else {
        console.log('ℹ️ No "View complete holding" link found, proceeding with available holdings');
      }

      // Extract holdings and portfolio summary
      console.log('📊 Step 4: Extracting holdings data from tables...');
      const result = await fundPage.evaluate(() => {
        const stockHoldings: StockHolding[] = [];
        let portfolioSummary: PortfolioSummary | undefined;
        
        console.log('🔍 Step 4a: Identifying the correct table by header labels...');
        // Identify the correct table by header labels
        const candidateTables = Array.from(document.querySelectorAll('.table-responsive table, table')) as HTMLTableElement[];
        console.log(`📋 Found ${candidateTables.length} candidate tables`);
        
        let table: HTMLTableElement | null = null;
        let colIndex = { name: 0, pct: 1, value: -1, sector: -1, qty: -1, change: -1 } as { 
          name: number; pct: number; value: number; sector: number; qty: number; change: number 
        };
        
        for (let i = 0; i < candidateTables.length; i++) {
          const t = candidateTables[i];
          console.log(`🔍 Checking table ${i + 1}...`);
          
          const headCells = Array.from(t.querySelectorAll('thead th, thead td')) as HTMLElement[];
          if (headCells.length === 0) {
            console.log(`❌ Table ${i + 1}: No header cells found`);
            continue;
          }
          
          const labels = headCells.map(h => (h.textContent || '').toLowerCase());
          console.log(`📋 Table ${i + 1} headers: ${labels.join(' | ')}`);
          
          const nameIdx = labels.findIndex(l => l.includes('company') || l.includes('stock') || l.includes('instrument'));
          const pctIdx = labels.findIndex(l => l.includes('holding') || l.includes('weight') || l.includes('%'));
          const valIdx = labels.findIndex(l => l.includes('market') || l.includes('value') || l.includes('amount') || l.includes('₹'));
          const sectorIdx = labels.findIndex(l => l.includes('sector') || l.includes('industry'));
          const qtyIdx = labels.findIndex(l => l.includes('quantity') || l.includes('qty') || l.includes('shares'));
          const changeIdx = labels.findIndex(l => l.includes('change') || l.includes('1m'));
          
          console.log(`📊 Table ${i + 1} column indices: name=${nameIdx}, pct=${pctIdx}, value=${valIdx}, sector=${sectorIdx}, qty=${qtyIdx}, change=${changeIdx}`);
          
          if (nameIdx !== -1 && pctIdx !== -1) {
            console.log(`✅ Table ${i + 1} is the holdings table!`);
            table = t;
            colIndex = { name: nameIdx, pct: pctIdx, value: valIdx, sector: sectorIdx, qty: qtyIdx, change: changeIdx };
            break;
          } else {
            console.log(`❌ Table ${i + 1} doesn't have required columns`);
          }
        }
        
        if (!table) {
          console.log('❌ No suitable holdings table found');
          return { stockHoldings, portfolioSummary };
        }
        
        console.log('✅ Found holdings table, extracting data...');
        
        if (table) {
          const body = table.querySelector('tbody') || table;
          const rows = Array.from(body.querySelectorAll('tr')) as HTMLTableRowElement[];
          console.log(`📊 Found ${rows.length} data rows to process`);
          
          rows.forEach((row, index) => {
            try {
              console.log(`🔍 Processing row ${index + 1}...`);
              const cells = Array.from(row.querySelectorAll('td')) as HTMLTableCellElement[];
              if (cells.length < 2) {
                console.log(`❌ Row ${index + 1}: Not enough cells (${cells.length})`);
                return;
              }
              
              const rowText = (row.textContent || '').toLowerCase();
              if (!rowText || rowText.includes('no data')) {
                console.log(`❌ Row ${index + 1}: Empty or no data`);
                return;
              }
              
              console.log(`📋 Row ${index + 1} text: ${rowText.substring(0, 100)}...`);
              
              // Use header-mapped columns when available; fallback to heuristics
              let nameCell = cells[colIndex.name] || cells.find(c => (c.textContent || '').trim().length > 1);
              let pctCell = cells[colIndex.pct] || cells.find(c => (c.textContent || '').includes('%'));
              let valueCell = colIndex.value !== -1 ? cells[colIndex.value] : cells.find(c => /(₹|,|\d)\d/.test(c.textContent || ''));
              let sectorCell = colIndex.sector !== -1 ? cells[colIndex.sector] : undefined;
              let qtyCell = colIndex.qty !== -1 ? cells[colIndex.qty] : undefined;
              let changeCell = colIndex.change !== -1 ? cells[colIndex.change] : undefined;
              
              const stockName = (nameCell?.textContent || '').trim();
              const percentageText = (pctCell?.textContent || '').replace(/\s+/g, ' ').trim();
              const marketValueText = (valueCell?.textContent || '').replace(/\s+/g, ' ').trim();
              const sectorText = (sectorCell?.textContent || '').trim();
              const qtyText = (qtyCell?.textContent || '').trim();
              const changeText = (changeCell?.textContent || '').trim();
              
              console.log(`📊 Row ${index + 1} data: name="${stockName}", pct="${percentageText}", value="${marketValueText}", sector="${sectorText}"`);
              
              if (!stockName || !percentageText.includes('%')) {
                console.log(`❌ Row ${index + 1}: Missing stock name or percentage`);
                return;
              }
              
              const percentage = parseFloat(percentageText.replace('%', '').replace(/,/g, ''));
              if (isNaN(percentage) || percentage <= 0) {
                console.log(`❌ Row ${index + 1}: Invalid percentage: ${percentageText}`);
                return;
              }
              
              const marketValue = parseFloat((marketValueText || '0').replace(/[₹,]/g, ''));
              if (isNaN(marketValue)) {
                console.log(`❌ Row ${index + 1}: Invalid market value: ${marketValueText}`);
                return;
              }
              
              // Skip if stock name is empty or too short
              if (!stockName || stockName.length < 2) {
                console.log(`❌ Row ${index + 1}: Stock name too short: "${stockName}"`);
                return;
              }
              
              const holding: StockHolding = {
                stockName,
                stockSymbol: stockName.substring(0, 10),
                percentage,
                sector: sectorText || 'Unknown',
                marketValue,
                quantity: qtyText ? parseFloat(qtyText.replace(/,/g, '')) : undefined,
                oneMonthChange: changeText ? parseFloat(changeText.replace('%', '').replace(/,/g, '')) : undefined
              };
              
              stockHoldings.push(holding);
              console.log(`✅ Row ${index + 1}: Added holding - ${stockName} (${percentage}%) - ${sectorText || 'Unknown'} sector`);
              
            } catch (error) {
              console.log(`❌ Row ${index + 1}: Error processing -`, error);
            }
          });
          
          console.log(`📊 Total holdings extracted: ${stockHoldings.length}`);
        }
        
        // Try to extract portfolio summary from the page
        const summaryText = document.body.textContent || '';
        
        // Look for equity holding percentage
        const equityMatch = summaryText.match(/equity\s*holding[:\s]*(\d+\.?\d*)\s*%/i);
        const equityHolding = equityMatch ? parseFloat(equityMatch[1]) : undefined;
        
        // Look for number of stocks
        const stocksMatch = summaryText.match(/no\s*of\s*stocks[:\s]*(\d+)/i);
        const numberOfStocks = stocksMatch ? parseInt(stocksMatch[1]) : undefined;
        
        // Look for large/mid/small cap breakdown
        const largeCapMatch = summaryText.match(/large\s*cap[:\s]*(\d+\.?\d*)\s*%/i);
        const largeCapPercentage = largeCapMatch ? parseFloat(largeCapMatch[1]) : undefined;
        
        const midCapMatch = summaryText.match(/mid\s*cap[:\s]*(\d+\.?\d*)\s*%/i);
        const midCapPercentage = midCapMatch ? parseFloat(midCapMatch[1]) : undefined;
        
        const smallCapMatch = summaryText.match(/small\s*cap[:\s]*(\d+\.?\d*)\s*%/i);
        const smallCapPercentage = smallCapMatch ? parseFloat(smallCapMatch[1]) : undefined;
        
        // Look for top stock weights
        const top5Match = summaryText.match(/top\s*5[:\s]*(\d+\.?\d*)\s*%/i);
        const top5StockWeight = top5Match ? parseFloat(top5Match[1]) : undefined;
        
        const top10Match = summaryText.match(/top\s*10[:\s]*(\d+\.?\d*)\s*%/i);
        const top10StockWeight = top10Match ? parseFloat(top10Match[1]) : undefined;
        
        // Look for top sector weight
        const top3SectorMatch = summaryText.match(/top\s*3\s*sector[:\s]*(\d+\.?\d*)\s*%/i);
        const top3SectorWeight = top3SectorMatch ? parseFloat(top3SectorMatch[1]) : undefined;
        
        if (equityHolding && numberOfStocks) {
          portfolioSummary = {
            equityHolding,
            numberOfStocks,
            largeCapPercentage,
            midCapPercentage,
            smallCapPercentage,
            top5StockWeight,
            top10StockWeight,
            top3SectorWeight
          };
        }
        
        return { stockHoldings, portfolioSummary };
      });
      
      return {
        holdings: result.stockHoldings,
        portfolioSummary: result.portfolioSummary
      };
      
    } catch (error) {
      console.error('❌ Error scraping Portfolio tab:', error);
      return { holdings: [] };
    }
  }

  async scrapeReturnsTab(fundPage: Page): Promise<ReturnsData | undefined> {
    try {
      console.log('📈 Step 1: Looking for Returns/Performance tab...');
      
      // Try to find and click on "Returns" tab
      const clicked = await fundPage.evaluate(() => {
        console.log('🔍 Searching for Returns/Performance tab...');
        const links = Array.from(document.querySelectorAll('a, .nav-link, .tab, li')) as HTMLElement[];
        console.log(`📋 Found ${links.length} potential tab links`);
        
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          const text = link.textContent?.toLowerCase() || '';
          console.log(`🔍 Checking link ${i + 1}: "${text}"`);
          
          if (text.includes('returns') || text.includes('performance')) {
            console.log(`✅ Found Returns tab: "${text}"`);
            (link as HTMLElement).click();
            return true;
          }
        }
        console.log('❌ No Returns tab found');
        return false;
      });
      
      if (clicked) {
        console.log('✅ Successfully clicked on Returns tab');
        await this.browserManager.delay(3000);
        console.log('⏳ Waiting for Returns tab to load...');
      } else {
        console.log('⚠️ Returns tab not found, proceeding with current page');
      }

      // Extract returns data
      console.log('📈 Step 2: Extracting returns data...');
      const returnsData = await fundPage.evaluate(() => {
        const returns: ReturnsData = {};
        
        console.log('🔍 Looking for returns table or data...');
        // Look for returns table or data
        const tables = Array.from(document.querySelectorAll('table')) as HTMLTableElement[];
        console.log(`📋 Found ${tables.length} tables to check for returns data`);
        
        let returnsTable: HTMLTableElement | null = null;
        
        // Find table with returns data
        for (let i = 0; i < tables.length; i++) {
          const table = tables[i];
          const tableText = table.textContent?.toLowerCase() || '';
          console.log(`🔍 Checking table ${i + 1}: ${tableText.substring(0, 100)}...`);
          
          if (tableText.includes('return') || tableText.includes('performance') || 
              tableText.includes('1m') || tableText.includes('3m') || tableText.includes('1y')) {
            console.log(`✅ Table ${i + 1} contains returns data`);
            returnsTable = table;
            break;
          } else {
            console.log(`❌ Table ${i + 1} doesn't contain returns data`);
          }
        }
        
        if (returnsTable) {
          const rows = Array.from(returnsTable.querySelectorAll('tr')) as HTMLTableRowElement[];
          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, th')) as HTMLTableCellElement[];
            if (cells.length >= 2) {
              const firstCell = cells[0].textContent?.toLowerCase() || '';
              const secondCell = cells[1].textContent?.trim() || '';
              
              // Extract return values based on cell content
              if (firstCell.includes('1m') || firstCell.includes('1 month')) {
                const value = parseFloat(secondCell.replace('%', '').replace(/,/g, ''));
                if (!isNaN(value)) returns.oneMonth = value;
              } else if (firstCell.includes('3m') || firstCell.includes('3 month')) {
                const value = parseFloat(secondCell.replace('%', '').replace(/,/g, ''));
                if (!isNaN(value)) returns.threeMonth = value;
              } else if (firstCell.includes('6m') || firstCell.includes('6 month')) {
                const value = parseFloat(secondCell.replace('%', '').replace(/,/g, ''));
                if (!isNaN(value)) returns.sixMonth = value;
              } else if (firstCell.includes('1y') || firstCell.includes('1 year')) {
                const value = parseFloat(secondCell.replace('%', '').replace(/,/g, ''));
                if (!isNaN(value)) returns.oneYear = value;
              } else if (firstCell.includes('3y') || firstCell.includes('3 year')) {
                const value = parseFloat(secondCell.replace('%', '').replace(/,/g, ''));
                if (!isNaN(value)) returns.threeYear = value;
              }
            }
          });
        }
        
        // Fallback: Look for return percentages in page text
        if (Object.keys(returns).length === 0) {
          const bodyText = document.body.textContent || '';
          const patterns = {
            oneMonth: /1\s*month[:\s]*([+-]?\d+\.?\d*)\s*%/i,
            threeMonth: /3\s*month[:\s]*([+-]?\d+\.?\d*)\s*%/i,
            sixMonth: /6\s*month[:\s]*([+-]?\d+\.?\d*)\s*%/i,
            oneYear: /1\s*year[:\s]*([+-]?\d+\.?\d*)\s*%/i,
            threeYear: /3\s*year[:\s]*([+-]?\d+\.?\d*)\s*%/i
          };
          
          for (const [key, pattern] of Object.entries(patterns)) {
            const match = bodyText.match(pattern);
            if (match) {
              const value = parseFloat(match[1]);
              if (!isNaN(value)) {
                (returns as any)[key] = value;
              }
            }
          }
        }
        
        return returns;
      });
      
      return Object.keys(returnsData).length > 0 ? returnsData : undefined;
      
    } catch (error) {
      console.error('❌ Error scraping Returns tab:', error);
      return undefined;
    }
  }

  async scrapeRiskRatios(fundPage: Page): Promise<RiskRatios | undefined> {
    try {
      console.log('⚠️ Scraping Risk ratios...');
      
      // Try to find and click on "Risk" or "Ratios" tab
      const clicked = await fundPage.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a, .nav-link, .tab, li')) as HTMLElement[];
        const riskLink = links.find(link => {
          const text = link.textContent?.toLowerCase() || '';
          return text.includes('risk') || text.includes('ratio') || text.includes('ratios');
        });
        if (riskLink) {
          (riskLink as HTMLElement).click();
          return true;
        }
        return false;
      });
      
      if (clicked) {
        await this.browserManager.delay(3000);
        console.log('✅ Clicked on Risk/Ratios tab');
      }

      // Extract risk ratios data
      const riskRatios = await fundPage.evaluate(() => {
        const ratios: RiskRatios = {};
        
        // Look for risk ratios table or data
        const tables = Array.from(document.querySelectorAll('table')) as HTMLTableElement[];
        let riskTable: HTMLTableElement | null = null;
        
        // Find table with risk data
        for (const table of tables) {
          const tableText = table.textContent?.toLowerCase() || '';
          if (tableText.includes('risk') || tableText.includes('ratio') || 
              tableText.includes('sharpe') || tableText.includes('beta') || 
              tableText.includes('standard deviation')) {
            riskTable = table;
            break;
          }
        }
        
        if (riskTable) {
          const rows = Array.from(riskTable.querySelectorAll('tr')) as HTMLTableRowElement[];
          rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, th')) as HTMLTableCellElement[];
            if (cells.length >= 2) {
              const firstCell = cells[0].textContent?.toLowerCase() || '';
              const secondCell = cells[1].textContent?.trim() || '';
              
              // Extract risk ratio values based on cell content
              if (firstCell.includes('standard deviation')) {
                const value = parseFloat(secondCell.replace(/,/g, ''));
                if (!isNaN(value)) ratios.standardDeviation = value;
              } else if (firstCell.includes('beta')) {
                const value = parseFloat(secondCell.replace(/,/g, ''));
                if (!isNaN(value)) ratios.beta = value;
              } else if (firstCell.includes('sharpe')) {
                const value = parseFloat(secondCell.replace(/,/g, ''));
                if (!isNaN(value)) ratios.sharpeRatio = value;
              } else if (firstCell.includes('treynor')) {
                const value = parseFloat(secondCell.replace(/,/g, ''));
                if (!isNaN(value)) ratios.treynorRatio = value;
              } else if (firstCell.includes('jensen') && firstCell.includes('alpha')) {
                const value = parseFloat(secondCell.replace(/,/g, ''));
                if (!isNaN(value)) ratios.jensenAlpha = value;
              }
            }
          });
        }
        
        // Fallback: Look for risk ratio values in page text
        if (Object.keys(ratios).length === 0) {
          const bodyText = document.body.textContent || '';
          const patterns = {
            standardDeviation: /standard\s*deviation[:\s]*(\d+\.?\d*)/i,
            beta: /beta[:\s]*(\d+\.?\d*)/i,
            sharpeRatio: /sharpe\s*ratio[:\s]*(\d+\.?\d*)/i,
            treynorRatio: /treynor[:\s]*(\d+\.?\d*)/i,
            jensenAlpha: /jensen[:\s]*alpha[:\s]*([+-]?\d+\.?\d*)/i
          };
          
          for (const [key, pattern] of Object.entries(patterns)) {
            const match = bodyText.match(pattern);
            if (match) {
              const value = parseFloat(match[1]);
              if (!isNaN(value)) {
                (ratios as any)[key] = value;
              }
            }
          }
        }
        
        return ratios;
      });
      
      return Object.keys(riskRatios).length > 0 ? riskRatios : undefined;
      
    } catch (error) {
      console.error('❌ Error scraping Risk ratios:', error);
      return undefined;
    }
  }

  async scrapeFundWithHoldings(fundData: FundData, page: Page): Promise<FundData> {
    try {
      // Scrape individual holdings by clicking on fund name
      const result = await this.scrapeIndividualHoldings(fundData.schemeName, page);
      
      // Add all scraped data to fund data
      return {
        ...fundData,
        individualHoldings: result.holdings,
        portfolioSummary: result.portfolioSummary,
        returns: result.returns,
        riskRatios: result.riskRatios
      };
      
    } catch (error) {
      console.error(`❌ Error scraping fund with holdings:`, error);
      return fundData;
    }
  }

  private extractPortfolioData(line: string): any {
    // Parse the line to extract portfolio data
    const parts = line.trim().split(/\s+/);
    
    // Look for patterns in the data
    let crisilRating: number | undefined;
    let turnoverRatio: number | undefined;
    let equityHolding: number | undefined;
    let numberOfStocks: number | undefined;
    let debtHolding: number | undefined;
    let numberOfDebtHoldings: number | undefined;
    let cashHolding: number | undefined;
    
    // Find CRISIL rating (look for numbers 1-5)
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.match(/^[1-5]$/)) {
        crisilRating = parseInt(part);
        break;
      }
    }
    
    // Find percentage values and numbers
    const percentages: number[] = [];
    const numbers: number[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].replace(/,/g, '');
      
      // Check for percentage values
      if (part.includes('%')) {
        const value = parseFloat(part.replace('%', ''));
        if (!isNaN(value)) {
          percentages.push(value);
        }
      }
      // Check for whole numbers (likely stock counts)
      else if (!isNaN(parseFloat(part)) && parseFloat(part) > 0 && parseFloat(part) < 1000) {
        numbers.push(parseFloat(part));
      }
    }
    
    // Assign values based on the portfolio table structure we can see
    // From the web content: Turnover ratio, Equity Holding %, Number of stocks, Debt Holding %, Number of debt holdings, MF Holding %, Cash Holding %, Other Holding %
    
    if (percentages.length >= 1) {
      turnoverRatio = percentages[0]; // First percentage is turnover ratio
    }
    
    if (percentages.length >= 2) {
      equityHolding = percentages[1]; // Second percentage is equity holding
    }
    
    if (numbers.length >= 1) {
      numberOfStocks = numbers[0]; // First number is number of stocks
    }
    
    if (percentages.length >= 3) {
      debtHolding = percentages[2]; // Third percentage might be debt holding
    }
    
    if (numbers.length >= 2) {
      numberOfDebtHoldings = numbers[1]; // Second number might be debt holdings count
    }
    
    if (percentages.length >= 4) {
      cashHolding = percentages[3]; // Fourth percentage might be cash holding
    }
    
    return {
      crisilRating,
      turnoverRatio,
      equityHolding,
      numberOfStocks,
      debtHolding,
      numberOfDebtHoldings,
      mfHolding: undefined, // Usually not present in small cap funds
      cashHolding,
      otherHolding: undefined // Usually not present in small cap funds
    };
  }
}

