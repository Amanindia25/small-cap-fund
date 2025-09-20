import express from 'express';
import cors from 'cors';
import { MongoDBService } from '../services/mongodb.service';
import { PortfolioChangeService } from '../services/portfolio-change.service';
import { DailySchedulerService } from '../services/daily-scheduler.service';
import { TestSchedulerService } from '../services/test-scheduler.service';
import { DailyScraperService } from '../services/daily-scraper.service';
import { HistoricalDataService } from '../services/historical-data.service';
import { ScrapingStatusService } from '../services/scraping-status.service';
import { connectDB } from '../config/database';
import { IHolding } from '../models/Holding';

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const mongoService = new MongoDBService();
const portfolioChangeService = new PortfolioChangeService();
const dailyScheduler = new DailySchedulerService();
const testScheduler = new TestSchedulerService();
const dailyScraper = new DailyScraperService();
const historicalDataService = new HistoricalDataService();
const scrapingStatusService = ScrapingStatusService.getInstance();

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
    const { date } = req.query as { date?: string };

    if (date) {
      // Fetch holdings from HoldingSnapshot for the specific date
      const [y, m, d] = (date as string).split('-').map(Number);
      const start = new Date(Date.UTC(y, (m - 1), d));
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
      const holdings = await historicalDataService.getHoldingsForDate(id, start, end);
      res.json({
        success: true,
        data: holdings,
        count: holdings.length,
        meta: { date, snapshot: holdings.length > 0 }
      });
      return;
    }

    // Default: latest/current holdings
    const holdings = await mongoService.getFundHoldings(id);
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

// Compare endpoint removed

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

// Daily changes endpoint - compare today vs yesterday
app.get('/api/funds/:id/daily-changes', async (req, res) => {
  try {
    const { id } = req.params;
    const changes = await portfolioChangeService.getDailyChanges(id);
    res.json({
      success: true,
      data: changes,
      count: changes.length
    });
  } catch (error) {
    console.error('Error fetching daily changes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch daily changes'
    });
  }
});

// Compare two dates (or latest two snapshots if no dates provided)
app.get('/api/funds/:id/compare-snapshots', async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const changes = await portfolioChangeService.compareSnapshots(id, fromDate, toDate);
    res.json({
      success: true,
      data: changes,
      count: changes.length
    });
  } catch (error) {
    console.error('Error comparing snapshots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare snapshots'
    });
  }
});

// Persist compare results for a given day (or latest two) into portfoliochanges
app.post('/api/funds/:id/compare-snapshots/save', async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const saved = await portfolioChangeService.compareAndSave(id, fromDate, toDate);
    res.json({ success: true, data: saved, count: saved.length });
  } catch (error) {
    console.error('Error persisting compare results:', error);
    res.status(500).json({ success: false, error: 'Failed to save compare results' });
  }
});

app.get('/api/changes/significant', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    console.log(`🔍 Fetching significant changes for last ${days} days`);
    const changes = await portfolioChangeService.getSignificantChanges(Number(days));
    console.log(`📊 Found ${changes.length} significant changes`);
    res.json({
      success: true,
      data: changes,
      count: changes.length
    });
  } catch (error) {
    console.error('❌ Error fetching significant changes:', error);
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
    const isTestMode = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true';
    const scheduler = isTestMode ? testScheduler : dailyScheduler;
    
    await scheduler.triggerPortfolioAnalysis();
    res.json({
      success: true,
      message: `Portfolio analysis triggered successfully (${isTestMode ? 'TEST' : 'PRODUCTION'} mode)`
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
    const isTestMode = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true';
    const scheduler = isTestMode ? testScheduler : dailyScheduler;
    
    await scheduler.triggerChangeDetection();
    res.json({
      success: true,
      message: `Change detection triggered successfully (${isTestMode ? 'TEST' : 'PRODUCTION'} mode)`
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
    // If SHOW_BROWSER=true, run scraper with visible browser for this manual trigger
    const showBrowser = req.query.showBrowser === 'true' || process.env.SHOW_BROWSER === 'true';
    await dailyScheduler.runDailyScraping({ showBrowser });
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

// Admin: backfill holdings enriched fields from fund.individualHoldings
app.post('/api/admin/backfill-holdings', async (req, res) => {
  try {
    const { fundId } = req.query as { fundId?: string };
    if (fundId) {
      const updated = await mongoService.rewriteHoldingsFromFund(fundId);
      res.json({ success: true, message: `Backfilled ${updated.length} holdings for fund`, count: updated.length });
      return;
    }
    const result = await mongoService.rewriteAllHoldings();
    res.json({ success: true, message: `Backfilled holdings for ${result.updated} funds`, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to backfill holdings' });
  }
});

// Admin: remove duplicate funds
app.post('/api/admin/cleanup-duplicates', async (req, res) => {
  try {
    const result = await mongoService.removeDuplicateFunds();
    res.json({ success: true, message: `Removed ${result.removed} duplicate funds`, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to cleanup duplicates' });
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

// Real-time scraping progress endpoint
app.get('/api/admin/scraping-progress', async (req, res) => {
  try {
    const status = scrapingStatusService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scraping progress'
    });
  }
});

// Historical Data APIs
app.get('/api/funds/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const history = await historicalDataService.getFundHistory(id, days);
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

app.get('/api/funds/:id/holdings-history', async (req, res) => {
  try {
    const { id } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const history = await historicalDataService.getHoldingsHistory(id, days);
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get holdings history'
    });
  }
});

app.get('/api/funds/:id/portfolio-changes', async (req, res) => {
  try {
    const { id } = req.params;
    const range = (req.query.range as string) || '';
    const daysParam = parseInt(req.query.days as string);
    const days = Number.isFinite(daysParam) && daysParam > 0
      ? daysParam
      : range === 'daily' ? 1 : range === 'weekly' ? 7 : range === 'monthly' ? 30 : 30;
    const changes = await historicalDataService.getPortfolioChanges(id, days);
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

// Weekly changes: latest completed week vs previous week (derive from snapshots)
app.get('/api/funds/:id/weekly-changes', async (req, res) => {
  try {
    const { id } = req.params;
    const offsetParam = parseInt((req.query.weekOffset as string) || '0', 10);
    const weekOffset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

    // Helper: end of completed week (Sunday) shifted by offset
    const endOfCompletedWeek = (offset: number): Date => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = today.getDay(); // 0=Sun,6=Sat
      const daysSinceSunday = day; // if today is Sun (0), completed week ended today
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - daysSinceSunday); // this week's Sunday
      // We want the previous Sunday's date if today is Sunday (week just started),
      // so always subtract 7 days to get the last fully completed Sunday
      const completedSunday = new Date(lastSunday);
      completedSunday.setDate(lastSunday.getDate() - 7); // completed week end
      // Apply additional offset in weeks
      completedSunday.setDate(completedSunday.getDate() - offset * 7);
      return completedSunday;
    };

    const toDate = endOfCompletedWeek(weekOffset); // Week N end (Sunday)
    const fromDate = endOfCompletedWeek(weekOffset + 1); // Week N-1 end

    const changes = await portfolioChangeService.compareSnapshots(id, fromDate, toDate);

    const weekKey = (d: Date): string => {
      const tmp = new Date(d);
      // ISO week number
      const dayNum = (tmp.getDay() + 6) % 7; // 0=Mon
      tmp.setDate(tmp.getDate() - dayNum + 3);
      const firstThursday = new Date(tmp.getFullYear(), 0, 4);
      const week = 1 + Math.round(((tmp.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
      const year = tmp.getFullYear();
      return `${year}-W${String(week).padStart(2, '0')}`;
    };

    res.json({
      success: true,
      data: changes,
      count: changes.length,
      meta: {
        mode: 'week_over_week',
        fromDate,
        toDate,
        fromWeek: weekKey(fromDate),
        toWeek: weekKey(toDate),
        weekOffset,
      },
    });
  } catch (error) {
    console.error('Error computing weekly changes:', error);
    res.status(500).json({ success: false, error: 'Failed to compute weekly changes' });
  }
});

app.get('/api/portfolio/significant-changes', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const changes = await historicalDataService.getSignificantChanges(days);
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

app.post('/api/admin/create-snapshots', async (req, res) => {
  try {
    await historicalDataService.createDailySnapshots();
    res.json({
      success: true,
      message: 'Daily snapshots created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create daily snapshots'
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
    
    // Start scheduler based on environment
    const isTestMode = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true';
    
    if (isTestMode) {
      console.log('🧪 Starting in TEST MODE - Hourly tasks enabled');
      testScheduler.startHourlyTestTasks();
    } else {
      console.log('🕐 Starting in PRODUCTION MODE - Daily tasks enabled');
      dailyScheduler.startDailyTasks();
    }
    
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
