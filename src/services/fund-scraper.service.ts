import { Page } from 'puppeteer';
import { FundData, ScrapingResult } from '../types/fund.types';
import { BrowserManager } from '../utils/browser.util';

export class FundScraperService {
  private browserManager: BrowserManager;

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

      // Search for "india" to filter only India-related funds
      console.log('Filtering for India data...');
      try {
        // Try multiple selectors for the portfolio search box (not the global search)
        const searchSelectors = [
          'input[type="search"]', // Portfolio search box is type="search"
          'input[class*="form-control"]', // DataTable search input
          '#dataTableId_filter input', // Specific to the portfolio table
          'input[aria-controls="dataTableId"]', // DataTable search input
          'input[placeholder*="Search"]',
          'input[name*="search"]',
          'input[class*="search"]'
        ];
        
        let searchBox = null;
        for (const selector of searchSelectors) {
          searchBox = await page.$(selector);
          if (searchBox) {
            console.log(`Found search box with selector: ${selector}`);
            break;
          }
        }
        
        if (searchBox) {
          console.log('🔍 Clicking search box...');
          await searchBox.click();
          await this.browserManager.delay(1000);
          
          console.log('🧹 Clearing search box...');
          await searchBox.evaluate((el) => (el as HTMLInputElement).value = '');
          await this.browserManager.delay(1000);
          
          console.log('✍️ Typing "india" in search box...');
          await searchBox.type('india', { delay: 100 }); // Type slowly to see it
          await this.browserManager.delay(1000);
          
          // Press Enter to trigger search
          console.log('🔍 Pressing Enter to trigger search...');
          await searchBox.press('Enter');
          await this.browserManager.delay(3000); // Wait for search results to load
          console.log('✅ Applied India filter - you should see filtered results now!');
        } else {
          console.log('❌ Search box not found, proceeding without filter');
        }
      } catch (error) {
        console.log('Error applying India filter:', error);
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
          const searchBox = await page.$('input[type="text"]');
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
            
            // Extract fund name - look for the pattern before "Direct Plan" or "Regular Plan"
            let fundName = '';
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
