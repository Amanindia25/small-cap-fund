export interface ScrapingStatus {
  isRunning: boolean;
  currentStep: string;
  progress: number; // 0-100
  totalFunds: number;
  processedFunds: number;
  startTime: Date | null;
  endTime: Date | null;
  errors: string[];
  result: {
    success: boolean;
    totalFunds: number;
    updatedFunds: number;
    newFunds: number;
    errors: string[];
  } | null;
}

export class ScrapingStatusService {
  private static instance: ScrapingStatusService;
  private status: ScrapingStatus = {
    isRunning: false,
    currentStep: '',
    progress: 0,
    totalFunds: 0,
    processedFunds: 0,
    startTime: null,
    endTime: null,
    errors: [],
    result: null
  };

  static getInstance(): ScrapingStatusService {
    if (!ScrapingStatusService.instance) {
      ScrapingStatusService.instance = new ScrapingStatusService();
    }
    return ScrapingStatusService.instance;
  }

  getStatus(): ScrapingStatus {
    return { ...this.status };
  }

  startScraping(totalFunds: number): void {
    this.status = {
      isRunning: true,
      currentStep: 'Starting scraping process...',
      progress: 0,
      totalFunds,
      processedFunds: 0,
      startTime: new Date(),
      endTime: null,
      errors: [],
      result: null
    };
    console.log('🚀 Scraping started:', this.status);
  }

  updateProgress(step: string, processedFunds: number): void {
    if (this.status.totalFunds > 0) {
      this.status.progress = Math.round((processedFunds / this.status.totalFunds) * 100);
    }
    this.status.currentStep = step;
    this.status.processedFunds = processedFunds;
    console.log(`📊 Progress: ${this.status.progress}% - ${step}`);
  }

  addError(error: string): void {
    this.status.errors.push(error);
    console.error('❌ Scraping error:', error);
  }

  completeScraping(result: {
    success: boolean;
    totalFunds: number;
    updatedFunds: number;
    newFunds: number;
    errors: string[];
  }): void {
    this.status.isRunning = false;
    this.status.currentStep = 'Scraping completed';
    this.status.progress = 100;
    this.status.endTime = new Date();
    this.status.result = result;
    console.log('✅ Scraping completed:', result);
  }

  reset(): void {
    this.status = {
      isRunning: false,
      currentStep: '',
      progress: 0,
      totalFunds: 0,
      processedFunds: 0,
      startTime: null,
      endTime: null,
      errors: [],
      result: null
    };
  }
}
