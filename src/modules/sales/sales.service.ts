import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { DataSource, Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { IdempotencyRecord } from './entities/idempotency-record.entity';
import { Product } from '../products/entities/product.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Store } from '../stores/entities/store.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from '../payments/payments.service';
import { RedisService } from '../redis/redis.service';
import { SaleStatus } from '../../common/enums/sale-status.enum';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly paymentsService: PaymentsService,
    private readonly redisService: RedisService,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(IdempotencyRecord)
    private readonly idempotencyRepo: Repository<IdempotencyRecord>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  async createSale(
    user: AuthenticatedUser,
    dto: CreateSaleDto,
    idempotencyKey?: string,
  ) {
    const storeId = user.storeId || dto.storeId;
    if (!storeId) {
      throw new BadRequestException('Store ID must be specified');
    }

    if (
      user.role !== Role.MERCHANT_ADMIN &&
      user.storeId &&
      user.storeId !== storeId
    ) {
      throw new ForbiddenException('Cannot create sales for another store');
    }

    const store = await this.storeRepo.findOne({
      where: { id: storeId, merchantId: user.merchantId },
    });
    if (!store) {
      throw new NotFoundException('Store not found for this merchant');
    }

    if (idempotencyKey) {
      const existingRecord = await this.idempotencyRepo.findOne({
        where: { key: idempotencyKey, storeId },
      });
      if (existingRecord) {
        return JSON.parse(existingRecord.responseBody);
      }
    }

    const itemMap = new Map();
    for (const item of dto.items) {
      itemMap.set(
        item.productId,
        (itemMap.get(item.productId) || 0) + item.quantity,
      );
    }
    const requestedProductIds = Array.from(itemMap.keys());

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Sort product IDs deterministically to prevent deadlocks under concurrent transactions
      const sortedProductIds = [...requestedProductIds].sort();

      const products = await queryRunner.manager.find(Product, {
        where: {
          id: In(sortedProductIds),
          merchantId: user.merchantId,
          isActive: true,
        },
      });

      if (products.length !== sortedProductIds.length) {
        throw new BadRequestException(
          'One or more selected products are invalid or inactive',
        );
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      const inventories = await queryRunner.manager
        .createQueryBuilder(Inventory, 'inv')
        .setLock('pessimistic_write')
        .where('inv.store_id = :storeId', { storeId })
        .andWhere('inv.product_id IN (:...productIds)', {
          productIds: sortedProductIds,
        })
        .getMany();

      const inventoryMap = new Map(inventories.map((i) => [i.productId, i]));

      for (const [productId, requestedQty] of itemMap.entries()) {
        const inv = inventoryMap.get(productId);
        const available = inv ? inv.quantity : 0;
        const prod = productMap.get(productId);

        if (available < requestedQty) {
          throw new UnprocessableEntityException(
            `Insufficient inventory for "${prod.name}". Available: ${available}, Requested: ${requestedQty}`,
          );
        }
      }

      let totalAmount = 0;
      const preparedItems = [];

      for (const [productId, qty] of itemMap.entries()) {
        const prod = productMap.get(productId);
        const unitPrice = Number(prod.price);
        const subtotal = Number((unitPrice * qty).toFixed(2));
        totalAmount = Number((totalAmount + subtotal).toFixed(2));

        preparedItems.push({
          productId,
          unitPrice,
          quantity: qty,
          subtotal,
        });
      }

      const sale = queryRunner.manager.create(Sale, {
        merchantId: user.merchantId,
        storeId,
        userId: user.userId,
        idempotencyKey,
        status: SaleStatus.PENDING,
        totalAmount,
      });
      const savedSale = await queryRunner.manager.save(Sale, sale);

      const saleItems = preparedItems.map((item) =>
        queryRunner.manager.create(SaleItem, {
          saleId: savedSale.id,
          productId: item.productId,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.subtotal,
        }),
      );
      await queryRunner.manager.save(SaleItem, saleItems);

      const { result, payment } = await this.paymentsService.processAndRecord(
        {
          saleId: savedSale.id,
          amount: totalAmount,
          paymentToken: dto.paymentToken,
        },
        queryRunner.manager,
      );

      if (!result.success) {
        savedSale.status = SaleStatus.FAILED;
        await queryRunner.manager.save(Sale, savedSale);
        await queryRunner.commitTransaction();

        throw new BadRequestException(`Payment failed: ${result.errorMessage}`);
      }

      for (const [productId, qty] of itemMap.entries()) {
        const inv = inventoryMap.get(productId);
        inv.quantity -= qty;
        await queryRunner.manager.save(Inventory, inv);
      }

      savedSale.status = SaleStatus.COMPLETED;
      await queryRunner.manager.save(Sale, savedSale);

      await queryRunner.commitTransaction();

      const responsePayload = {
        id: savedSale.id,
        merchantId: savedSale.merchantId,
        storeId: savedSale.storeId,
        status: savedSale.status,
        totalAmount: savedSale.totalAmount,
        createdAt: savedSale.createdAt,
        items: preparedItems.map((pi) => ({
          productId: pi.productId,
          name: productMap.get(pi.productId).name,
          sku: productMap.get(pi.productId).sku,
          unitPrice: pi.unitPrice,
          quantity: pi.quantity,
          subtotal: pi.subtotal,
        })),
        payment: {
          id: payment.id,
          status: payment.status,
          transactionId: payment.transactionId,
          amount: payment.amount,
        },
      };

      if (idempotencyKey) {
        const record = this.idempotencyRepo.create({
          key: idempotencyKey,
          storeId,
          statusCode: 201,
          responseBody: JSON.stringify(responsePayload),
        });
        await this.idempotencyRepo.save(record);
      }

      await this.redisService.del(
        `products:merchant:${user.merchantId}:store:${storeId}`,
      );

      return responsePayload;
    } catch (err) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findSalesByStore(user: AuthenticatedUser, storeId: string) {
    if (
      user.role !== Role.MERCHANT_ADMIN &&
      user.storeId &&
      user.storeId !== storeId
    ) {
      throw new ForbiddenException('Cannot access sales from another store');
    }

    const store = await this.storeRepo.findOne({
      where: { id: storeId, merchantId: user.merchantId },
    });
    if (!store) {
      throw new NotFoundException('Store not found for this merchant');
    }

    return this.saleRepo.find({
      where: { storeId, merchantId: user.merchantId },
      relations: { items: { product: true }, payment: true, user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(user: AuthenticatedUser, saleId: string) {
    const sale = await this.saleRepo.findOne({
      where: { id: saleId, merchantId: user.merchantId },
      relations: {
        items: { product: true },
        payment: true,
        user: true,
        store: true,
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (
      user.role !== Role.MERCHANT_ADMIN &&
      user.storeId &&
      user.storeId !== sale.storeId
    ) {
      throw new ForbiddenException('Cannot access sales from another store');
    }

    return sale;
  }
}
