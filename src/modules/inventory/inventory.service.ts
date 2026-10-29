import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { Product } from '../products/entities/product.entity';
import { Store } from '../stores/entities/store.entity';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly redisService: RedisService,
  ) {}

  async getStoreInventory(merchantId: string, storeId: string) {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, merchantId },
    });
    if (!store) {
      throw new NotFoundException('Store not found for this merchant');
    }

    return this.inventoryRepo
      .createQueryBuilder('inv')
      .innerJoinAndSelect('inv.product', 'product')
      .where('inv.store_id = :storeId', { storeId })
      .andWhere('product.merchant_id = :merchantId', { merchantId })
      .orderBy('product.name', 'ASC')
      .getMany();
  }

  async updateStock(
    merchantId: string,
    storeId: string,
    productId: string,
    dto: UpdateInventoryDto,
  ) {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, merchantId },
    });
    if (!store) {
      throw new NotFoundException('Store not found for this merchant');
    }

    const product = await this.productRepo.findOne({
      where: { id: productId, merchantId },
    });
    if (!product) {
      throw new NotFoundException('Product not found for this merchant');
    }

    let inventory = await this.inventoryRepo.findOne({
      where: { storeId, productId },
    });

    if (!inventory) {
      inventory = this.inventoryRepo.create({
        storeId,
        productId,
        quantity: dto.quantity,
      });
    } else {
      inventory.quantity = dto.quantity;
    }

    const saved = await this.inventoryRepo.save(inventory);

    await this.redisService.del(
      `products:merchant:${merchantId}:store:${storeId}`,
    );

    return saved;
  }
}
