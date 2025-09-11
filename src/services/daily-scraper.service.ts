import { FundScraperService } from './fund-scraper.service';
import { MongoDBService } from './mongodb.service';
import { PortfolioChangeService } from './portfolio-change.service';
import { Fund, IFund } from '../models/Fund';
import { FundData, ScrapingConfig } from '../types/fund.types';
import { BrowserManager } from '../utils/browser.util';

export class DailyScraperService {
  private fundScraper: FundScraperService;
  private mongoService: MongoDBService;
  private portfolioChangeService: PortfolioChangeService;

  constructor() {
    const config: ScrapingConfig = {
      url: 'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html',
      headless: true,
      timeout: 30000,
      delay: 1000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    const browserManager = new BrowserManager(config);
    this.fundScraper = new FundScraperService(browserManager);
    this.mongoService = new MongoDBService();
    this.portfolioChangeService = new PortfolioChangeService();
  }

  async runDailyScraping(): Promise<{
    success: boolean;
    totalFunds: number;
    updatedFunds: number;
    newFunds: number;
    errors: string[];
  }> {
    console.log('🔄 Starting daily scraping process...');
    const startTime = Date.now();
    const errors: string[] = [];
    let updatedFunds = 0;
    let newFunds = 0;

    try {
      // Step 1: Scrape fresh data from Moneycontrol
      console.log('📊 Scraping fresh data from Moneycontrol...');
      const scrapingResult = await this.fundScraper.scrapeSmallCapFunds();
      
      if (!scrapingResult.success) {
        throw new Error(`Scraping failed: ${scrapingResult.error}`);
      }

      console.log(`✅ Scraped ${scrapingResult.data.length} funds from website`);

      // Step 2: Process and save each fund
      for (const fundData of scrapingResult.data) {
        try {
          const result = await this.processFundData(fundData);
          if (result.isNew) {
            newFunds++;
          } else {
            updatedFunds++;
          }
          console.log(`✅ Processed: ${fundData.schemeName}`);
        } catch (error) {
          const errorMsg = `Error processing ${fundData.schemeName}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Step 3: Create daily snapshots for all funds
      console.log('📸 Creating daily snapshots...');
      await this.createDailySnapshots();

      // Step 4: Detect portfolio changes
      console.log('🔍 Detecting portfolio changes...');
      await this.detectAllPortfolioChanges();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Daily scraping completed in ${duration}s`);

      return {
        success: true,
        totalFunds: scrapingResult.data.length,
        updatedFunds,
        newFunds,
        errors
      };

    } catch (error) {
      const errorMsg = `Daily scraping failed: ${error}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
      
      return {
        success: false,
        totalFunds: 0,
        updatedFunds,
        newFunds,
        errors
      };
    }
  }

  private async processFundData(fundData: FundData): Promise<{ isNew: boolean }> {
    try {
      // Check if fund already exists
      const existingFund = await Fund.findOne({ name: fundData.schemeName });
      
      if (existingFund) {
        // Update existing fund
        await this.mongoService.saveFundWithHoldings(fundData);
        return { isNew: false };
      } else {
        // Create new fund
        await this.mongoService.saveFundWithHoldings(fundData);
        return { isNew: true };
      }
    } catch (error) {
      throw new Error(`Failed to process fund data: ${error}`);
    }
  }

  private async createDailySnapshots(): Promise<void> {
    try {
      const funds = await Fund.find({}) as IFund[];
      console.log(`📸 Creating snapshots for ${funds.length} funds...`);

      let successCount = 0;
      let errorCount = 0;

      for (const fund of funds) {
        try {
          const snapshot = await this.portfolioChangeService.createDailySnapshot((fund._id as any).toString());
          if (snapshot) {
            successCount++;
          }
        } catch (error) {
          console.error(`❌ Error creating snapshot for ${fund.name}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Created ${successCount} snapshots, ${errorCount} errors`);
    } catch (error) {
      console.error('❌ Error in createDailySnapshots:', error);
    }
  }

  private async detectAllPortfolioChanges(): Promise<void> {
    try {
      const funds = await Fund.find({}) as IFund[];
      console.log(`🔍 Detecting changes for ${funds.length} funds...`);

      let totalChanges = 0;
      let fundsWithChanges = 0;

      for (const fund of funds) {
        try {
          const changes = await this.portfolioChangeService.detectPortfolioChanges((fund._id as any).toString());
          if (changes.length > 0) {
            totalChanges += changes.length;
            fundsWithChanges++;
            console.log(`📊 ${fund.name}: ${changes.length} changes`);
          }
        } catch (error) {
          console.error(`❌ Error detecting changes for ${fund.name}:`, error);
        }
      }

      console.log(`✅ Detected ${totalChanges} total changes across ${fundsWithChanges} funds`);
    } catch (error) {
      console.error('❌ Error in detectAllPortfolioChanges:', error);
    }
  }

  async runIncrementalUpdate(): Promise<{
    success: boolean;
    updatedFunds: number;
    errors: string[];
  }> {
    console.log('🔄 Starting incremental update...');
    const errors: string[] = [];
    let updatedFunds = 0;

    try {
      // For now, incremental update just creates snapshots and detects changes
      // Individual fund scraping by URL is not implemented yet
      console.log('📊 Running portfolio analysis for existing funds...');

      // Create snapshots and detect changes
      await this.createDailySnapshots();
      await this.detectAllPortfolioChanges();

      console.log(`✅ Incremental update completed. Analyzed existing funds`);

      return {
        success: true,
        updatedFunds,
        errors
      };

    } catch (error) {
      const errorMsg = `Incremental update failed: ${error}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
      
      return {
        success: false,
        updatedFunds,
        errors
      };
    }
  }

  async getScrapingStatus(): Promise<{
    lastScrapingDate: Date | null;
    totalFunds: number;
    totalHoldings: number;
    lastSnapshotDate: Date | null;
  }> {
    try {
      const [latestFund, totalFunds, totalHoldings, latestSnapshot] = await Promise.all([
        Fund.findOne({}).sort({ updatedAt: -1 }),
        Fund.countDocuments(),
        Fund.aggregate([
          { $unwind: '$individualHoldings' },
          { $count: 'total' }
        ]),
        Fund.findOne({}).sort({ updatedAt: -1 })
      ]);

      return {
        lastScrapingDate: latestFund?.updatedAt || null,
        totalFunds,
        totalHoldings: totalHoldings[0]?.total || 0,
        lastSnapshotDate: latestSnapshot?.updatedAt || null
      };
    } catch (error) {
      console.error('Error getting scraping status:', error);
      return {
        lastScrapingDate: null,
        totalFunds: 0,
        totalHoldings: 0,
        lastSnapshotDate: null
      };
    }
  }
}
