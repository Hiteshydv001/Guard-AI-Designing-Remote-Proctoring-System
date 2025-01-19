// src/utils/errorResponse.ts

class ErrorResponse {
  statusCode: number;
  message: string;

  constructor(statusCode: number, message: string) {
    this.statusCode = statusCode;
    this.message = message;
  }

  static handle(error: any, funcname: string = '') {
    // You can further extend this to handle different error types
    let errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    if (funcname) {
      errorMessage = `Error in ${funcname}: ${errorMessage}`;
    }
    return new ErrorResponse(500, errorMessage);
  }
}

export { ErrorResponse };