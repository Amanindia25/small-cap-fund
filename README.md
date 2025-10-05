# Small Cap Mutual Fund Scraper
Developer Name: Aman

A TypeScript + Puppeteer scraper to extract small cap mutual fund data from Moneycontrol.

## Features

- 🎯 **Targeted Scraping**: Specifically scrapes small cap mutual funds from Moneycontrol
- 📊 **Comprehensive Data**: Extracts fund details, AUM, returns, and ratings
- 🔧 **TypeScript**: Full type safety and modern JavaScript features
- 🚀 **Puppeteer**: Handles dynamic content and JavaScript-heavy sites
- 📁 **Multiple Outputs**: Saves data in both JSON and CSV formats
- 🛡️ **Error Handling**: Robust error handling and retry mechanisms

## Installation

```bash
npm install
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

### Quick Scrape

```bash
npm run scrape
```

## Output

The scraper will create an `output/` directory with:

- `small-cap-funds.json` - Complete fund data in JSON format
- `small-cap-funds.csv` - Fund data in CSV format for Excel/analysis

## Data Extracted

For each small cap mutual fund:

- **Scheme Name**: Full fund name
- **CRISIL Rating**: Star rating (1-5)
- **AUM**: Assets Under Management in Crores
- **Returns**: 1W, 1M, 3M, 6M, YTD, 1Y, 2Y, 3Y, 5Y, 10Y returns
- **Plan Type**: Direct Plan or Regular Plan
- **Sponsored Status**: Whether it's a sponsored advertisement

## Configuration

Edit `src/index.ts` to modify:

- `headless`: Set to `false` to see browser in action
- `timeout`: Request timeout in milliseconds
- `delay`: Delay between requests

## Project Structure

```
src/
├── types/
│   └── fund.types.ts          # TypeScript interfaces
├── services/
│   └── fund-scraper.service.ts # Main scraping logic
├── utils/
│   ├── browser.util.ts        # Browser management
│   └── data-processor.util.ts # Data processing utilities
└── index.ts                   # Entry point
```

## Requirements

- Node.js 16+
- TypeScript 5+
- Puppeteer (installed automatically)

## Notes

- The scraper automatically checks "Direct Plans" filter
- Handles sponsored advertisements by filtering them out
- Includes rate limiting to be respectful to the website
- Saves data with timestamps for tracking changes over time
