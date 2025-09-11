import express from 'express';
import cors from 'cors';
import { MongoDBService } from '../services/mongodb.service';
import { PortfolioChangeService } from '../services/portfolio-change.service';
import { DailySchedulerService } from '../services/daily-scheduler.service';
import { DailyScraperService } from '../services/daily-scraper.service';
import { connectDB } from '../config/database';

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const mongoService = new MongoDBService();
const portfolioChangeService = new PortfolioChangeService();
const dailyScheduler = new DailySchedulerService();
const dailyScraper = new DailyScraperService();

// Routes
app.get('/api/funds', async (req, res) => {
  try {
    const funds = await mongoService.getAllFunds();
    res.json({
      success: true,
      data: funds,
      count: funds.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch funds'
    });
  }
});

app.get('/api/funds/:id/holdings', async (req, res) => {
  try {
    const { id } = req.params;
    const holdings = await mongoService.getFundHoldings(id);
    res.json({
      success: true,
      data: holdings,
      count: holdings.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch holdings'
    });
  }
});

app.get('/api/funds/compare/:fund1/:fund2', async (req, res) => {
  try {
    const { fund1, fund2 } = req.params;
    
    const [holdings1, holdings2] = await Promise.all([
      mongoService.getFundHoldings(fund1),
      mongoService.getFundHoldings(fund2)
    ]);

    // Compare holdings
    const comparison = {
      fund1: {
        id: fund1,
        holdings: holdings1,
        totalHoldings: holdings1.length
      },
      fund2: {
        id: fund2,
        holdings: holdings2,
        totalHoldings: holdings2.length
      },
      commonHoldings: [] as any[],
      uniqueToFund1: [] as any[],
      uniqueToFund2: [] as any[]
    };

    // Find common holdings
    const fund1Stocks = new Set(holdings1.map(h => h.stockName.toLowerCase()));
    const fund2Stocks = new Set(holdings2.map(h => h.stockName.toLowerCase()));

    comparison.commonHoldings = holdings1.filter(h => 
      fund2Stocks.has(h.stockName.toLowerCase())
    );

    comparison.uniqueToFund1 = holdings1.filter(h => 
      !fund2Stocks.has(h.stockName.toLowerCase())
    );

    comparison.uniqueToFund2 = holdings2.filter(h => 
      !fund1Stocks.has(h.stockName.toLowerCase())
    );

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to compare funds'
    });
  }
});

app.get('/api/sectors/top', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const stats = await mongoService.getFundStatistics();
    res.json({
      success: true,
      data: stats.topSectors.slice(0, Number(limit))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sector data'
    });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await mongoService.getFundStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

// Portfolio change tracking endpoints
app.get('/api/funds/:id/changes', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;
    const changes = await portfolioChangeService.getPortfolioChangeHistory(id, Number(days));
    res.json({
      success: true,
      data: changes,
      count: changes.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch portfolio changes'
    });
  }
});

app.get('/api/changes/significant', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const changes = await portfolioChangeService.getSignificantChanges(Number(days));
    res.json({
      success: true,
      data: changes,
      count: changes.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch significant changes'
    });
  }
});

app.post('/api/portfolio/snapshot/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await portfolioChangeService.createDailySnapshot(id);
    if (snapshot) {
      res.json({
        success: true,
        data: snapshot,
        message: 'Daily snapshot created successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Fund not found or no holdings available'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create daily snapshot'
    });
  }
});

app.post('/api/portfolio/detect-changes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const changes = await portfolioChangeService.detectPortfolioChanges(id);
    res.json({
      success: true,
      data: changes,
      count: changes.length,
      message: `Detected ${changes.length} portfolio changes`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to detect portfolio changes'
    });
  }
});

// Manual trigger endpoints for testing
app.post('/api/admin/trigger-analysis', async (req, res) => {
  try {
    await dailyScheduler.triggerPortfolioAnalysis();
    res.json({
      success: true,
      message: 'Portfolio analysis triggered successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger portfolio analysis'
    });
  }
});

app.post('/api/admin/trigger-changes', async (req, res) => {
  try {
    await dailyScheduler.triggerChangeDetection();
    res.json({
      success: true,
      message: 'Change detection triggered successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger change detection'
    });
  }
});

app.post('/api/admin/trigger-scraping', async (req, res) => {
  try {
    await dailyScheduler.triggerDailyScraping();
    res.json({
      success: true,
      message: 'Daily scraping triggered successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger daily scraping'
    });
  }
});

app.post('/api/admin/trigger-incremental', async (req, res) => {
  try {
    await dailyScheduler.triggerIncrementalUpdate();
    res.json({
      success: true,
      message: 'Incremental update triggered successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger incremental update'
    });
  }
});

app.get('/api/admin/scraping-status', async (req, res) => {
  try {
    const status = await dailyScraper.getScrapingStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get scraping status'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
async function startServer() {
  try {
    await connectDB();
    console.log('🗄️ Connected to MongoDB');
    
    // Start daily scheduler
    dailyScheduler.startDailyTasks();
    
    app.listen(PORT, () => {
      console.log(`🚀 API Server running on http://localhost:${PORT}`);
      console.log(`📊 Available endpoints:`);
      console.log(`   GET /api/funds - List all funds`);
      console.log(`   GET /api/funds/:id/holdings - Get fund holdings`);
      console.log(`   GET /api/funds/compare/:fund1/:fund2 - Compare two funds`);
      console.log(`   GET /api/sectors/top - Top sectors`);
      console.log(`   GET /api/stats - Database statistics`);
      console.log(`   GET /api/funds/:id/changes - Get portfolio changes`);
      console.log(`   GET /api/changes/significant - Get significant changes`);
      console.log(`   POST /api/portfolio/snapshot/:id - Create daily snapshot`);
      console.log(`   POST /api/portfolio/detect-changes/:id - Detect changes`);
      console.log(`   POST /api/admin/trigger-analysis - Trigger analysis`);
      console.log(`   POST /api/admin/trigger-changes - Trigger change detection`);
      console.log(`   POST /api/admin/trigger-scraping - Trigger daily scraping`);
      console.log(`   POST /api/admin/trigger-incremental - Trigger incremental update`);
      console.log(`   GET /api/admin/scraping-status - Get scraping status`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
