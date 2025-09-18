# Stock Scraping from Screener.in

This module scrapes detailed stock information from screener.in for all holdings in the small-cap mutual funds.

## Features

- **Automated Login**: Logs into screener.in with provided credentials
- **Stock Search**: Searches for each stock by name on screener.in
- **Data Extraction**: Extracts comprehensive financial metrics
- **Database Storage**: Stores stock data in MongoDB
- **Daily Scheduling**: Automatically runs daily at 6:00 AM IST
- **API Endpoints**: RESTful APIs to manage and view stock data

## Stock Data Extracted

### Basic Information

- Stock Name & Symbol
- Current Price
- Market Cap
- Sector & Industry

### Financial Ratios

- P/E Ratio
- P/B Ratio
- Debt to Equity
- ROE (Return on Equity)
- ROA (Return on Assets)
- Current Ratio
- Quick Ratio
- Interest Coverage

### Growth Metrics

- Sales Growth
- Profit Growth
- EPS (Earnings Per Share)
- Book Value
- Dividend Yield

### Cash Flow

- Operating Cash Flow
- Free Cash Flow
- Investing Cash Flow
- Financing Cash Flow

### Ownership

- Promoter Holding
- FII Holding
- DII Holding
- Public Holding

## Usage

### 1. Manual Stock Scraping

```bash
# Test with sample stocks
npm run test:stock-scraping

# Scrape all stocks from fund holdings
npm run scrape:stocks
```

### 2. API Endpoints

#### Get All Stocks

```http
GET /api/stocks?limit=50&page=1
```

#### Get Stock by Symbol

```http
GET /api/stocks/{symbol}
```

#### Trigger Stock Scraping

```http
POST /api/admin/trigger-stock-scraping
```

#### Get Scraping Status

```http
GET /api/admin/stock-scraping-status
```

#### Scrape Specific Stocks

```http
POST /api/admin/scrape-specific-stocks
Content-Type: application/json

{
  "stocks": [
    {
      "stockName": "J K Lakshmi Cement Ltd.",
      "stockSymbol": "J K Lakshm",
      "sector": "Cement & cement products"
    }
  ]
}
```

### 3. Automated Daily Scraping

The system automatically runs daily at 6:00 AM IST to scrape all unique stocks from fund holdings.

## Configuration

### Login Credentials

- Email: `amankumarsinghindia2004@gmail.com`
- Password: `amankumarsinghindia2004@gmail.com`

### URLs

- Login: `https://www.screener.in/login/?`
- Dashboard: `https://www.screener.in/dash/`

## Database Schema

### Stock Model

```typescript
interface IStock {
  stockName: string;
  stockSymbol: string;
  screenerUrl?: string;
  currentPrice?: number;
  marketCap?: number;
  pe?: number;
  pb?: number;
  debtToEquity?: number;
  roe?: number;
  roa?: number;
  salesGrowth?: number;
  profitGrowth?: number;
  sector: string;
  industry?: string;
  // ... and many more financial metrics
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

## Error Handling

- **Login Failures**: Retries with different selectors
- **Search Failures**: Logs and continues with next stock
- **Data Extraction**: Graceful handling of missing fields
- **Rate Limiting**: Built-in delays between requests

## Monitoring

- Real-time logging of scraping progress
- Status endpoints to check if scraping is running
- Error logging for failed operations
- Success/failure counts

## Notes

- The scraper respects screener.in's rate limits
- Data is updated daily to ensure freshness
- Failed stocks are logged but don't stop the process
- All scraped data is stored with timestamps for tracking
