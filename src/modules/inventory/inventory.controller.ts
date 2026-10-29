import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantIsolationGuard } from '../../common/guards/tenant-isolation.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard, TenantIsolationGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('store/:storeId')
  async getStoreInventory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.inventoryService.getStoreInventory(user.merchantId, storeId);
  }

  @Put('store/:storeId/product/:productId')
  @Roles(Role.MERCHANT_ADMIN, Role.STORE_MANAGER)
  async updateStock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.inventoryService.updateStock(
      user.merchantId,
      storeId,
      productId,
      dto,
    );
  }
}
