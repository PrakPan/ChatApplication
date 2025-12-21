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
    { id: '1', coins: 4500, price: 199, currency: 'INR', discount: 0 },
    { id: '2', coins: 9500, price: 399, currency: 'INR', discount: 0 },
    { id: '3', coins: 22000, price: 899, currency: 'INR', discount: 0 },
    { id: '4', coins: 45000, price: 1799, currency: 'INR', discount: 0 },
    { id: '5', coins: 50000, price: 1999, currency: 'INR', discount: 0 },
    { id: '6', coins: 100000, price: 3799, currency: 'INR', discount: 0 }
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