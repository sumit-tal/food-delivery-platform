import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';

/**
 * Unit tests for HttpExceptionFilter to ensure consistent error responses.
 */
describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: Response;
  let mockRequest: Request;
  let statusSpy: jest.SpyInstance;
  let jsonSpy: jest.SpyInstance;

  const fixedDate: string = '2023-01-01T00:00:00.000Z';

  /**
   * Create a minimal ArgumentsHost mock for HTTP context.
   */
  function createHost(response: Response, request: Request): ArgumentsHost {
    const httpContext = {
      getResponse: (): Response => response,
      getRequest: (): Request => request,
    } as unknown as { getResponse: () => Response; getRequest: () => Request };

    return {
      switchToHttp: (): typeof httpContext => httpContext,
      getType: (): any => 'http',
      getArgByIndex: (_index: number): any => undefined,
      switchToRpc: (): any => undefined,
      switchToWs: (): any => undefined,
    } as unknown as ArgumentsHost;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(fixedDate));

    filter = new HttpExceptionFilter();

    // Prepare request mock
    mockRequest = { url: '/test/path' } as unknown as Request;

    // Prepare response mock with chained status().json()
    jsonSpy = jest.fn();
    const statusReturn: Partial<Response> = { json: jsonSpy as unknown as Response['json'] };
    statusSpy = jest.fn().mockReturnValue(statusReturn);

    mockResponse = {
      status: statusSpy as unknown as Response['status'],
    } as unknown as Response;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should handle HttpException with string body', () => {
    const message: string = 'Forbidden access';
    const exception: HttpException = new HttpException(message, HttpStatus.FORBIDDEN);

    const host: ArgumentsHost = createHost(mockResponse, mockRequest);

    filter.catch(exception, host);

    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(jsonSpy).toHaveBeenCalledWith({
      statusCode: HttpStatus.FORBIDDEN,
      path: '/test/path',
      timestamp: fixedDate,
      message,
    });
  });

  it('should handle HttpException with object body containing message string', () => {
    const body: { message: string; error?: string } = {
      message: 'Bad input',
      error: 'Bad Request',
    };
    const exception: HttpException = new HttpException(body, HttpStatus.BAD_REQUEST);

    const host: ArgumentsHost = createHost(mockResponse, mockRequest);

    filter.catch(exception, host);

    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonSpy).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      path: '/test/path',
      timestamp: fixedDate,
      message: 'Bad input',
    });
  });

  it('should handle HttpException with object body without message string by stringifying body', () => {
    const body: { errors: string[] } = { errors: ['f1', 'f2'] };
    const exception: HttpException = new HttpException(body, HttpStatus.UNPROCESSABLE_ENTITY);

    const host: ArgumentsHost = createHost(mockResponse, mockRequest);

    filter.catch(exception, host);

    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(jsonSpy).toHaveBeenCalledWith({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      path: '/test/path',
      timestamp: fixedDate,
      message: JSON.stringify(body),
    });
  });

  it('should handle generic Error as 500 with default message', () => {
    const exception: Error = new Error('Something broke');

    const host: ArgumentsHost = createHost(mockResponse, mockRequest);

    filter.catch(exception, host);

    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonSpy).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      path: '/test/path',
      timestamp: fixedDate,
      message: 'Internal server error',
    });
  });

  it('should handle HttpException with non-string/non-object response by using exception.message', () => {
    // Craft a subclass to force getResponse to return an unsupported type
    class CustomHttpException extends HttpException {
      public override getResponse(): object {
        // Return a number at runtime but type-cast to object to satisfy TS
        return 123 as unknown as object;
      }
    }

    const exception: CustomHttpException = new CustomHttpException('Weird', HttpStatus.CONFLICT);

    const host: ArgumentsHost = createHost(mockResponse, mockRequest);

    filter.catch(exception, host);

    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(jsonSpy).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      path: '/test/path',
      timestamp: fixedDate,
      message: 'Weird',
    });
  });
});
