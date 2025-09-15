import { BrowserManager } from './src/utils/browser.util';
import { FundScraperService } from './src/services/fund-scraper.service';
import { MongoDBService } from './src/services/mongodb.service';
import { ScrapingConfig } from './src/types/fund.types';
import { connectDB } from './src/config/database';

async function testEnhancedScraper() {
  console.log('🚀 Starting Enhanced Scraper Test...');
  
  // Create proper config for BrowserManager
  const config: ScrapingConfig = {
    url: 'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html',
    headless: false,
    timeout: 60000,
    delay: 1000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
  
  const browserManager = new BrowserManager(config);
  const scraperService = new FundScraperService(browserManager);
  const mongoService = new MongoDBService();
  
  try {
    // Initialize browser and database
    await browserManager.launch();
    await connectDB();
    
    console.log('✅ Browser and Database initialized');
    
    // Test scraping with enhanced data extraction
    console.log('📊 Starting enhanced scraping...');
    const result = await scraperService.scrapeSmallCapFunds();
    
    if (result.success && result.data.length > 0) {
      console.log(`✅ Scraped ${result.data.length} funds successfully`);
      
      // Test enhanced scraping for first fund
      const firstFund = result.data[0];
      console.log(`🔍 Testing enhanced scraping for: ${firstFund.schemeName}`);
      
      // Create a mock page for testing individual fund scraping
      const page = await browserManager.createPage();
      await page.goto('https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html', { waitUntil: 'networkidle2' });
      
      // Test enhanced scraping
      const enhancedResult = await scraperService.scrapeFundWithHoldings(firstFund, page);
      
      console.log('📈 Enhanced Fund Data:');
      console.log(`- Fund Name: ${enhancedResult.schemeName}`);
      console.log(`- Individual Holdings: ${enhancedResult.individualHoldings?.length || 0} stocks`);
      console.log(`- Portfolio Summary: ${enhancedResult.portfolioSummary ? 'Available' : 'Not available'}`);
      console.log(`- Returns Data: ${enhancedResult.returns ? 'Available' : 'Not available'}`);
      console.log(`- Risk Ratios: ${enhancedResult.riskRatios ? 'Available' : 'Not available'}`);
      
      if (enhancedResult.individualHoldings && enhancedResult.individualHoldings.length > 0) {
        console.log('\n📊 Sample Holdings:');
        enhancedResult.individualHoldings.slice(0, 3).forEach((holding, index) => {
          console.log(`  ${index + 1}. ${holding.stockName} - ${holding.percentage}% (${holding.sector})`);
        });
      }
      
      if (enhancedResult.portfolioSummary) {
        console.log('\n📋 Portfolio Summary:');
        console.log(`  - Equity Holding: ${enhancedResult.portfolioSummary.equityHolding}%`);
        console.log(`  - Number of Stocks: ${enhancedResult.portfolioSummary.numberOfStocks}`);
      }
      
      if (enhancedResult.returns) {
        console.log('\n📈 Returns Data:');
        if (enhancedResult.returns.oneMonth) console.log(`  - 1 Month: ${enhancedResult.returns.oneMonth}%`);
        if (enhancedResult.returns.threeMonth) console.log(`  - 3 Month: ${enhancedResult.returns.threeMonth}%`);
        if (enhancedResult.returns.oneYear) console.log(`  - 1 Year: ${enhancedResult.returns.oneYear}%`);
      }
      
      if (enhancedResult.riskRatios) {
        console.log('\n⚠️ Risk Ratios:');
        if (enhancedResult.riskRatios.sharpeRatio) console.log(`  - Sharpe Ratio: ${enhancedResult.riskRatios.sharpeRatio}`);
        if (enhancedResult.riskRatios.beta) console.log(`  - Beta: ${enhancedResult.riskRatios.beta}`);
        if (enhancedResult.riskRatios.standardDeviation) console.log(`  - Standard Deviation: ${enhancedResult.riskRatios.standardDeviation}`);
      }
      
      await page.close();
      
      // Save enhanced data to MongoDB
      console.log('\n💾 Saving enhanced data to MongoDB...');
      for (const fundData of result.data) {
        await mongoService.saveFund(fundData);
      }
      console.log('✅ Enhanced data saved to MongoDB');
      
    } else {
      console.log('❌ Scraping failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browserManager.close();
    console.log('🏁 Test completed');
  }
}

// Run the test
testEnhancedScraper().catch(console.error);