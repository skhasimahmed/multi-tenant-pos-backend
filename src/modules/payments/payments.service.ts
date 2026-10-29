import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Payment } from './entities/payment.entity';
import {
  IPaymentProvider,
  PAYMENT_PROVIDER,
  ProcessPaymentParams,
} from './interfaces/payment-provider.interface';
import { PaymentStatus } from '../../common/enums/payment-status.enum';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: IPaymentProvider,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async processAndRecord(
    params: ProcessPaymentParams,
    manager?: EntityManager,
  ) {
    const result = await this.paymentProvider.processPayment(params);

    const payment = new Payment();
    payment.saleId = params.saleId;
    payment.amount = params.amount;
    payment.provider = 'MOCK';
    payment.status = result.success
      ? PaymentStatus.SUCCESS
      : PaymentStatus.FAILED;
    payment.transactionId = result.transactionId;
    payment.errorMessage = result.errorMessage;

    const savedPayment = manager
      ? await manager.save(Payment, payment)
      : await this.paymentRepo.save(payment);

    return { result, payment: savedPayment };
  }
}
