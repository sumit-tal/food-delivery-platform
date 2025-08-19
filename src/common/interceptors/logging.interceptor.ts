import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * LoggingInterceptor logs basic request/response lifecycle information.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now: number = Date.now();
    const req: Request = context.switchToHttp().getRequest<Request>();
    const method: string = req.method;
    const url: string = req.url;
    return next.handle().pipe(
      tap((): void => {
        const elapsed: number = Date.now() - now;
        // eslint-disable-next-line no-console
        console.warn(`${method} ${url} - ${elapsed}ms`);
      })
    );
  }
}
