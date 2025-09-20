import cron from 'node-cron';
import { ScreenerScraperService } from './screener-scraper.service';
import { logger } from '../utils/logger.util';

export class StockSchedulerService {
  private screenerScraper: ScreenerScraperService;
  private isRunning: boolean = false;

  constructor() {
    this.screenerScraper = new ScreenerScraperService();
  }

  // Schedule daily stock scraping at 6:00 AM
  public startDailyStockScraping(): void {
    console.log('🕕 Starting daily stock scraping scheduler...');
    
    // Run at 6:00 AM every day
    cron.schedule('0 6 * * *', async () => {
      await this.runDailyStockScraping();
    });

    console.log('✅ Daily stock scraping scheduled for 6:00 AM IST');
  }

  // Run stock scraping manually
  public async runDailyStockScraping(): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ Stock scraping already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    
    try {
      console.log('🚀 Starting daily stock scraping...');
      logger.info('Stock scraping started', 'StockScheduler');

      // Get unique stocks from fund holdings
      const uniqueStocks = await this.screenerScraper.getUniqueStocksFromDB();
      
      if (uniqueStocks.length === 0) {
        console.log('❌ No stocks found to scrape');
        logger.warn('No stocks found to scrape', 'StockScheduler');
        return;
      }

      console.log(`📊 Found ${uniqueStocks.length} unique stocks to scrape`);

      // Scrape stock details
      const result = await this.screenerScraper.scrapeStockDetails(uniqueStocks);
      
      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;

      if (result.success) {
        console.log(`✅ Stock scraping completed successfully!`);
        console.log(`📈 Scraped ${result.totalStocks} stocks in ${duration}s`);
        logger.info(`Stock scraping completed: ${result.totalStocks} stocks scraped in ${duration}s`, 'StockScheduler');
      } else {
        console.log(`❌ Stock scraping failed: ${result.error}`);
        logger.error(`Stock scraping failed: ${result.error}`, 'StockScheduler');
      }

    } catch (error) {
      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;
      
      console.error('❌ Stock scraping error:', error);
      logger.error(`Stock scraping error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'StockScheduler');
    } finally {
      this.isRunning = false;
    }
  }

  // Run stock scraping for specific stocks
  public async runStockScrapingForStocks(stocks: Array<{stockName: string, stockSymbol: string, sector: string}>): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ Stock scraping already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    
    try {
      console.log(`🚀 Starting stock scraping for ${stocks.length} specific stocks...`);
      logger.info(`Stock scraping started for ${stocks.length} stocks`, 'StockScheduler');

      // Scrape stock details
      const result = await this.screenerScraper.scrapeStockDetails(stocks);
      
      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;

      if (result.success) {
        console.log(`✅ Stock scraping completed successfully!`);
        console.log(`📈 Scraped ${result.totalStocks} stocks in ${duration}s`);
        logger.info(`Stock scraping completed: ${result.totalStocks} stocks scraped in ${duration}s`, 'StockScheduler');
      } else {
        console.log(`❌ Stock scraping failed: ${result.error}`);
        logger.error(`Stock scraping failed: ${result.error}`, 'StockScheduler');
      }

    } catch (error) {
      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;
      
      console.error('❌ Stock scraping error:', error);
      logger.error(`Stock scraping error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'StockScheduler');
    } finally {
      this.isRunning = false;
    }
  }

  // Get scraping status
  public getScrapingStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }

  // Stop all scheduled tasks
  public stopScheduler(): void {
    console.log('🛑 Stopping stock scraping scheduler...');
    cron.getTasks().forEach(task => task.destroy());
    console.log('✅ Stock scraping scheduler stopped');
  }
}
