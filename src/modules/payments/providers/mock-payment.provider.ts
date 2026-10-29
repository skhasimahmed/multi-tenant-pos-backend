import { Injectable } from '@nestjs/common';
import {
  IPaymentProvider,
  ProcessPaymentParams,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  async processPayment(params: ProcessPaymentParams) {
    const token = params.paymentToken?.toLowerCase() || '';

    if (token.includes('fail') || token.includes('decline')) {
      return {
        success: false,
        errorMessage: 'Payment authorization declined by provider',
      };
    }

    return {
      success: true,
      transactionId: `mock_tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    };
  }
}
