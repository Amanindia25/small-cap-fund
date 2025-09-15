import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Mock data for testing
const mockFunds = [
  {
    _id: '1',
    name: 'HDFC Small Cap Fund',
    amc: 'HDFC Mutual Fund',
    category: 'Small Cap',
    aum: 15000000000,
    expenseRatio: 1.2,
    crisilRating: 4,
    createdAt: new Date().toISOString()
  },
  {
    _id: '2',
    name: 'SBI Small Cap Fund',
    amc: 'SBI Mutual Fund',
    category: 'Small Cap',
    aum: 12000000000,
    expenseRatio: 1.5,
    crisilRating: 3,
    createdAt: new Date().toISOString()
  }
];

// Routes
app.get('/api/funds', async (req, res) => {
  try {
    res.json({
      success: true,
      data: mockFunds,
      count: mockFunds.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch funds'
    });
  }
});

app.get('/api/funds/compare/:fund1/:fund2', async (req, res) => {
  try {
    const { fund1, fund2 } = req.params;
    
    // Mock comparison data
    const comparison = {
      fund1: {
        id: fund1,
        holdings: [
          { _id: '1', stockName: 'Reliance', stockSymbol: 'RELIANCE', percentage: 5.2, sector: 'Energy' },
          { _id: '2', stockName: 'TCS', stockSymbol: 'TCS', percentage: 4.8, sector: 'IT' }
        ],
        totalHoldings: 2
      },
      fund2: {
        id: fund2,
        holdings: [
          { _id: '3', stockName: 'Infosys', stockSymbol: 'INFY', percentage: 6.1, sector: 'IT' },
          { _id: '4', stockName: 'HDFC Bank', stockSymbol: 'HDFCBANK', percentage: 5.5, sector: 'Banking' }
        ],
        totalHoldings: 2
      },
      commonHoldings: [],
      uniqueToFund1: [
        { _id: '1', stockName: 'Reliance', stockSymbol: 'RELIANCE', percentage: 5.2, sector: 'Energy' },
        { _id: '2', stockName: 'TCS', stockSymbol: 'TCS', percentage: 4.8, sector: 'IT' }
      ],
      uniqueToFund2: [
        { _id: '3', stockName: 'Infosys', stockSymbol: 'INFY', percentage: 6.1, sector: 'IT' },
        { _id: '4', stockName: 'HDFC Bank', stockSymbol: 'HDFCBANK', percentage: 5.5, sector: 'Banking' }
      ]
    };

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to compare funds'
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
app.listen(PORT, () => {
  console.log(`🚀 Simple API Server running on http://localhost:${PORT}`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET /api/funds - List all funds`);
  console.log(`   GET /api/funds/compare/:fund1/:fund2 - Compare two funds`);
  console.log(`   GET /api/health - Health check`);
});

