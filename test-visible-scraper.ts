import { BrowserManager } from './src/utils/browser.util';
import { FundScraperService } from './src/services/fund-scraper.service';
import { ScrapingConfig } from './src/types/fund.types';

async function testVisibleScraper() {
  console.log('🚀 Starting VISIBLE Scraper Test...');
  console.log('👁️ You will see the browser window and all scraping actions!');
  
  // Create config with visible browser
  const config: ScrapingConfig = {
    url: 'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html',
    headless: false, // Always visible
    timeout: 60000,
    delay: 1000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  
  const browserManager = new BrowserManager(config);
  const scraperService = new FundScraperService(browserManager);
  
  try {
    // Launch browser (you'll see it open)
    console.log('🌐 Launching browser...');
    await browserManager.launch();
    console.log('✅ Browser launched - you should see the Chrome window!');
    
    // Create main page
    const mainPage = await browserManager.createPage();
    console.log('📄 Created main page');
    
    // Navigate to small cap funds page
    console.log('🔗 Navigating to small cap funds page...');
    await browserManager.navigateToPage(
      mainPage, 
      'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html'
    );
    console.log('✅ Page loaded - you should see the funds list!');
    
    // Wait for user to see the page
    console.log('⏳ Waiting 5 seconds for you to see the page...');
    await browserManager.delay(5000);
    
    // Scrape first few funds with visible feedback
    console.log('📊 Starting to scrape funds with VISIBLE feedback...');
    const result = await scraperService.scrapeSmallCapFunds();
    
    if (result.success && result.data.length > 0) {
      console.log(`✅ Scraped ${result.data.length} funds successfully!`);
      
      // Test enhanced scraping for first fund (you'll see new tab open)
      const firstFund = result.data[0];
      console.log(`🔍 Testing VISIBLE scraping for: ${firstFund.schemeName}`);
      console.log('👁️ Watch for:');
      console.log('   - New tab opening');
      console.log('   - Banner appearing');
      console.log('   - Tabs being highlighted');
      console.log('   - Tables being highlighted');
      console.log('   - Scrolling and clicking');
      
      // Test enhanced scraping
      const enhancedResult = await scraperService.scrapeFundWithHoldings(firstFund, mainPage);
      
      console.log('📈 Enhanced Fund Data:');
      console.log(`- Fund Name: ${enhancedResult.schemeName}`);
      console.log(`- Individual Holdings: ${enhancedResult.individualHoldings?.length || 0} stocks scraped`);
      console.log(`- Portfolio Summary: ${enhancedResult.portfolioSummary ? 'Available' : 'Not available'}`);
      console.log(`- Returns Data: ${enhancedResult.returns ? 'Available' : 'Not available'}`);
      
      if (enhancedResult.individualHoldings && enhancedResult.individualHoldings.length > 0) {
        console.log('\n📊 Sample Holdings:');
        enhancedResult.individualHoldings.slice(0, 3).forEach((holding, index) => {
          console.log(`  ${index + 1}. ${holding.stockName} - ${holding.percentage}% (${holding.sector})`);
        });
      }
      
    } else {
      console.log('❌ Scraping failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('⏳ Waiting 5 seconds before closing browser...');
    await browserManager.delay(5000);
    await browserManager.close();
    console.log('🏁 Test completed - browser closed');
  }
}

// Run the test
testVisibleScraper().catch(console.error);
