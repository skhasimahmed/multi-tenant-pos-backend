import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Store } from '../stores/entities/store.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly redisService: RedisService,
  ) {}

  async create(merchantId: string, dto: CreateProductDto) {
    const existing = await this.productRepo.findOne({
      where: { merchantId, sku: dto.sku },
    });
    if (existing) {
      throw new ConflictException(
        `Product with SKU "${dto.sku}" already exists for this merchant`,
      );
    }

    const product = this.productRepo.create({
      ...dto,
      merchantId,
    });
    const saved = await this.productRepo.save(product);

    await this.redisService.delPattern(`products:merchant:${merchantId}:*`);

    return saved;
  }

  async findAllByMerchant(merchantId: string) {
    return this.productRepo.find({
      where: { merchantId },
      order: { name: 'ASC' },
    });
  }

  async findByStoreWithInventory(merchantId: string, storeId: string) {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, merchantId },
    });
    if (!store) {
      throw new NotFoundException('Store not found for this merchant');
    }

    const cacheKey = `products:merchant:${merchantId}:store:${storeId}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const products = await this.productRepo.find({
      where: { merchantId, isActive: true },
      order: { name: 'ASC' },
    });

    const inventories = await this.inventoryRepo.find({
      where: { storeId },
    });

    const invMap = new Map(inventories.map((i) => [i.productId, i.quantity]));

    const result = products.map((prod) => ({
      id: prod.id,
      merchantId: prod.merchantId,
      sku: prod.sku,
      name: prod.name,
      description: prod.description,
      price: Number(prod.price),
      availableStock: invMap.get(prod.id) ?? 0,
    }));

    await this.redisService.set(cacheKey, JSON.stringify(result), 300);

    return result;
  }

  async findOne(merchantId: string, id: string) {
    const product = await this.productRepo.findOne({
      where: { id, merchantId },
    });
    if (!product) {
      throw new NotFoundException(`Product not found`);
    }
    return product;
  }

  async update(merchantId: string, id: string, dto: UpdateProductDto) {
    const product = await this.findOne(merchantId, id);
    Object.assign(product, dto);
    const updated = await this.productRepo.save(product);

    await this.redisService.delPattern(`products:merchant:${merchantId}:*`);
    return updated;
  }
}
