import { BrowserManager } from './utils/browser.util';
import { FundScraperService } from './services/fund-scraper.service';
import { DataProcessor } from './utils/data-processor.util';
import { ScrapingConfig } from './types/fund.types';

async function main() {
  console.log('🚀 Starting Small Cap Fund Scraper...\n');

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
    console.log('🌐 Launching browser...');
    await browserManager.launch();

    // Scrape fund data
    console.log('📊 Scraping small cap fund data...');
    const result = await scraperService.scrapeSmallCapFunds();

    if (result.success) {
      console.log('✅ Scraping completed successfully!');
      
      // Clean and process data
      const cleanedData = DataProcessor.cleanFundData(result.data);
      console.log(`📈 Found ${cleanedData.length} valid funds`);

      // Generate summary
      const summary = DataProcessor.generateSummary({ ...result, data: cleanedData });
      console.log(summary);

      // Save data
      DataProcessor.saveToJSON(cleanedData);
      DataProcessor.saveToCSV(cleanedData);

      // Show top funds
      DataProcessor.printTopFunds(cleanedData, 10);

    } else {
      console.error('❌ Scraping failed:', result.error);
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  } finally {
    // Clean up
    console.log('\n🧹 Closing browser...');
    await browserManager.close();
    console.log('✨ Done!');
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the scraper
main().catch(console.error);
