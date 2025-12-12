const Host = require('../models/Host');
const User = require('../models/User');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// Add bank account
const addBankAccount = asyncHandler(async (req, res) => {
  const { accountName, accountNumber, ifscCode, bankName, upiId } = req.body;
  const userId = req.user._id;

  const host = await Host.findOne({ userId });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  // Initialize bankDetails array if it doesn't exist
  if (!Array.isArray(host.bankDetails)) {
    host.bankDetails = [];
  }

  // Check if account already exists
  const existingAccount = host.bankDetails.find(
    acc => acc.accountNumber === accountNumber
  );

  if (existingAccount) {
    throw new ApiError(400, 'Bank account already exists');
  }

  // Add new bank account
  host.bankDetails.push({
    accountName,
    accountNumber,
    ifscCode,
    bankName,
    upiId,
    isPrimary: host.bankDetails.length === 0 // First account is primary
  });

  await host.save();

  logger.info(`Bank account added for host: ${host._id}`);

  ApiResponse.success(res, 201, 'Bank account added successfully', {
    bankDetails: host.bankDetails
  });
});

// Get all bank accounts
const getBankAccounts = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const host = await Host.findOne({ userId });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  ApiResponse.success(res, 200, 'Bank accounts retrieved', {
    bankDetails: host.bankDetails || []
  });
});

// Update bank account
const updateBankAccount = asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  const { accountName, accountNumber, ifscCode, bankName, upiId } = req.body;
  const userId = req.user._id;

  const host = await Host.findOne({ userId });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  const accountIndex = host.bankDetails.findIndex(
    acc => acc._id.toString() === accountId
  );

  if (accountIndex === -1) {
    throw new ApiError(404, 'Bank account not found');
  }

  // Update account details
  if (accountName) host.bankDetails[accountIndex].accountName = accountName;
  if (accountNumber) host.bankDetails[accountIndex].accountNumber = accountNumber;
  if (ifscCode) host.bankDetails[accountIndex].ifscCode = ifscCode;
  if (bankName) host.bankDetails[accountIndex].bankName = bankName;
  if (upiId !== undefined) host.bankDetails[accountIndex].upiId = upiId;

  await host.save();

  logger.info(`Bank account updated: ${accountId} for host: ${host._id}`);

  ApiResponse.success(res, 200, 'Bank account updated successfully', {
    bankDetails: host.bankDetails
  });
});

// Delete bank account
const deleteBankAccount = asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  const userId = req.user._id;

  const host = await Host.findOne({ userId });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  const accountIndex = host.bankDetails.findIndex(
    acc => acc._id.toString() === accountId
  );

  if (accountIndex === -1) {
    throw new ApiError(404, 'Bank account not found');
  }

  // Remove account
  host.bankDetails.splice(accountIndex, 1);

  // If deleted account was primary and there are other accounts, make first one primary
  if (host.bankDetails.length > 0) {
    const hasPrimary = host.bankDetails.some(acc => acc.isPrimary);
    if (!hasPrimary) {
      host.bankDetails[0].isPrimary = true;
    }
  }

  await host.save();

  logger.info(`Bank account deleted: ${accountId} for host: ${host._id}`);

  ApiResponse.success(res, 200, 'Bank account deleted successfully', {
    bankDetails: host.bankDetails
  });
});

// Set primary bank account
const setPrimaryBankAccount = asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  const userId = req.user._id;

  const host = await Host.findOne({ userId });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  // Set all accounts to non-primary
  host.bankDetails.forEach(acc => {
    acc.isPrimary = acc._id.toString() === accountId;
  });

  await host.save();

  logger.info(`Primary bank account set: ${accountId} for host: ${host._id}`);

  ApiResponse.success(res, 200, 'Primary bank account updated', {
    bankDetails: host.bankDetails
  });
});

module.exports = {
  addBankAccount,
  getBankAccounts,
  updateBankAccount,
  deleteBankAccount,
  setPrimaryBankAccount
};