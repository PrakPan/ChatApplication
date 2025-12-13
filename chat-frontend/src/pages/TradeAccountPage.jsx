import React, { useState, useEffect } from 'react';
import { ChevronDown, ArrowLeft, History, User, DollarSign, Clock, Loader2, AlertCircle } from 'lucide-react';

const TradeAccountPage = () => {
  const [activeTab, setActiveTab] = useState('recharge');
  const [dashboardData, setDashboardData] = useState(null);
  const [rechargeData, setRechargeData] = useState({
    recipientUserId: '',
    amount: '',
    sellingPrice: '',
    notes: ''
  });
  const [transferHistory, setTransferHistory] = useState([]);
  const [withdrawableTransactions, setWithdrawableTransactions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const API_BASE_URL = '/api/v1/coin_sellers';
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    initializePage();
  }, []);

  const initializePage = async () => {
    setPageLoading(true);
    await Promise.all([
      fetchDashboardData(),
      fetchTransferHistory(1),
      fetchWithdrawableTransactions()
    ]);
    setPageLoading(false);
  };

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setDashboardData({
          totalTransactions: data.data.todayStats.totalTransactions,
          todayRevenue: data.data.todayStats.totalRevenue,
          todayDiamonds: data.data.todayStats.totalDiamondsDistributed,
          inventoryAmount: data.data.coinSeller.diamondBalance,
          coinSeller: data.data.coinSeller
        });
      } else {
        showMessage('Failed to load dashboard data', 'error');
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      showMessage('Error loading dashboard', 'error');
    }
  };

  const fetchTransferHistory = async (page = 1, limit = 20) => {
    try {
      const response = await fetch(`${API_BASE_URL}/history?page=${page}&limit=${limit}&type=distribution`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setTransferHistory(data.data);
        setCurrentPage(data.currentPage);
        setTotalPages(data.totalPages);
      } else {
        showMessage('Failed to load history', 'error');
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      showMessage('Error loading history', 'error');
    }
  };

  const fetchWithdrawableTransactions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/withdrawable`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setWithdrawableTransactions(data.data);
      }
    } catch (error) {
      console.error('Error fetching withdrawable transactions:', error);
    }
  };

  const handleRecharge = async () => {
    if (!rechargeData.recipientUserId || !rechargeData.amount) {
      showMessage('Please fill all required fields', 'error');
      return;
    }

    if (parseInt(rechargeData.amount) <= 0) {
      showMessage('Amount must be greater than 0', 'error');
      return;
    }

    if (dashboardData && parseInt(rechargeData.amount) > dashboardData.inventoryAmount) {
      showMessage('Insufficient diamond balance', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/distribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientUserId: rechargeData.recipientUserId,
          amount: parseInt(rechargeData.amount),
          sellingPrice: parseInt(rechargeData.sellingPrice) || 0,
          notes: rechargeData.notes || 'Diamond recharge'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        showMessage('Recharge successful!', 'success');
        setRechargeData({ recipientUserId: '', amount: '', sellingPrice: '', notes: '' });
        await Promise.all([
          fetchDashboardData(),
          fetchTransferHistory(currentPage),
          fetchWithdrawableTransactions()
        ]);
      } else {
        showMessage(data.message || 'Recharge failed', 'error');
      }
    } catch (error) {
      console.error('Error processing recharge:', error);
      showMessage('Error processing recharge', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (transactionId) => {
    if (!window.confirm('Are you sure you want to recall this transaction?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transactionId })
      });

      const data = await response.json();
      
      if (data.success) {
        showMessage('Withdrawal successful!', 'success');
        await Promise.all([
          fetchDashboardData(),
          fetchTransferHistory(currentPage),
          fetchWithdrawableTransactions()
        ]);
      } else {
        showMessage(data.message || 'Withdrawal failed', 'error');
      }
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      showMessage('Error processing withdrawal', 'error');
    }
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num) => {
    return num?.toLocaleString('en-IN') || '0';
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchTransferHistory(newPage);
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900">
        <div className="bg-gradient-to-r from-purple-700 to-purple-800 px-4 py-4 flex items-center">
          <button onClick={() => setShowHistory(false)} className="mr-4">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white text-xl font-semibold">Transfer Detail</h1>
        </div>

        {message.text && (
          <div className={`mx-4 mt-4 p-3 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <div className="p-4 space-y-4">
          {transferHistory.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No transaction history found</p>
            </div>
          ) : (
            transferHistory.map((transaction) => (
              <div key={transaction._id} className="bg-white rounded-lg p-4 shadow-md">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm text-gray-500">Send to</div>
                    <div className="font-semibold text-lg flex items-center">
                      {transaction.recipientId?.name || 'Unknown User'}
                      <span className="ml-2">👤</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      User ID: {transaction.recipientId?.userId || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400">{formatDate(transaction.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-xl ${
                      transaction.status === 'withdrawn' ? 'text-green-500' : 'text-orange-500'
                    }`}>
                      {transaction.status === 'withdrawn' ? '+' : '-'}{formatNumber(transaction.amount)} 💎
                    </div>
                    {transaction.status === 'completed' && transaction.canWithdraw && (
                      <span className="text-xs text-green-500 bg-green-50 px-2 py-1 rounded mt-1 inline-block">
                        Can Recall
                      </span>
                    )}
                    {transaction.status === 'withdrawn' && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded mt-1 inline-block">
                        Withdrawn
                      </span>
                    )}
                  </div>
                </div>

                {transaction.metadata?.sellingPrice && (
                  <div className="text-sm text-gray-600 mb-2">
                    Selling Price: ₹{formatNumber(transaction.metadata.sellingPrice)}
                  </div>
                )}

                <div className="text-sm text-gray-500 mb-3">
                  User Balance: {formatNumber(transaction.recipientId?.coinBalance || 0)} 💎
                </div>

                {transaction.notes && (
                  <div className="text-sm text-gray-500 mb-3 italic">
                    Note: {transaction.notes}
                  </div>
                )}

                {transaction.status === 'completed' && transaction.canWithdraw && 
                 new Date(transaction.withdrawalDeadline) > new Date() && (
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleWithdraw(transaction._id)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium transition-colors"
                    >
                      Recall Diamonds
                    </button>
                  </div>
                )}

                {transaction.status === 'withdrawn' && (
                  <div className="bg-green-50 text-green-600 py-2 px-4 rounded-lg text-center text-sm">
                    ✓ Amount recalled successfully
                  </div>
                )}

                {transaction.canWithdraw && new Date(transaction.withdrawalDeadline) <= new Date() && (
                  <div className="bg-red-50 text-red-600 py-2 px-4 rounded-lg text-center text-sm">
                    ⚠ Withdrawal deadline expired
                  </div>
                )}
              </div>
            ))
          )}

          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-4 bg-white rounded-lg p-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900">
      <div className="bg-gradient-to-r from-purple-700 to-purple-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <ArrowLeft className="w-6 h-6 text-white mr-4 cursor-pointer" onClick={() => window.history.back()} />
          <h1 className="text-white text-xl font-semibold">Trade Account</h1>
        </div>
        <div className="flex items-center text-white">
          <span className="mr-2">Today</span>
          <ChevronDown className="w-5 h-5" />
        </div>
      </div>

      {message.text && (
        <div className={`mx-4 mt-4 p-3 rounded-lg flex items-center ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          <AlertCircle className="w-5 h-5 mr-2" />
          {message.text}
        </div>
      )}

      <div className="p-4">
        {dashboardData && (
          <>
            <div className="bg-purple-800 bg-opacity-50 rounded-xl p-4 mb-4">
              <div className="text-purple-200 text-sm mb-2">MY STATS - TODAY</div>
              <div className="bg-purple-900 bg-opacity-40 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="text-white text-lg font-semibold">
                    {dashboardData.totalTransactions} Transactions
                  </div>
                  <div className="text-purple-200">
                    ₹ {formatNumber(dashboardData.todayRevenue)}
                  </div>
                  <div className="text-yellow-400 flex items-center">
                    💎 {formatNumber(dashboardData.todayDiamonds)}
                  </div>
                </div>
                <div className="bg-yellow-400 rounded-full w-20 h-20 flex items-center justify-center text-white text-2xl font-bold">
                  {dashboardData.totalTransactions}
                </div>
              </div>
            </div>

            <div className="bg-purple-800 bg-opacity-50 rounded-xl p-4 mb-4">
              <div className="text-white text-center mb-2">Inventory Amount</div>
              <div className="text-yellow-400 text-center text-2xl font-bold flex items-center justify-center">
                💎 {formatNumber(dashboardData.inventoryAmount)}
              </div>
              <div className="text-purple-200 text-center text-sm mt-1">
                Available for distribution
              </div>
            </div>

            {withdrawableTransactions.length > 0 && (
              <div className="bg-orange-500 bg-opacity-20 rounded-xl p-4 mb-4 border border-orange-400">
                <div className="text-white text-sm mb-2 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Withdrawable Transactions
                </div>
                <div className="text-yellow-300 text-lg font-semibold">
                  {withdrawableTransactions.length} transaction(s) can be recalled
                </div>
                <button 
                  onClick={() => setShowHistory(true)}
                  className="text-white text-sm underline mt-2"
                >
                  View Details
                </button>
              </div>
            )}
          </>
        )}

        <div className="bg-white rounded-t-3xl px-4 pt-6 pb-20">
          <div className="mb-6">
            <label className="text-gray-600 text-sm mb-2 block">Recharge Type</label>
            <div className="relative">
              <input
                type="text"
                value="Diamond Distribution"
                readOnly
                className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50"
              />
              <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-gray-600 text-sm mb-2 block">Transfer To (User ID) *</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Enter User ID"
                value={rechargeData.recipientUserId}
                onChange={(e) => setRechargeData({...rechargeData, recipientUserId: e.target.value})}
                className="w-full p-3 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-gray-600 text-sm mb-2 block">Enter Diamonds *</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">💎</span>
              <input
                type="number"
                placeholder="Diamond Amount"
                value={rechargeData.amount}
                onChange={(e) => setRechargeData({...rechargeData, amount: e.target.value})}
                className="w-full p-3 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {dashboardData && (
              <div className="text-sm text-gray-500 mt-1">
                Available: {formatNumber(dashboardData.inventoryAmount)} 💎
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="text-gray-600 text-sm mb-2 block">Selling Price (₹)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="number"
                placeholder="Enter selling price"
                value={rechargeData.sellingPrice}
                onChange={(e) => setRechargeData({...rechargeData, sellingPrice: e.target.value})}
                className="w-full p-3 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-gray-600 text-sm mb-2 block">Notes (Optional)</label>
            <textarea
              placeholder="Add notes for this transaction"
              value={rechargeData.notes}
              onChange={(e) => setRechargeData({...rechargeData, notes: e.target.value})}
              className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              rows="2"
            />
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-gray-700">Balance: {dashboardData ? formatNumber(dashboardData.inventoryAmount) : '0'} 💎</span>
            </div>
            <button 
              onClick={() => setShowHistory(true)}
              className="flex items-center text-purple-600 hover:text-purple-700"
            >
              <History className="w-5 h-5 mr-1" />
              <span className="text-sm">View History</span>
            </button>
          </div>

          <button
            onClick={handleRecharge}
            disabled={loading || !dashboardData}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 rounded-full text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-purple-800 transition-all flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Transfer Diamonds'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradeAccountPage;