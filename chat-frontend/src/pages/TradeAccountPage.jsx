import React, { useState, useEffect } from 'react';
import { ChevronDown, ArrowLeft, History, User, DollarSign, Clock } from 'lucide-react';

const TradeAccountPage = () => {
  const [activeTab, setActiveTab] = useState('recharge');
  const [dashboardData, setDashboardData] = useState({
    totalTransactions: 30,
    todayRevenue: 39740,
    todayDiamonds: 993500,
    inventoryAmount: 8052404
  });
  const [rechargeData, setRechargeData] = useState({
    recipientUserId: '',
    amount: '',
    sellingPrice: ''
  });
  const [transferHistory, setTransferHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchDashboardData();
    fetchTransferHistory();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/v1/coin-sellers/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setDashboardData({
          totalTransactions: data.data.todayStats.totalTransactions,
          todayRevenue: data.data.todayStats.totalRevenue,
          todayDiamonds: data.data.todayStats.totalDiamondsDistributed,
          inventoryAmount: data.data.coinSeller.diamondBalance
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  const fetchTransferHistory = async () => {
    try {
      const response = await fetch('/api/v1/coin-sellers/history?limit=10', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setTransferHistory(data.data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleRecharge = async () => {
    if (!rechargeData.recipientUserId || !rechargeData.amount) {
      setMessage({ text: 'Please fill all required fields', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/coin-sellers/distribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          recipientUserId: rechargeData.recipientUserId,
          amount: parseInt(rechargeData.amount),
          sellingPrice: parseInt(rechargeData.sellingPrice) || 0
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ text: 'Recharge successful!', type: 'success' });
        setRechargeData({ recipientUserId: '', amount: '', sellingPrice: '' });
        fetchDashboardData();
        fetchTransferHistory();
      } else {
        setMessage({ text: data.message || 'Recharge failed', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Error processing recharge', type: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const handleWithdraw = async (transactionId) => {
    try {
      const response = await fetch('/api/v1/coin-sellers/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ transactionId })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ text: 'Withdrawal successful!', type: 'success' });
        fetchDashboardData();
        fetchTransferHistory();
      } else {
        setMessage({ text: data.message || 'Withdrawal failed', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Error processing withdrawal', type: 'error' });
    }
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
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

  if (showHistory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900">
        <div className="bg-gradient-to-r from-purple-700 to-purple-800 px-4 py-4 flex items-center">
          <button onClick={() => setShowHistory(false)} className="mr-4">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white text-xl font-semibold">Transfer Detail</h1>
        </div>

        <div className="p-4 space-y-4">
          {transferHistory.map((transaction) => (
            <div key={transaction._id} className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm text-gray-500">Send to</div>
                  <div className="font-semibold text-lg flex items-center">
                    {transaction.recipientId?.name || 'Unknown'}
                    <span className="ml-2">👤</span>
                  </div>
                  <div className="text-xs text-gray-400">{formatDate(transaction.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-xl ${
                    transaction.status === 'withdrawn' ? 'text-green-500' : 'text-orange-500'
                  }`}>
                    {transaction.status === 'withdrawn' ? '+' : '-'}{transaction.amount} 💎
                  </div>
                  {transaction.status === 'completed' && transaction.canWithdraw && (
                    <span className="text-xs text-green-500 bg-green-50 px-2 py-1 rounded">Activated</span>
                  )}
                  {transaction.status === 'withdrawn' && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Withdrawn</span>
                  )}
                </div>
              </div>

              {transaction.metadata?.sellingPrice && (
                <div className="text-sm text-gray-600 mb-2">
                  Selling Price: ₹{transaction.metadata.sellingPrice}
                </div>
              )}

              <div className="text-sm text-gray-500 mb-3">
                Remaining Diamonds: {transaction.recipientId?.coinBalance || 0}
              </div>

              {transaction.status === 'completed' && transaction.canWithdraw && (
                <div className="flex space-x-2">
                  <button className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium">
                    Activate
                  </button>
                  <button 
                    onClick={() => handleWithdraw(transaction._id)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium"
                  >
                    Recall
                  </button>
                </div>
              )}

              {transaction.status === 'withdrawn' && (
                <div className="bg-green-50 text-green-600 py-2 px-4 rounded-lg text-center text-sm">
                  ✓ Amount transferred successfully
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900">
      <div className="bg-gradient-to-r from-purple-700 to-purple-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <ArrowLeft className="w-6 h-6 text-white mr-4" />
          <h1 className="text-white text-xl font-semibold">Trade Account</h1>
        </div>
        <div className="flex items-center text-white">
          <span className="mr-2">Today</span>
          <ChevronDown className="w-5 h-5" />
        </div>
      </div>

      {message.text && (
        <div className={`mx-4 mt-4 p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="p-4">
        <div className="bg-purple-800 bg-opacity-50 rounded-xl p-4 mb-4">
          <div className="text-purple-200 text-sm mb-2">MY STATS:-</div>
          <div className="bg-purple-900 bg-opacity-40 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="text-white text-lg font-semibold">{dashboardData.totalTransactions} Transactions</div>
              <div className="text-purple-200">₹ {dashboardData.todayRevenue.toLocaleString()}</div>
              <div className="text-yellow-400 flex items-center">
                💎 {dashboardData.todayDiamonds.toLocaleString()}
              </div>
            </div>
            <div className="bg-yellow-400 rounded-full w-20 h-20 flex items-center justify-center text-white text-2xl font-bold">
              {dashboardData.totalTransactions}.00
            </div>
          </div>
        </div>

        <div className="bg-purple-800 bg-opacity-50 rounded-xl p-4 mb-6">
          <div className="text-white text-center mb-2">Inventory Amount</div>
          <div className="text-yellow-400 text-center text-2xl font-bold flex items-center justify-center">
            💎 {dashboardData.inventoryAmount.toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-t-3xl px-4 pt-6 pb-20">
          <div className="mb-6">
            <label className="text-gray-600 text-sm mb-2 block">Recharge Type</label>
            <div className="relative">
              <input
                type="text"
                value="Recharge"
                readOnly
                className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50"
              />
              <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-gray-600 text-sm mb-2 block">Transfer To</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="User ID"
                value={rechargeData.recipientUserId}
                onChange={(e) => setRechargeData({...rechargeData, recipientUserId: e.target.value})}
                className="w-full p-3 pl-10 border border-gray-200 rounded-lg"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-gray-600 text-sm mb-2 block">Enter Point</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="number"
                placeholder="Point"
                value={rechargeData.amount}
                onChange={(e) => setRechargeData({...rechargeData, amount: e.target.value})}
                className="w-full p-3 pl-10 border border-gray-200 rounded-lg"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-gray-600 text-sm mb-2 block">Enter Amount</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="number"
                placeholder="Amount"
                value={rechargeData.sellingPrice}
                onChange={(e) => setRechargeData({...rechargeData, sellingPrice: e.target.value})}
                className="w-full p-3 pl-10 border border-gray-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-2">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-gray-700">Balance</span>
            </div>
            <button 
              onClick={() => setShowHistory(true)}
              className="flex items-center text-purple-600"
            >
              <History className="w-5 h-5 mr-1" />
              <span className="text-sm">Recall successfully</span>
            </button>
          </div>

          <button
            onClick={handleRecharge}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 rounded-full text-lg font-semibold disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradeAccountPage;