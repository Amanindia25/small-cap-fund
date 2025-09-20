import { FundScraperService } from './fund-scraper.service';
import { MongoDBService } from './mongodb.service';
import { PortfolioChangeService } from './portfolio-change.service';
import { HistoricalDataService } from './historical-data.service';
import { ScrapingStatusService } from './scraping-status.service';
import { Fund, IFund } from '../models/Fund';
import { FundData, ScrapingConfig } from '../types/fund.types';
import { BrowserManager } from '../utils/browser.util';

export class DailyScraperService {
  private fundScraper: FundScraperService;
  private mongoService: MongoDBService;
  private portfolioChangeService: PortfolioChangeService;
  private historicalDataService: HistoricalDataService;
  private statusService: ScrapingStatusService;

  constructor() {
    // fundScraper will be (re)created per run to allow toggling headless at runtime
    const defaultConfig: ScrapingConfig = {
      url: 'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html',
      headless: true,
      timeout: 30000,
      delay: 1000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    const browserManager = new BrowserManager(defaultConfig);
    this.fundScraper = new FundScraperService(browserManager);
    this.mongoService = new MongoDBService();
    this.portfolioChangeService = new PortfolioChangeService();
    this.historicalDataService = new HistoricalDataService();
    this.statusService = ScrapingStatusService.getInstance();
  }

  async runDailyScraping(options?: { showBrowser?: boolean }): Promise<{
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
      // Rebuild scraper with runtime headless flag (env or explicit option)
      const showBrowser = options?.showBrowser ?? (process.env.SHOW_BROWSER === 'true');
      const config: ScrapingConfig = {
        url: 'https://www.moneycontrol.com/mutual-funds/performance-tracker/portfolioassets/small-cap-fund.html',
        headless: showBrowser ? false : true,
        timeout: 30000,
        delay: 1000,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      };
      // Use a single BrowserManager instance for the whole run
      const browserManager = new BrowserManager(config);
      this.fundScraper = new FundScraperService(browserManager);
      // Step 1: Scrape fresh data from Moneycontrol
      console.log('📊 Scraping fresh data from Moneycontrol...');
      this.statusService.updateProgress('Scraping data from Moneycontrol...', 0);
      
      const scrapingResult = await this.fundScraper.scrapeSmallCapFunds();
      
      if (!scrapingResult.success) {
        throw new Error(`Scraping failed: ${scrapingResult.error}`);
      }

      console.log(`✅ Scraped ${scrapingResult.data.length} funds from website`);
      this.statusService.startScraping(scrapingResult.data.length);

      // Step 2: Enhance each fund with holdings (single browser, single main page)
      this.statusService.updateProgress('Enhancing funds with holdings...', 0);
      let processedCount = 0;

      const mainPage = await browserManager.createPage();
      await browserManager.navigateToPage(mainPage, config.url);
      await browserManager.delay(2000);

      for (const fundData of scrapingResult.data) {
        try {
          const enhanced = await this.fundScraper.scrapeFundWithHoldings(fundData, mainPage);
          const result = await this.processFundData(enhanced);
          if (result.isNew) {
            newFunds++;
          } else {
            updatedFunds++;
          }
          processedCount++;
          this.statusService.updateProgress(`Processing: ${fundData.schemeName}`, processedCount);
          console.log(`✅ Processed with holdings: ${fundData.schemeName}`);
        } catch (error) {
          const errorMsg = `Error processing ${fundData.schemeName}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
          this.statusService.addError(errorMsg);
        }
      }

      try { await mainPage.close(); } catch {}

      // Step 3: Create daily snapshots for all funds
      console.log('📸 Creating daily snapshots...');
      this.statusService.updateProgress('Creating daily snapshots...', processedCount);
      await this.historicalDataService.createDailySnapshots();

      // Step 4: Detect portfolio changes
      console.log('🔍 Detecting portfolio changes...');
      this.statusService.updateProgress('Detecting portfolio changes...', processedCount);
      await this.detectAllPortfolioChanges();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Daily scraping completed in ${duration}s`);

      const result = {
        success: true,
        totalFunds: scrapingResult.data.length,
        updatedFunds,
        newFunds,
        errors
      };

      this.statusService.completeScraping(result);
      return result;

    } catch (error) {
      const errorMsg = `Daily scraping failed: ${error}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
      this.statusService.addError(errorMsg);
      
      const result = {
        success: false,
        totalFunds: 0,
        updatedFunds,
        newFunds,
        errors
      };

      this.statusService.completeScraping(result);
      return result;
    }
  }

  private async processFundData(fundData: FundData): Promise<{ isNew: boolean }> {
    try {
      // Check if fund already exists with same name AND planType
      const existingFund = await Fund.findOne({ 
        name: fundData.schemeName, 
        planType: fundData.planType 
      });
      
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
          const changes = await this.historicalDataService.detectPortfolioChanges((fund._id as any).toString());
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
      await this.historicalDataService.createDailySnapshots();
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
