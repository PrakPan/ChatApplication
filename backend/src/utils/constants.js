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
    { id: '1', coins: 6600, price: 200, currency: 'INR', discount: 0 },
    { id: '2', coins: 16500, price: 500, currency: 'INR', discount: 20 },
    { id: '3', coins: 33500, price: 1000, currency: 'INR', discount: 30 },
    { id: '4', coins: 68000, price: 2000, currency: 'INR', discount: 40 },
    { id: '5', coins: 171000, price: 5000, currency: 'INR', discount: 50 },
    { id: '6', coins: 345000, price: 10000, currency: 'INR', discount: 60 }
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