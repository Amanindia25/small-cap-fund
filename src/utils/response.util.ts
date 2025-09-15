export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
  timestamp: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ResponseBuilder {
  static success<T>(data: T, message?: string, count?: number): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      count,
      timestamp: new Date().toISOString()
    };
  }

  static error(error: string, statusCode?: number): ApiResponse {
    return {
      success: false,
      error,
      timestamp: new Date().toISOString()
    };
  }

  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string
  ): PaginatedResponse<T> {
    return {
      success: true,
      data,
      message,
      count: data.length,
      timestamp: new Date().toISOString(),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}
