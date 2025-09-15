import cron from 'node-cron';
import { Fund, IFund } from '../models/Fund';
import { PortfolioChangeService } from './portfolio-change.service';
import { MongoDBService } from './mongodb.service';
import { DailyScraperService } from './daily-scraper.service';
import { HistoricalDataService } from './historical-data.service';

export class TestSchedulerService {
  private portfolioChangeService: PortfolioChangeService;
  private mongoService: MongoDBService;
  private dailyScraper: DailyScraperService;
  private historicalDataService: HistoricalDataService;

  constructor() {
    this.portfolioChangeService = new PortfolioChangeService();
    this.mongoService = new MongoDBService();
    this.dailyScraper = new DailyScraperService();
    this.historicalDataService = new HistoricalDataService();
  }

  // For testing - run every hour
  startHourlyTestTasks() {
    console.log('🧪 Starting HOURLY test scheduler tasks...');

    // Run portfolio analysis every hour for testing
    cron.schedule('0 * * * *', async () => {
      console.log('🔄 [TEST] Starting hourly portfolio analysis...');
      await this.runPortfolioAnalysis();
    });

    // Run change detection every 30 minutes for testing
    cron.schedule('*/30 * * * *', async () => {
      console.log('🔍 [TEST] Starting hourly change detection...');
      await this.runChangeDetection();
    });

    console.log('✅ Hourly test scheduler tasks configured');
  }

  // For production - run daily
  startDailyTasks() {
    console.log('🕐 Starting DAILY scheduler tasks...');

    // Run full scraping every day at 10 AM
    cron.schedule('0 10 * * *', async () => {
      console.log('🔄 Starting daily scraping...');
      await this.runDailyScraping();
    });

    // Run incremental update every day at 10:30 AM
    cron.schedule('30 10 * * *', async () => {
      console.log('🔄 Starting incremental update...');
      await this.runIncrementalUpdate();
    });

    // Run portfolio analysis every day at 11 AM
    cron.schedule('0 11 * * *', async () => {
      console.log('📊 Starting daily portfolio analysis...');
      await this.runPortfolioAnalysis();
    });

    console.log('✅ Daily scheduler tasks configured');
  }

  private async runPortfolioAnalysis() {
    try {
      console.log('📈 Running portfolio analysis...');
      
      // Create daily snapshots for all funds
      await this.historicalDataService.createDailySnapshots();
      
      // Detect portfolio changes
      const funds = await Fund.find({}) as IFund[];
      let totalChanges = 0;
      
      for (const fund of funds) {
        try {
          const changes = await this.historicalDataService.detectPortfolioChanges((fund._id as any).toString());
          totalChanges += changes.length;
          if (changes.length > 0) {
            console.log(`📊 ${fund.name}: ${changes.length} changes detected`);
          }
        } catch (error) {
          console.error(`❌ Error analyzing ${fund.name}:`, error);
        }
      }

      console.log(`✅ Portfolio analysis completed - ${totalChanges} total changes detected`);
    } catch (error) {
      console.error('❌ Error in portfolio analysis:', error);
    }
  }

  private async runChangeDetection() {
    try {
      const funds = await Fund.find({}) as IFund[];
      console.log(`🔍 Detecting changes for ${funds.length} funds...`);

      let totalChanges = 0;
      for (const fund of funds) {
        try {
          const changes = await this.portfolioChangeService.detectPortfolioChanges((fund._id as any).toString());
          totalChanges += changes.length;
          if (changes.length > 0) {
            console.log(`📊 Found ${changes.length} changes in ${fund.name}`);
          }
        } catch (error) {
          console.error(`❌ Error detecting changes for ${fund.name}:`, error);
        }
      }

      console.log(`✅ Change detection completed. Total changes: ${totalChanges}`);
    } catch (error) {
      console.error('❌ Error in change detection:', error);
    }
  }

  private async runDailyScraping() {
    try {
      const result = await this.dailyScraper.runDailyScraping();
      if (result.success) {
        console.log(`✅ Daily scraping completed: ${result.totalFunds} funds, ${result.updatedFunds} updated, ${result.newFunds} new`);
      } else {
        console.error('❌ Daily scraping failed:', result.errors);
      }
    } catch (error) {
      console.error('❌ Error in daily scraping:', error);
    }
  }

  private async runIncrementalUpdate() {
    try {
      const result = await this.dailyScraper.runIncrementalUpdate();
      if (result.success) {
        console.log(`✅ Incremental update completed: ${result.updatedFunds} funds updated`);
      } else {
        console.error('❌ Incremental update failed:', result.errors);
      }
    } catch (error) {
      console.error('❌ Error in incremental update:', error);
    }
  }

  // Manual trigger methods for testing
  async triggerPortfolioAnalysis() {
    console.log('🔄 Manually triggering portfolio analysis...');
    await this.runPortfolioAnalysis();
  }

  async triggerChangeDetection() {
    console.log('🔄 Manually triggering change detection...');
    await this.runChangeDetection();
  }

  async triggerDailyScraping() {
    console.log('🔄 Manually triggering daily scraping...');
    await this.runDailyScraping();
  }

  async triggerIncrementalUpdate() {
    console.log('🔄 Manually triggering incremental update...');
    await this.runIncrementalUpdate();
  }
}
