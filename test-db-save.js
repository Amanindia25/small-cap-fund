const mongoose = require("mongoose");
require("dotenv").config();

async function testDatabaseSave() {
  try {
    console.log("🔗 Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to database");

    // Create a simple Stock schema
    const StockSchema = new mongoose.Schema(
      {
        stockName: { type: String, required: true },
        stockSymbol: { type: String, required: true, unique: true },
        sector: { type: String, required: true },
        date: { type: Date, default: Date.now },
      },
      { timestamps: true }
    );

    const Stock = mongoose.model("Stock", StockSchema);

    // Test saving a stock
    const testStock = new Stock({
      stockName: "Test Company Ltd",
      stockSymbol: "TEST123",
      sector: "Technology",
    });

    console.log("💾 Attempting to save test stock...");
    const savedStock = await testStock.save();
    console.log("✅ Test stock saved successfully:", savedStock.stockName);

    // Check total count
    const count = await Stock.countDocuments();
    console.log("📊 Total stocks in database:", count);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.connection.close();
    console.log("🔒 Database connection closed");
    process.exit(0);
  }
}

testDatabaseSave();
