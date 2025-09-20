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

  // Get fund holdings with date filter
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

  // Get top sectors
  app.get('/api/sectors/top', async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      const pipeline = [
        { $group: { _id: '$sector', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: Number(limit) },
        { $project: { sector: '$_id', count: 1, _id: 0 } }
      ];
      
      const topSectors = await Holding.aggregate(pipeline);
      res.json({
        success: true,
        data: topSectors
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sector data'
      });
    }
  });

  // Get database statistics
  app.get('/api/stats', async (req, res) => {
    try {
      const totalFunds = await Fund.countDocuments();
      const totalHoldings = await Holding.countDocuments();
      const averageHoldingsPerFund = totalFunds > 0 ? totalHoldings / totalFunds : 0;
      
      const pipeline = [
        { $group: { _id: '$sector', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { sector: '$_id', count: 1, _id: 0 } }
      ];
      
      const topSectors = await Holding.aggregate(pipeline);
      
      res.json({
        success: true,
        data: {
          totalFunds,
          totalHoldings,
          averageHoldingsPerFund,
          topSectors
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics'
      });
    }
  });

  // Get fund history
  app.get('/api/funds/:id/history', async (req, res) => {
    try {
      const { id } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      
      const { FundSnapshot } = require('./models/FundSnapshot');
      const history = await FundSnapshot.find({ fundId: id })
        .sort({ date: -1 })
        .limit(days);
      
      res.json({
        success: true,
        data: history,
        count: history.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get fund history'
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

  // Get significant changes
  app.get('/api/portfolio/significant-changes', async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const { PortfolioChange } = require('./models/PortfolioChange');
      
      const changes = await PortfolioChange.find({
        date: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
        changeType: { $in: ['added', 'removed', 'increased', 'decreased'] }
      })
      .sort({ date: -1 })
      .limit(100);
      
      res.json({
        success: true,
        data: changes,
        count: changes.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get significant changes'
      });
    }
  });

  // Get stocks
  app.get('/api/stocks', async (req, res) => {
    try {
      const { limit = 50, page = 1 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      
      const { Stock } = require('./models/Stock');
      const stocks = await Stock.find()
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit));
      
      const total = await Stock.countDocuments();
      
      res.json({
        success: true,
        data: stocks,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stocks'
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
