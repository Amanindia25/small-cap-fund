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
    
    // Test with a few sample stocks - using the same symbol generation logic
    const generateStockSymbol = (name: string): string => {
      const cleanName = name
        .replace(/\s+(Limited|Ltd|Ltd\.|Corporation|Corp|Corp\.|Inc|Inc\.|Company|Co|Co\.)$/i, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim();
      
      const words = cleanName.split(/\s+/).slice(0, 3);
      const symbol = words.map(word => word.substring(0, 3)).join('').toUpperCase();
      
      const baseSymbol = symbol.length >= 6 ? symbol.substring(0, 6) : symbol + 'X'.repeat(6 - symbol.length);
      const hash = Math.abs(name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 1000;
      
      return `${baseSymbol}${hash.toString().padStart(3, '0')}`;
    };

    const testStocks = [
      {
        stockName: "J K Lakshmi Cement Ltd.",
        stockSymbol: generateStockSymbol("J K Lakshmi Cement Ltd."),
        sector: "Cement & cement products"
      },
      {
        stockName: "Sai Life Sciences Ltd.",
        stockSymbol: generateStockSymbol("Sai Life Sciences Ltd."),
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
