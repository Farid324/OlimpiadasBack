// src/common/interceptors/bigint-serializer.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs/operators';

function stringifyBigInt(value: any): any {
  return JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}

@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((data) => {
        // Si data es undefined (como en endpoints que usan res.send() directamente),
        // no intentar serializar - esto ocurre en exports de Excel
        if (data === undefined) {
          return data;
        }
        return stringifyBigInt(data);
      }),
    );
  }
}
