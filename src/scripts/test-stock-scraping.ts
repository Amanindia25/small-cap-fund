import { ScreenerScraperService } from '../services/screener-scraper.service';
import { connectDB } from '../config/database';

async function testStockScraping() {
  try {
    console.log('🚀 Starting stock scraping test...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');
    
    // Initialize scraper with browser visible
    const scraper = new ScreenerScraperService({ headless: false });
    
    // Test with a few sample stocks
    const testStocks = [
      {
        stockName: "J K Lakshmi Cement Ltd.",
        stockSymbol: "J K Lakshm",
        sector: "Cement & cement products"
      },
      {
        stockName: "Sai Life Sciences Ltd.",
        stockSymbol: "Sai Life S",
        sector: "Petrochemicals"
      }
    ];
    
    console.log(`📊 Testing with ${testStocks.length} stocks...`);
    
    // Scrape stock details
    const result = await scraper.scrapeStockDetails(testStocks);
    
    if (result.success) {
      console.log('✅ Stock scraping test completed successfully!');
      console.log(`📈 Scraped ${result.totalStocks} stocks`);
      console.log('📋 Results:', JSON.stringify(result.data, null, 2));
    } else {
      console.log('❌ Stock scraping test failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testStockScraping();
