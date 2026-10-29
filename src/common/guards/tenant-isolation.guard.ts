import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '../enums/role.enum';

@Injectable()
export class TenantIsolationGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    const targetMerchantId =
      request.params?.merchantId ||
      request.body?.merchantId ||
      request.query?.merchantId;
    const targetStoreId =
      request.params?.storeId ||
      request.body?.storeId ||
      request.query?.storeId;

    if (targetMerchantId && targetMerchantId !== user.merchantId) {
      throw new ForbiddenException(
        'Access denied: cannot access resources belonging to another merchant',
      );
    }

    if (targetStoreId) {
      if (user.role === Role.MERCHANT_ADMIN) {
        return true;
      }

      if (user.storeId && user.storeId !== targetStoreId) {
        throw new ForbiddenException(
          'Access denied: cannot access resources of another store',
        );
      }
    }

    return true;
  }
}
