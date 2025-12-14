import React, { useState, useEffect } from 'react';
import {
  BiDiamond,
  BiWallet,
  BiHistory,
  BiPlus,
  BiTrash,
  BiInfoCircle
} from 'react-icons/bi';
import { 
  FiClock, 
  FiCheckCircle, 
  FiXCircle,
  FiAlertCircle,
  FiX,
  FiChevronLeft
} from 'react-icons/fi';
import { MdAccountBalance, MdOutlineAttachMoney } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../services/api';
import { BanknoteIcon } from 'lucide-react';

const HostWithdrawalUI = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  // Data from API
  const [balance, setBalance] = useState(0);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [stats, setStats] = useState({
    totalRequested: 0,
    totalCompleted: 0,
    totalPending: 0,
    totalRejected: 0
  });

  // Modals
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  
  // Forms
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [bankForm, setBankForm] = useState({
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    upiId: ''
  });

  useEffect(() => {
    fetchAllData();
  }, [activeTab]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBalance(),
        fetchBankAccounts(),
        fetchWithdrawals(),
        fetchStats()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await api.get('/profile');
      if (response.success) {
        setBalance(response.data.hostInfo?.totalEarnings || response.data.user?.coinBalance || 0);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const response = await api.get('/withdrawals/bank-accounts');
      if (response.success) {
        setBankAccounts(response.data.bankDetails || []);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const response = await api.get('/withdrawals/history');
      if (response.success) {
        setWithdrawals(response.data.withdrawals || []);
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/withdrawals/stats');
      if (response.success) {
        setStats(response.data.stats || {
          totalRequested: 0,
          totalCompleted: 0,
          totalPending: 0,
          totalRejected: 0
        });
        setBalance(response.data.currentBalance || 0);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseInt(balance);
    
    if (amount < 1000) {
      toast.error('Minimum withdrawal amount is 1000 diamonds');
      return;
    }
    
    if (amount > balance) {
      toast.error('Insufficient balance');
      return;
    }

    if (bankAccounts.length === 0) {
      toast.error('Please add a bank account first');
      setActiveTab('bank');
      setShowWithdrawModal(false);
      return;
    }

    try {
      const response = await api.post('/withdrawals/request', {
        amount,
        bankAccountId: selectedBankId || null
      });

      if (response.success) {
        toast.success('Withdrawal request submitted successfully!');
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        setSelectedBankId('');
        await fetchAllData();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit withdrawal request');
    }
  };

  const handleAddBankAccount = async () => {
    if (!bankForm.accountName || !bankForm.accountNumber || !bankForm.ifscCode || !bankForm.bankName) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const response = await api.post('/withdrawals/bank-accounts', bankForm);
      
      if (response.success) {
        toast.success('Bank account added successfully!');
        setShowBankModal(false);
        setBankForm({ accountName: '', accountNumber: '', ifscCode: '', bankName: '', upiId: '' });
        await fetchBankAccounts();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add bank account');
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;

    try {
      const response = await api.delete(`/withdrawals/bank-accounts/${accountId}`);
      
      if (response.success) {
        toast.success('Bank account deleted successfully');
        await fetchBankAccounts();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete bank account');
    }
  };

  const handleSetPrimary = async (accountId) => {
    try {
      const response = await api.patch(`/withdrawals/bank-accounts/${accountId}/primary`);
      
      if (response.success) {
        toast.success('Primary account updated');
        await fetchBankAccounts();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update primary account');
    }
  };

  const handleCancelWithdrawal = async (withdrawalId) => {
    if (!confirm('Cancel this withdrawal request? Diamonds will be refunded.')) return;

    try {
      const response = await api.post(`/withdrawals/${withdrawalId}/cancel`);
      
      if (response.success) {
        toast.success('Withdrawal cancelled and diamonds refunded');
        await fetchAllData();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel withdrawal');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <FiCheckCircle className="text-green-500" />;
      case 'pending': return <FiClock className="text-yellow-500" />;
      case 'rejected': return <FiXCircle className="text-red-500" />;
      case 'cancelled': return <FiAlertCircle className="text-gray-500" />;
      default: return <FiAlertCircle className="text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const StatCard = ({ icon: Icon, title, value, color }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );

  const OverviewTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-purple-100 text-sm mb-1">Available Balance</p>
            <div className="flex items-center space-x-2">
              <BiDiamond className="w-8 h-8" />
              <h2 className="text-4xl font-bold">{balance.toLocaleString()}</h2>
            </div>
            <p className="text-purple-100 text-sm mt-2">≈ ₹{balance.toLocaleString('en-IN')}</p>
          </div>
          <BiWallet className="w-16 h-16 opacity-20" />
        </div>
        
        <button
          onClick={() => {
            if (bankAccounts.length === 0) {
              toast.error('Please add a bank account first');
              setActiveTab('bank');
            } else if (balance < 1000) {
              toast.error('Minimum balance of 1000 diamonds required');
            } else {
              setShowWithdrawModal(true);
            }
          }}
          disabled={balance < 1000}
          className="w-full mt-4 bg-white text-purple-600 py-3 px-6 rounded-lg font-semibold hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {balance < 1000 ? 'Insufficient Balance (Min: 1000)' : 'Withdraw Diamonds'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={MdOutlineAttachMoney} title="Total Requested" value={`₹${stats.totalRequested.toLocaleString()}`} color="bg-blue-500" />
        <StatCard icon={FiCheckCircle} title="Completed" value={`₹${stats.totalCompleted.toLocaleString()}`} color="bg-green-500" />
        <StatCard icon={FiClock} title="Pending" value={`₹${stats.totalPending.toLocaleString()}`} color="bg-yellow-500" />
        <StatCard icon={FiXCircle} title="Rejected" value={`₹${stats.totalRejected.toLocaleString()}`} color="bg-red-500" />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <BiInfoCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Withdrawal Guidelines</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Minimum withdrawal: 1000 diamonds</li>
              <li>Processing: 2-5 business days</li>
              <li>Diamonds deducted immediately</li>
              <li>Rejected requests auto-refunded</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const HistoryTab = () => (
    <div className="space-y-4">
      {withdrawals.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <BiHistory className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No withdrawal history yet</p>
        </div>
      ) : (
        withdrawals.map(withdrawal => (
          <div key={withdrawal._id} className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  {getStatusIcon(withdrawal.status)}
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-lg">₹{withdrawal.amount.toLocaleString()}</h3>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(withdrawal.status)}`}>
                      {withdrawal.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{withdrawal.bankDetails?.bankName} • {withdrawal.bankDetails?.accountNumber}</p>
                  <p className="text-xs text-gray-500 mt-1">Requested: {new Date(withdrawal.createdAt).toLocaleDateString()}</p>
                  {withdrawal.processedAt && <p className="text-xs text-gray-500">Processed: {new Date(withdrawal.processedAt).toLocaleDateString()}</p>}
                  {withdrawal.transactionId && <p className="text-xs text-gray-500 font-mono">TXN: {withdrawal.transactionId}</p>}
                  {withdrawal.rejectionReason && <p className="text-xs text-red-600 mt-1">Reason: {withdrawal.rejectionReason}</p>}
                </div>
              </div>
              {withdrawal.status === 'pending' && (
                <button onClick={() => handleCancelWithdrawal(withdrawal._id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Cancel</button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const BankAccountsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Bank Accounts</h2>
        <button onClick={() => setShowBankModal(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2">
          <BiPlus className="w-5 h-5" />
          <span>Add Account</span>
        </button>
      </div>

      {bankAccounts.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <BanknoteIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 mb-4">No bank accounts yet</p>
          <button onClick={() => setShowBankModal(true)} className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700">
            Add Your First Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bankAccounts.map(account => (
            <div key={account._id} className="bg-white rounded-xl p-6 shadow-sm relative">
              {account.isPrimary && <span className="absolute top-4 right-4 bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">Primary</span>}
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <MdAccountBalance className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{account.bankName}</h3>
                  <p className="text-sm text-gray-600">{account.accountName}</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Account Number</span><span className="font-mono">{account.accountNumber}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">IFSC Code</span><span className="font-mono">{account.ifscCode}</span></div>
                {account.upiId && <div className="flex justify-between text-sm"><span className="text-gray-600">UPI ID</span><span className="font-mono">{account.upiId}</span></div>}
              </div>
              <div className="flex space-x-2">
                {!account.isPrimary && <button onClick={() => handleSetPrimary(account._id)} className="flex-1 bg-purple-50 text-purple-600 py-2 rounded-lg hover:bg-purple-100 text-sm font-medium">Set as Primary</button>}
                <button onClick={() => handleDeleteAccount(account._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><BiTrash className="w-5 h-5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white/80 backdrop-blur-lg border-b border-purple-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-purple-100 rounded-full"><FiChevronLeft className="w-6 h-6 text-purple-700" /></button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Withdrawals</h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex space-x-4 mb-6 border-b overflow-x-auto">
          {['overview', 'history', 'bank'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-4 px-4 font-medium whitespace-nowrap ${activeTab === tab ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-600 hover:text-gray-900'}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1).replace('bank', 'Bank Accounts')}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'bank' && <BankAccountsTab />}

        {showWithdrawModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Withdraw Diamonds</h3>
                <button onClick={() => setShowWithdrawModal(false)}><FiX className="w-6 h-6 text-gray-400 hover:text-gray-600" /></button>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-1">Available Balance</p>
                <div className="flex items-center space-x-2">
                  <BiDiamond className="w-6 h-6 text-purple-600" />
                  <span className="text-2xl font-bold text-purple-600">{balance.toLocaleString()}</span>
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (Min: 1000)</label>
                <input type="number" min={balance} max={balance} value={balance} className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500" />
                <p className="text-xs text-gray-500 mt-1">≈ ₹{(balance || 0).toLocaleString()}</p>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Withdraw To</label>
                <div className="bg-gray-50 rounded-lg p-4">
                  {bankAccounts?.length ? bankAccounts.map((acc) => (
                    <><p className="font-semibold">{acc.bankName}</p><p className="text-sm text-gray-600">{acc.accountNumber}</p></>
                  ))
                  
                  
                  
                  
                  
                  
                  : <p className="text-sm text-gray-600">No bank account</p>}
                </div>
              </div>
              <button onClick={handleWithdraw} disabled={!balance || parseInt(balance) < 1000  } className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold">Confirm</button>
            </div>
          </div>
        )}

        {showBankModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Add Bank Account</h3>
                <button onClick={() => setShowBankModal(false)}><FiX className="w-6 h-6 text-gray-400" /></button>
              </div>
              <div className="space-y-4">
                {['accountName', 'accountNumber', 'ifscCode', 'bankName', 'upiId'].map(field => (
                  <div key={field}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} {field !== 'upiId' && '*'}</label>
                    <input type="text" value={bankForm[field]} onChange={(e) => setBankForm({...bankForm, [field]: field === 'ifscCode' ? e.target.value.toUpperCase() : e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" placeholder={field === 'ifscCode' ? 'SBIN0001234' : field === 'upiId' ? 'username@bank' : ''} />
                  </div>
                ))}
                <button onClick={handleAddBankAccount} className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-semibold">Add Account</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HostWithdrawalUI;