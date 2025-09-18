import { ScreenerScraperService } from '../services/screener-scraper.service';
import { connectDB } from '../config/database';

async function runStockScraping() {
  try {
    console.log('🚀 Starting stock scraping for all fund holdings...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');
    
    // Initialize scraper
    const scraper = new ScreenerScraperService();
    
    // Get unique stocks directly from DB holdings
    console.log('📊 Getting unique stocks from DB holdings...');
    const uniqueStocks = await scraper.getUniqueStocksFromDB();
    
    if (uniqueStocks.length === 0) {
      console.log('❌ No stocks found to scrape');
      return;
    }
    
    console.log(`📈 Found ${uniqueStocks.length} unique stocks to scrape`);
    
    // Scrape stock details
    const result = await scraper.scrapeStockDetails(uniqueStocks);
    
    if (result.success) {
      console.log('✅ Stock scraping completed successfully!');
      console.log(`📈 Scraped ${result.totalStocks} stocks`);
      
      // Show summary
      console.log('\n📋 Summary:');
      result.data.forEach((stock, index) => {
        console.log(`${index + 1}. ${stock.stockName} (${stock.stockSymbol})`);
        console.log(`   Sector: ${stock.sector}`);
        console.log(`   Price: ${stock.currentPrice ? `₹${stock.currentPrice}` : 'N/A'}`);
        console.log(`   PE: ${stock.pe || 'N/A'}`);
        console.log(`   Market Cap: ${stock.marketCap ? `₹${stock.marketCap}` : 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('❌ Stock scraping failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Stock scraping error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the scraping
runStockScraping();
