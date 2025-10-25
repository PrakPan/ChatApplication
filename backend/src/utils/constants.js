module.exports = {
  ROLES: {
    USER: 'user',
    HOST: 'host',
    ADMIN: 'admin'
  },
  
  CALL_STATUS: {
    INITIATED: 'initiated',
    ONGOING: 'ongoing',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    FAILED: 'failed'
  },
  
  TRANSACTION_TYPES: {
    PURCHASE: 'purchase',
    CALL_DEBIT: 'call_debit',
    CALL_CREDIT: 'call_credit',
    WITHDRAWAL: 'withdrawal',
    REFUND: 'refund'
  },
  
  HOST_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    SUSPENDED: 'suspended'
  },
  
  COIN_PACKAGES: [
    { id: '1', coins: 1000, price: 99, currency: 'INR', discount: 0 },
    { id: '2', coins: 5000, price: 399, currency: 'INR', discount: 20 },
    { id: '3', coins: 10000, price: 699, currency: 'INR', discount: 30 },
    { id: '4', coins: 25000, price: 1499, currency: 'INR', discount: 40 }
  ],
  
  REVENUE_SPLIT: {
    HOST_PERCENTAGE: 70,
    PLATFORM_PERCENTAGE: 30
  },
  
  WITHDRAWAL_LIMITS: {
    MIN_AMOUNT: 100,
    MAX_AMOUNT: 50000
  }
};