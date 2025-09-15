import { BrowserManager } from './utils/browser.util';
import { FundScraperService } from './services/fund-scraper.service';
import { MongoDBService } from './services/mongodb.service';
import { DataProcessor } from './utils/data-processor.util';
import { ScrapingConfig, FundData } from './types/fund.types';
import { connectDB } from './config/database';
// import { logger } from './utils/logger.util';
// import { handleAsync, AppError } from './utils/error-handler.util';

async function main() {
  console.log('🚀 Starting Small Cap Fund Scraper...\n');

  // Configuration
  const config: ScrapingConfig = {
    url: 'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html',
    headless: false, // Always visible for user to see scraping process
    timeout: 60000,
    delay: 1000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  const browserManager = new BrowserManager(config);
  const scraperService = new FundScraperService(browserManager);
  const mongoService = new MongoDBService();

  try {
    // Connect to MongoDB
    console.log('🗄️ Connecting to MongoDB...');
    await connectDB();

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

      // Show top funds
      DataProcessor.printTopFunds(cleanedData, 10);

      // Save to MongoDB with individual holdings and enhanced data
      console.log('\n💾 Saving data to MongoDB...');
      let savedFunds = 0;
      let savedHoldings = 0;
      const enhancedFunds: FundData[] = [];

      // Use the same page for individual fund scraping (no new page needed)
      const mainPage = await browserManager.createPage();
      
      // Navigate to main page first
      await browserManager.navigateToPage(mainPage, 'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html');
      await browserManager.delay(3000);
      
      // Note: India filter is already applied manually by user
      
      for (const fundData of cleanedData) {
        try {
          // Scrape individual holdings for each fund
          console.log(`🔍 Scraping holdings for: ${fundData.schemeName}`);
          const fundWithHoldings = await scraperService.scrapeFundWithHoldings(fundData, mainPage);
          
          // Add enhanced fund to array for JSON saving
          enhancedFunds.push(fundWithHoldings);
          
          // Save to MongoDB
          const { fund, holdings } = await mongoService.saveFundWithHoldings(fundWithHoldings);
          
          if (fund) {
            savedFunds++;
            console.log(`✅ Saved fund: ${fund.name}`);
          }
          
          if (holdings.length > 0) {
            savedHoldings += holdings.length;
            console.log(`📊 Saved ${holdings.length} holdings for ${fundData.schemeName}`);
          }
          
          // Add delay between requests to be respectful
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Error processing fund ${fundData.schemeName}:`, error);
        }
      }
      
      // Close the main page
      await mainPage.close();

      // Save enhanced data to files after scraping
      console.log('\n💾 Saving enhanced data to files...');
      DataProcessor.saveToJSON(enhancedFunds);
      DataProcessor.saveToCSV(enhancedFunds);

      console.log(`\n📊 MongoDB Summary:`);
      console.log(`✅ Funds saved: ${savedFunds}`);
      console.log(`📈 Total holdings saved: ${savedHoldings}`);

      // Get and display database statistics
      const stats = await mongoService.getFundStatistics();
      console.log(`\n📈 Database Statistics:`);
      console.log(`Total funds in database: ${stats.totalFunds}`);
      console.log(`Total holdings in database: ${stats.totalHoldings}`);
      console.log(`Average holdings per fund: ${stats.averageHoldingsPerFund.toFixed(1)}`);
      
      if (stats.topSectors.length > 0) {
        console.log(`\n🏭 Top Sectors:`);
        stats.topSectors.slice(0, 5).forEach((sector, index) => {
          console.log(`${index + 1}. ${sector.sector}: ${sector.count} holdings`);
        });
      }

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
