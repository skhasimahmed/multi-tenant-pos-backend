import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from './entities/store.entity';

@Injectable()
export class StoresService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  async findAllByMerchant(merchantId: string) {
    return this.storeRepo.find({
      where: { merchantId },
      order: { name: 'ASC' },
    });
  }

  async findOne(merchantId: string, storeId: string) {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, merchantId },
    });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }
}
