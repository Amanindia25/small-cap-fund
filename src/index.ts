import { BrowserManager } from './utils/browser.util';
import { FundScraperService } from './services/fund-scraper.service';
import { MongoDBService } from './services/mongodb.service';
import { DataProcessor } from './utils/data-processor.util';
import { ScrapingConfig, FundData } from './types/fund.types';
import { connectDB } from './config/database';
import express from 'express';
import cors from 'cors';
// import { logger } from './utils/logger.util';
// import { handleAsync, AppError } from './utils/error-handler.util';

// Start API Server
function startAPIServer() {
  const app = express();
  const PORT = process.env.PORT || 5000;

  // CORS configuration
  const corsOptions = {
    origin: [
      'http://localhost:3000',
      'https://small-cap-fund-frontend.vercel.app',
      'https://small-cap-fund-frontend.vercel.app/'
    ],
    credentials: true,
    optionsSuccessStatus: 200
  };
  
  app.use(cors(corsOptions));
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Small Cap Fund API is running' });
  });

  // Import models for API endpoints
  const { Fund } = require('./models/Fund');
  const { FundSnapshot } = require('./models/FundSnapshot');
  const { Holding } = require('./models/Holding');

  // Get all funds
  app.get('/api/funds', async (req, res) => {
    try {
      const funds = await Fund.find().sort({ createdAt: -1 });
      res.json({
        success: true,
        count: funds.length,
        data: funds
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching funds',
        error: error.message
      });
    }
  });

  // Get specific fund by ID
  app.get('/api/funds/:id', async (req, res) => {
    try {
      const fund = await Fund.findById(req.params.id);
      if (!fund) {
        return res.status(404).json({
          success: false,
          message: 'Fund not found'
        });
      }
      res.json({
        success: true,
        data: fund
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching fund',
        error: error.message
      });
    }
  });

  // Get fund snapshots
  app.get('/api/funds/:id/snapshots', async (req, res) => {
    try {
      const snapshots = await FundSnapshot.find({ fundId: req.params.id })
        .sort({ date: -1 })
        .limit(30);
      res.json({
        success: true,
        count: snapshots.length,
        data: snapshots
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching fund snapshots',
        error: error.message
      });
    }
  });

  // Get fund holdings
  app.get('/api/funds/:id/holdings', async (req, res) => {
    try {
      const holdings = await Holding.find({ fundId: req.params.id })
        .sort({ percentage: -1 });
      res.json({
        success: true,
        count: holdings.length,
        data: holdings
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching fund holdings',
        error: error.message
      });
    }
  });

  // Get latest fund data
  app.get('/api/funds/latest', async (req, res) => {
    try {
      const latestFunds = await Fund.find()
        .sort({ updatedAt: -1 })
        .limit(20);
      res.json({
        success: true,
        count: latestFunds.length,
        data: latestFunds
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching latest funds',
        error: error.message
      });
    }
  });

  app.listen(PORT, () => {
    console.log(`🌐 API Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  });
}

async function main() {
  console.log('🚀 Starting Small Cap Fund Scraper...\n');

  // Start API Server first
  startAPIServer();

  // Configuration
  const config: ScrapingConfig = {
    url: 'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html',
    headless: process.env.NODE_ENV === 'production' ? true : false, // Headless in production
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
