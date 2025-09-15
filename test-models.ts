// Test file to verify our MongoDB models work
import dotenv from 'dotenv';
import { connectDB } from './src/config/database';
import { Fund, Holding, PortfolioChange } from './src/models';

// Load environment variables
dotenv.config();

async function testModels() {
  try {
    console.log('🧪 Testing MongoDB Models...\n');
    
    // Connect to database
    await connectDB();
    
    // Test Fund model
    console.log('📊 Testing Fund model...');
    const fundCount = await Fund.countDocuments();
    console.log(`✅ Fund model works! Current funds: ${fundCount}`);
    
    // Test Holding model
    console.log('📈 Testing Holding model...');
    const holdingCount = await Holding.countDocuments();
    console.log(`✅ Holding model works! Current holdings: ${holdingCount}`);
    
    // Test PortfolioChange model
    console.log('🔄 Testing PortfolioChange model...');
    const changeCount = await PortfolioChange.countDocuments();
    console.log(`✅ PortfolioChange model works! Current changes: ${changeCount}`);
    
    console.log('\n🎉 All models are working correctly!');
    
  } catch (error) {
    console.error('❌ Model test failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testModels();
