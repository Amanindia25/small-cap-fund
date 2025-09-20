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

  // Get fund holdings (used by frontend)
  app.get('/api/funds/:id/holdings', async (req, res) => {
    try {
      const { id } = req.params;
      const { date } = req.query as { date?: string };

      if (date) {
        // Fetch holdings from HoldingSnapshot for the specific date
        const [y, m, d] = (date as string).split('-').map(Number);
        const start = new Date(Date.UTC(y, (m - 1), d));
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(start); 
        end.setUTCDate(end.getUTCDate() + 1);
        
        const { HoldingSnapshot } = require('./models/HoldingSnapshot');
        const holdings = await HoldingSnapshot.find({
          fundId: id,
          date: { $gte: start, $lt: end }
        });
        
        res.json({
          success: true,
          data: holdings,
          count: holdings.length,
          meta: { date, snapshot: holdings.length > 0 }
        });
        return;
      }

      // Default: latest/current holdings
      const holdings = await Holding.find({ fundId: id })
        .sort({ percentage: -1 });
      res.json({
        success: true,
        data: holdings,
        count: holdings.length,
        meta: { latest: true }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch holdings'
      });
    }
  });


  // Get portfolio changes
  app.get('/api/funds/:id/portfolio-changes', async (req, res) => {
    try {
      const { id } = req.params;
      const range = (req.query.range as string) || '';
      const daysParam = parseInt(req.query.days as string);
      const days = Number.isFinite(daysParam) && daysParam > 0
        ? daysParam
        : range === 'daily' ? 1 : range === 'weekly' ? 7 : range === 'monthly' ? 30 : 30;
      
      const { PortfolioChange } = require('./models/PortfolioChange');
      const changes = await PortfolioChange.find({ fundId: id })
        .sort({ date: -1 })
        .limit(days);
      
      res.json({
        success: true,
        data: changes,
        count: changes.length,
        meta: { range: range || `${days}-days`, days }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get portfolio changes'
      });
    }
  });



  // Get specific stock
  app.get('/api/stocks/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { Stock } = require('./models/Stock');
      const stock = await Stock.findOne({ stockSymbol: symbol });
      
      if (!stock) {
        return res.status(404).json({
          success: false,
          error: 'Stock not found'
        });
      }
      
      res.json({
        success: true,
        data: stock
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stock details'
      });
    }
  });

  // Import services for admin endpoints
  const { ScrapingStatusService } = require('./services/scraping-status.service');
  const { DailySchedulerService } = require('./services/daily-scheduler.service');
  const { ScreenerScraperService } = require('./services/screener-scraper.service');

  // Admin API endpoints
  // Get scraping status
  app.get('/api/admin/scraping-status', async (req, res) => {
    try {
      const statusService = ScrapingStatusService.getInstance();
      const status = statusService.getStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching scraping status',
        error: error.message
      });
    }
  });

  // Get scraping progress
  app.get('/api/admin/scraping-progress', async (req, res) => {
    try {
      const statusService = ScrapingStatusService.getInstance();
      const status = statusService.getStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching scraping progress',
        error: error.message
      });
    }
  });

  // Trigger fund scraping
  app.post('/api/admin/trigger-scraping', async (req, res) => {
    try {
      const showBrowser = req.query.showBrowser === 'true';
      const schedulerService = new DailySchedulerService();
      
      // Start scraping in background
      schedulerService.triggerDailyScraping({ showBrowser }).catch(error => {
        console.error('Background scraping error:', error);
      });
      
      res.json({
        success: true,
        message: 'Fund scraping started successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error starting fund scraping',
        error: error.message
      });
    }
  });

  // Trigger portfolio analysis
  app.post('/api/admin/trigger-analysis', async (req, res) => {
    try {
      const schedulerService = new DailySchedulerService();
      
      // Start analysis in background
      schedulerService.triggerPortfolioAnalysis().catch(error => {
        console.error('Background analysis error:', error);
      });
      
      res.json({
        success: true,
        message: 'Portfolio analysis started successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error starting portfolio analysis',
        error: error.message
      });
    }
  });

  // Trigger stock scraping
  app.post('/api/admin/trigger-stock-scraping', async (req, res) => {
    try {
      const { Holding } = require('./models/Holding');
      const screenerService = new ScreenerScraperService();
      
      // Get all unique stocks from holdings
      const holdings = await Holding.find({}).distinct('stockName');
      const stocks = holdings.map(name => ({
        stockName: name,
        stockSymbol: name.split(' ')[0], // Use first word as symbol
        sector: 'Unknown'
      }));
      
      // Start stock scraping in background
      screenerService.scrapeStockDetails(stocks).catch(error => {
        console.error('Background stock scraping error:', error);
      });
      
      res.json({
        success: true,
        message: 'Stock scraping started successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error starting stock scraping',
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

  // If API_ONLY mode is enabled, just run the API server
  if (process.env.API_ONLY === 'true') {
    console.log('🌐 Running in API-only mode. Scraping disabled.');
    return;
  }

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
    console.log('✨ Scraping completed! API server continues running...');
    console.log('🌐 API Server is still running and ready to serve requests');
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the scraper
main().catch(console.error);
