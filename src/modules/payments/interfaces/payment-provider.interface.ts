export interface ProcessPaymentParams {
  saleId: string;
  amount: number;
  currency?: string;
  paymentToken?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  errorMessage?: string;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface IPaymentProvider {
  processPayment(params: ProcessPaymentParams): Promise<PaymentResult>;
}
