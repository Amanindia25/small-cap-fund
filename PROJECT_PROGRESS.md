# Small Cap Fund Tracker - Project Progress

## Project Overview

Building a system to scrape all small funds in India, compare portfolios, and track daily changes.

## Technology Stack

- **Backend:** Node.js + TypeScript + Express + MongoDB
- **Frontend:** Next.js + TypeScript + Tailwind CSS + shadcn/ui
- **Database:** MongoDB with Mongoose
- **Scraping:** Puppeteer (existing)

---

## Work Breakdown (15 Small Chunks)

### Phase 1: Database Setup

- [ ] **Chunk 1:** Install and setup MongoDB locally
- [ ] **Chunk 2:** Install new dependencies (mongoose, express, etc.)
- [ ] **Chunk 3:** Create MongoDB models (Fund, Holding, PortfolioChange)
- [ ] **Chunk 4:** Setup MongoDB connection in the project

### Phase 2: Enhanced Scraper

- [x] **Chunk 5:** Enhance scraper to get individual stock holdings
- [ ] **Chunk 6:** Test enhanced scraper and save data to MongoDB

### Phase 3: Basic API

- [ ] **Chunk 7:** Create basic Express API with one endpoint (GET /funds)
- [ ] **Chunk 8:** Add holdings endpoint (GET /funds/:id/holdings?date=YYYY-MM-DD)
- [ ] **Chunk 9:** Add comparison endpoint (GET /funds/:id/compare?from=...&to=...)
- [ ] **Chunk 10:** Test API endpoints with Postman/browser

### Phase 4: Frontend (shadcn/ui only; Tailwind just for spacing/responsive)

- [ ] **Chunk 11:** Init Next.js (App Router) + Tailwind; install shadcn/ui; configure theme
- [ ] **Chunk 12:** Funds list page: `DataTable` (shadcn/ui Table) with search/sort; calls GET /funds
- [ ] **Chunk 13:** Fund details page: Tabs (Holdings, Changes), `Card`, `Table`; calls holdings endpoint
- [ ] **Chunk 14:** Compare view: DateRangePicker + `Button`/`Badge`; diff table highlighting added/trimmed/weight change
- [ ] **Chunk 15:** Global layout with `Navbar`, `Toaster` (for errors), only Tailwind for padding/gaps

### Phase 5: Daily Tracking

- [ ] **Chunk 16:** Cron/scheduler (daily) to scrape + persist snapshots
- [ ] **Chunk 17:** PortfolioChange computation and storage
- [ ] **Chunk 18:** E2E test run (scrape → save → compare → API → UI)

---

## Progress Tracking

### Completed Chunks

- [x] **Chunk 1:** Install and setup MongoDB locally ✅ (Using MongoDB Atlas)
- [x] **Chunk 2:** Install new dependencies (mongoose, express, etc.) ✅
- [x] **Chunk 3:** Create MongoDB models (Fund, Holding, PortfolioChange) ✅
- [x] **Chunk 4:** Setup MongoDB connection in the project ✅

### Current Status

**Chunk 5 completed; Chunk 6 in progress; API/UI not started**

- Implemented visible scraping flow (scroll → click → new tab → scrape → close → return)
- India filter applied once and re-applied after each return
- Sponsored rows ignored automatically
- Individual holdings parsing added (header-based; multiple table selectors)
- Data saving to MongoDB wired (fund + holdings)

Remaining for Chunk 6:

- Improve per-fund table selectors to consistently capture rows (some funds still return 0)
- Normalize columns (Company/Stock, %/Weight, Market Value) across variants
- Add robust AJAX row wait (ensure tbody row count > 0 before parse)

### Next Steps

1. Finalize holdings row selectors and header mapping; ensure >0 rows across all funds
2. Add deterministic waits for `tbody tr` > 0 on fund pages
3. Re-run end-to-end; verify holdings saved; mark Chunk 6 complete
4. Build API (Chunks 7–10)
5. Build shadcn/ui frontend (Chunks 11–15) – Tailwind only for spacing/responsive
6. Add daily scheduler and PortfolioChange (Chunks 16–18)

---

## Notes

- Each chunk should take 1-2 hours
- Test each chunk before moving to next
- Update this file when completing each chunk
- Keep it simple and focused

---

## Last Updated

Created: 2025-09-11
Last Modified: 2025-09-11
