import { BrowserManager } from './src/utils/browser.util';
import { FundScraperService } from './src/services/fund-scraper.service';
import { ScrapingConfig } from './src/types/fund.types';

async function testEnhancedLogging() {
  console.log('🚀 Testing Enhanced Logging System...\n');
  
  // Configuration
  const config: ScrapingConfig = {
    url: 'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html',
    headless: false, // Set to false to see browser in action
    timeout: 60000,
    delay: 1000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  
  const browserManager = new BrowserManager(config);
  const scraperService = new FundScraperService(browserManager);
  
  try {
    // Launch browser
    await browserManager.launch();
    console.log('✅ Browser launched\n');
    
    // Create a page and navigate to the main list
    const page = await browserManager.createPage();
    await browserManager.navigateToPage(page, 'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html');
    await browserManager.delay(3000);
    
    console.log('📊 Main page loaded, starting enhanced scraping test...\n');
    
    // Test with a sample fund name
    const testFundName = "Invesco India Smallcap Fund - Direct - Growth";
    
    // This will show all the detailed logging
    const result = await scraperService.scrapeIndividualHoldings(testFundName, page);
    
    console.log('\n📊 ===== FINAL TEST RESULTS =====');
    console.log(`✅ Holdings found: ${result.holdings.length}`);
    console.log(`✅ Portfolio Summary: ${result.portfolioSummary ? 'Available' : 'Not available'}`);
    console.log(`✅ Returns Data: ${result.returns ? Object.keys(result.returns).length + ' periods' : 'Not available'}`);
    console.log(`✅ Risk Ratios: ${result.riskRatios ? Object.keys(result.riskRatios).length + ' metrics' : 'Not available'}`);
    
    if (result.holdings.length > 0) {
      console.log('\n📈 Sample Holdings:');
      result.holdings.slice(0, 3).forEach((holding, index) => {
        console.log(`  ${index + 1}. ${holding.stockName} - ${holding.percentage}% (${holding.sector})`);
      });
    }
    
    await page.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browserManager.close();
    console.log('\n🏁 Enhanced logging test completed');
  }
}

// Run the test
testEnhancedLogging().catch(console.error);
