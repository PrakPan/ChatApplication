import React, { useState, useEffect } from 'react';
import { FiSearch, FiPlus, FiTrash2, FiEye, FiUsers, FiTrendingUp, FiMenu, FiX, FiHome, FiUserCheck, FiAward, FiClock, FiStar, FiEdit, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { IoTrophyOutline } from 'react-icons/io5';
import { MdOutlineAttachMoney, MdOutlinePhoneInTalk } from 'react-icons/md';
import { BiCoin, BiDiamond } from 'react-icons/bi';
import axios from 'axios';
import { TbBan } from "react-icons/tb";


const API_BASE_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5500/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSubTab, setActiveSubTab] = useState('list');
  const [hosts, setHosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [showDiamondModal, setShowDiamondModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalType, setModalType] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ users: [], hosts: [] });
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    totalHosts: 0,
    totalCalls: 0,
    totalRevenue: 0
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    loadData();
  }, [activeTab, activeSubTab, pagination.page, searchTerm, sortBy, sortOrder]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const { data } = await api.get('/admin/dashboard/stats');
        setDashboardStats(data.data);
      } else if (activeTab === 'hosts') {
        if (activeSubTab === 'list') {
          const { data } = await api.get('/admin/hosts', {
            params: { page: pagination.page, limit: pagination.limit, search: searchTerm }
          });
          let hostsData = data.data.hosts;
          hostsData = sortData(hostsData);
          setHosts(hostsData);
          setPagination(prev => ({ ...prev, total: data.data.pagination.total }));
        } else if (activeSubTab === 'leaderboard') {
          const { data } = await api.get('/admin/leaderboard', { params: { type: 'host' } });
          setLeaderboard(prev => ({ ...prev, hosts: data.data.hosts || [] }));
        } else if (activeSubTab === 'history') {
          const { data } = await api.get('/admin/calls', {
            params: { page: pagination.page, limit: pagination.limit }
          });
          setCalls(data.data.calls.filter(call => call.hostId));
        }
      } else if (activeTab === 'users') {
        if (activeSubTab === 'list') {
          const { data } = await api.get('/admin/users', {
            params: { page: pagination.page, limit: pagination.limit, search: searchTerm }
          });
          let usersData = data.data.users;
          usersData = sortData(usersData);
          setUsers(usersData);
          setPagination(prev => ({ ...prev, total: data.data.pagination.total }));
        } else if (activeSubTab === 'leaderboard') {
          const { data } = await api.get('/admin/leaderboard', { params: { type: 'user' } });
          setLeaderboard(prev => ({ ...prev, users: data.data.users || [] }));
        } else if (activeSubTab === 'history') {
          const { data } = await api.get('/admin/calls', {
            params: { page: pagination.page, limit: pagination.limit }
          });
          setCalls(data.data.calls.filter(call => call.userId));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert(error.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const sortData = (data) => {
    return [...data].sort((a, b) => {
      let aVal = sortBy === 'name' ? (a.name || a.userId?.name || '') : (a[sortBy] || 0);
      let bVal = sortBy === 'name' ? (b.name || b.userId?.name || '') : (b[sortBy] || 0);
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const handleToggleCoinSeller = async (userId, isSeller) => {
    try {
      await api.patch(`/admin/users/${userId}/coin-seller`, { isCoinSeller: !isSeller });
      alert(`User ${!isSeller ? 'enabled' : 'disabled'} as coin seller`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update coin seller status');
    }
  };

  const handleAddDiamonds = (user) => {
    setSelectedUser(user);
    setShowDiamondModal(true);
  };

  const handleSubmitDiamonds = async (e) => {
    e.preventDefault();
    const amount = parseInt(e.target.amount.value);
    const reason = e.target.reason.value;

    try {
      await api.post(`/admin/users/${selectedUser._id}/add-diamonds`, { amount, reason });
      alert('Diamonds added successfully!');
      setShowDiamondModal(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add diamonds');
    }
  };

  const handleAddCoins = (user, type) => {
    setSelectedUser({ ...user, type });
    setShowCoinModal(true);
  };

  const handleEditLevel = (user, type) => {
    setSelectedUser({ ...user, type });
    setShowLevelModal(true);
  };

  const handleSubmitCoins = async (e) => {
    e.preventDefault();
    const amount = parseInt(e.target.amount.value);
    const reason = e.target.reason.value;

    try {
      const endpoint = selectedUser.type === 'host' 
        ? `/admin/hosts/${selectedUser._id}/add-coins`
        : `/admin/users/${selectedUser._id}/add-coins`;
      
      await api.post(endpoint, { amount, reason });
      alert('Coins added successfully!');
      setShowCoinModal(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add coins');
    }
  };

  const handleSubmitLevel = async (e) => {
    e.preventDefault();
    const level = parseInt(e.target.level.value);

    try {
      const userId = selectedUser.type === 'host' ? selectedUser.userId._id : selectedUser._id;
      await api.patch(`/admin/users/${userId}/level`, { level });
      alert('Level updated successfully!');
      setShowLevelModal(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update level');
    }
  };

  const handleAddNew = (type) => {
    setModalType(type);
    setShowAddModal(true);
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    const formData = {
      name: e.target.name.value,
      email: e.target.email.value,
      phone: e.target.phone.value,
      password: e.target.password.value,
      level: parseInt(e.target.level.value)
    };

    if (modalType === 'Host') {
      formData.ratePerMinute = parseInt(e.target.ratePerMinute.value);
      formData.bio = e.target.bio.value;
    }

    try {
      const endpoint = modalType === 'Host' ? '/admin/hosts' : '/admin/users';
      await api.post(endpoint, formData);
      alert(`${modalType} created successfully!`);
      setShowAddModal(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || `Failed to create ${modalType}`);
    }
  };

  const handleSuspend = async (id, type) => {
    if (!confirm(`Are you sure you want to suspend this ${type}?`)) return;

    try {
      await api.post(`/admin/hosts/${id}/suspend`, { reason: 'Suspended by admin' });
      alert(`${type} suspended successfully`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to suspend');
    }
  };

  const handleDelete = async (id, type) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      const endpoint = type === 'host' ? `/admin/hosts/${id}` : `/admin/users/${id}`;
      await api.delete(endpoint);
      alert(`${type} deleted successfully`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete');
    }
  };

  const handleViewCallHistory = async (id, type) => {
    try {
      const endpoint = type === 'host' 
        ? `/admin/calls/host/${id}`
        : `/admin/calls/user/${id}`;
      const { data } = await api.get(endpoint);
      setCalls(data.data.calls);
      setActiveSubTab('history');
    } catch (error) {
      alert('Failed to load call history');
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const StatCard = ({ icon: Icon, title, value, trend, color }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          {trend && (
            <p className="text-sm text-green-600 mt-2 flex items-center">
              <FiTrendingUp className="w-4 h-4 mr-1" />
              {trend}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  const AddUserHostModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Add New {modalType}</h3>
            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
              <FiX className="w-6 h-6" />
            </button>
          </div>
          
          <form className="space-y-4" onSubmit={handleSubmitAdd}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input name="name" type="text" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input name="email" type="email" required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input name="phone" type="tel" required pattern="[0-9]{10}" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input name="password" type="password" required minLength="8" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            
            {modalType === 'Host' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rate Per Minute (Coins)</label>
                  <input name="ratePerMinute" type="number" required min="10" defaultValue="50" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                  <textarea name="bio" rows="3" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"></textarea>
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Initial Level</label>
              <input name="level" type="number" required min="1" max="100" defaultValue="1" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Add {modalType}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const CoinModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Add Coins</h3>
            <button onClick={() => setShowCoinModal(false)} className="text-gray-400 hover:text-gray-600">
              <FiX className="w-6 h-6" />
            </button>
          </div>
          
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">User</p>
            <p className="font-semibold">{selectedUser?.name || selectedUser?.userId?.name}</p>
            <p className="text-sm text-gray-600 mt-1">Current Balance: {selectedUser?.coinBalance || selectedUser?.totalEarnings || 0} coins</p>
          </div>
          
          <form className="space-y-4" onSubmit={handleSubmitCoins}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (Coins)</label>
              <input name="amount" type="number" required min="1" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Enter amount" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Optional)</label>
              <textarea name="reason" rows="2" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Bonus, Promotion, etc."></textarea>
            </div>
            
            <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors">
              Add Coins
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const DiamondModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Add Diamonds (Seller Inventory)</h3>
            <button onClick={() => setShowDiamondModal(false)} className="text-gray-400 hover:text-gray-600">
              <FiX className="w-6 h-6" />
            </button>
          </div>
          
          <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
            <p className="text-sm text-gray-600">Coin Seller</p>
            <p className="font-semibold">{selectedUser?.name}</p>
            <p className="text-sm text-gray-600 mt-1">Current Diamonds: {selectedUser?.totalDiamonds || 0}</p>
            <p className="text-xs text-purple-600 mt-2">💎 Diamonds are used to sell coins to other users</p>
          </div>
          
          <form className="space-y-4" onSubmit={handleSubmitDiamonds}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (Diamonds)</label>
              <input name="amount" type="number" required min="1" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" placeholder="Enter amount" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Optional)</label>
              <textarea name="reason" rows="2" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" placeholder="Restock, Bonus, etc."></textarea>
            </div>
            
            <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors">
              Add Diamonds
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const LevelModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Update Level</h3>
            <button onClick={() => setShowLevelModal(false)} className="text-gray-400 hover:text-gray-600">
              <FiX className="w-6 h-6" />
            </button>
          </div>
          
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">User</p>
            <p className="font-semibold">{selectedUser?.name || selectedUser?.userId?.name}</p>
            <p className="text-sm text-gray-600 mt-1">Current Level: {selectedUser?.level || 1}</p>
          </div>
          
          <form className="space-y-4" onSubmit={handleSubmitLevel}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Level (1-100)</label>
              <input name="level" type="number" required min="1" max="100" defaultValue={selectedUser?.level || 1} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            
            <button type="submit" className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors">
              Update Level
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const Sidebar = () => (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      <div className={`fixed lg:sticky top-0 left-0 h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white w-64 transform transition-transform duration-300 z-50 overflow-y-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <FiX className="w-6 h-6" />
            </button>
          </div>
          
          <nav className="space-y-2">
            <button
              onClick={() => { setActiveTab('dashboard'); setActiveSubTab('list'); setSidebarOpen(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'dashboard' ? 'bg-white text-blue-900' : 'hover:bg-blue-700'
              }`}
            >
              <FiHome className="w-5 h-5" />
              <span>Dashboard</span>
            </button>

            {/* Hosts with submenu */}
            <div>
              <button
                onClick={() => {
                  if (expandedMenu === 'hosts') {
                    setExpandedMenu(null);
                  } else {
                    setExpandedMenu('hosts');
                    setActiveTab('hosts');
                    setActiveSubTab('list');
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'hosts' ? 'bg-white text-blue-900' : 'hover:bg-blue-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FiUserCheck className="w-5 h-5" />
                  <span>Hosts</span>
                </div>
                {expandedMenu === 'hosts' ? <FiChevronDown className="w-4 h-4" /> : <FiChevronRight className="w-4 h-4" />}
              </button>
              
              {expandedMenu === 'hosts' && (
                <div className="ml-4 mt-2 space-y-1">
                  <button
                    onClick={() => { setActiveSubTab('list'); setSidebarOpen(false); }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === 'list' ? 'bg-blue-700' : 'hover:bg-blue-700/50'
                    }`}
                  >
                    Host List
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('levels'); setSidebarOpen(false); }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === 'levels' ? 'bg-blue-700' : 'hover:bg-blue-700/50'
                    }`}
                  >
                    Levels
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('leaderboard'); setSidebarOpen(false); }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === 'leaderboard' ? 'bg-blue-700' : 'hover:bg-blue-700/50'
                    }`}
                  >
                    Leaderboard
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('history'); setSidebarOpen(false); }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === 'history' ? 'bg-blue-700' : 'hover:bg-blue-700/50'
                    }`}
                  >
                    Call History
                  </button>
                </div>
              )}
            </div>

            {/* Users with submenu */}
            <div>
              <button
                onClick={() => {
                  if (expandedMenu === 'users') {
                    setExpandedMenu(null);
                  } else {
                    setExpandedMenu('users');
                    setActiveTab('users');
                    setActiveSubTab('list');
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                  activeTab === 'users' ? 'bg-white text-blue-900' : 'hover:bg-blue-700'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FiUsers className="w-5 h-5" />
                  <span>Users</span>
                </div>
                {expandedMenu === 'users' ? <FiChevronDown className="w-4 h-4" /> : <FiChevronRight className="w-4 h-4" />}
              </button>
              
              {expandedMenu === 'users' && (
                <div className="ml-4 mt-2 space-y-1">
                  <button
                    onClick={() => { setActiveSubTab('list'); setSidebarOpen(false); }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === 'list' ? 'bg-blue-700' : 'hover:bg-blue-700/50'
                    }`}
                  >
                    User List
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('levels'); setSidebarOpen(false); }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === 'levels' ? 'bg-blue-700' : 'hover:bg-blue-700/50'
                    }`}
                  >
                    Levels
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('leaderboard'); setSidebarOpen(false); }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === 'leaderboard' ? 'bg-blue-700' : 'hover:bg-blue-700/50'
                    }`}
                  >
                    Leaderboard
                  </button>
                  <button
                    onClick={() => { setActiveSubTab('history'); setSidebarOpen(false); }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === 'history' ? 'bg-blue-700' : 'hover:bg-blue-700/50'
                    }`}
                  >
                    Call History
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>
    </>
  );

  const DashboardTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={FiUsers} title="Total Users" value={dashboardStats.totalUsers.toLocaleString()} trend="+12% this month" color="bg-blue-500" />
        <StatCard icon={FiUserCheck} title="Total Hosts" value={dashboardStats.totalHosts} trend="+8% this month" color="bg-green-500" />
        <StatCard icon={MdOutlinePhoneInTalk} title="Total Calls" value={dashboardStats.totalCalls.toLocaleString()} trend="+23% this month" color="bg-purple-500" />
        <StatCard icon={MdOutlineAttachMoney} title="Total Revenue" value={`₹${dashboardStats.totalRevenue.toLocaleString()}`} trend="+18% this month" color="bg-orange-500" />
      </div>
    </div>
  );

  const SortControls = () => (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <label className="text-sm text-gray-600">Sort by:</label>
        <select 
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-1 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="name">Name</option>
          <option value="level">Level</option>
          <option value="coinBalance">Coins</option>
          <option value="createdAt">Date Joined</option>
        </select>
      </div>
      <button
        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        className="px-3 py-1 border rounded-lg text-sm hover:bg-gray-50"
      >
        {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
      </button>
    </div>
  );

  const HostsListTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Manage Hosts</h2>
        <div className="flex items-center space-x-3">
          <SortControls />
          <button onClick={() => handleAddNew('Host')} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
            <FiPlus className="w-5 h-5 mr-2" />
            Add Host
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Earnings</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {hosts.map(host => (
                <tr key={host._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">{host.userId?.name}</div>
                      <div className="text-sm text-gray-500">{host.userId?.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FiAward className="w-4 h-4 mr-1 text-yellow-500" />
                      <span className="font-semibold">{host.level || 1}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <BiCoin className="w-4 h-4 mr-1 text-yellow-600" />
                      {host.ratePerMinute}/min
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold text-green-600">₹{host.totalEarnings?.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      host.status === 'approved' ? 'bg-green-100 text-green-800' :
                      host.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {host.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleAddCoins(host, 'host')} className="text-green-600 hover:text-green-800" title="Add Coins">
                        <BiCoin className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleEditLevel(host, 'host')} className="text-purple-600 hover:text-purple-800" title="Edit Level">
                        <FiEdit className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleViewCallHistory(host._id, 'host')} className="text-blue-600 hover:text-blue-800" title="View History">
                        <FiEye className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleSuspend(host._id, 'host')} className="text-yellow-600 hover:text-yellow-800" title="Suspend">
                        <TbBan className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDelete(host._id, 'host')} className="text-red-600 hover:text-red-800" title="Delete">
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const UsersListTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Manage Users</h2>
        <div className="flex items-center space-x-3">
          <SortControls />
          <button onClick={() => handleAddNew('User')} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
            <FiPlus className="w-5 h-5 mr-2" />
            Add User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coins</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diamonds</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      {user.isCoinSeller && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                          <BiDiamond className="w-3 h-3 mr-1" />
                          Coin Seller
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FiAward className="w-4 h-4 mr-1 text-yellow-500" />
                      <span className="font-semibold">{user.level || 1}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-green-600 font-semibold">
                      <BiCoin className="w-5 h-5 mr-1" />
                      {user.coinBalance?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-purple-600 font-semibold">
                      <BiDiamond className="w-5 h-5 mr-1" />
                      {user.totalDiamonds?.toLocaleString() || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleToggleCoinSeller(user._id, user.isCoinSeller)}
                        className={`p-2 rounded-lg transition-colors ${
                          user.isCoinSeller ? 'text-purple-600 bg-purple-50 hover:bg-purple-100' : 'text-gray-400 hover:bg-gray-100'
                        }`}
                        title={user.isCoinSeller ? 'Disable Coin Seller' : 'Enable Coin Seller'}
                      >
                        <BiDiamond className="w-5 h-5" />
                      </button>
                      {user.isCoinSeller && (
                        <button onClick={() => handleAddDiamonds(user)} className="text-purple-600 hover:text-purple-800" title="Add Diamonds">
                          <BiDiamond className="w-5 h-5 fill-current" />
                        </button>
                      )}
                      <button onClick={() => handleAddCoins(user, 'user')} className="text-green-600 hover:text-green-800" title="Add Coins">
                        <BiCoin className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleEditLevel(user, 'user')} className="text-purple-600 hover:text-purple-800" title="Edit Level">
                        <FiEdit className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleViewCallHistory(user._id, 'user')} className="text-blue-600 hover:text-blue-800" title="View History">
                        <FiEye className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDelete(user._id, 'user')} className="text-red-600 hover:text-red-800" title="Delete">
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const LevelsTab = () => {
    const currentData = activeTab === 'hosts' ? hosts : users;
    const dataWithNames = currentData.map(item => ({
      ...item,
      displayName: item.name || item.userId?.name || '',
      displayEmail: item.email || item.userId?.email || ''
    }));

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold">{activeTab === 'hosts' ? 'Host' : 'User'} Levels</h2>
          <SortControls />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dataWithNames
            .filter(item => item.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
            .map(item => (
              <div key={item._id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {item.level || 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{item.displayName}</p>
                      <p className="text-xs text-gray-500">{item.displayEmail}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-semibold">{item.level || 1}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((item.level || 1) / 100) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-4">
                  <button 
                    onClick={() => handleEditLevel(item, activeTab === 'hosts' ? 'host' : 'user')}
                    className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center justify-center"
                  >
                    <FiEdit className="w-4 h-4 mr-1" />
                    Edit Level
                  </button>
                </div>
              </div>
            ))}
        </div>

        {dataWithNames.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <FiAward className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No {activeTab} found</p>
          </div>
        )}
      </div>
    );
  };

  const LeaderboardTab = () => {
    const currentLeaderboard = activeTab === 'hosts' ? leaderboard.hosts : leaderboard.users;
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Weekly {activeTab === 'hosts' ? 'Host' : 'User'} Leaderboard</h2>
        
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className={`bg-gradient-to-r ${activeTab === 'hosts' ? 'from-green-600 to-green-700' : 'from-blue-600 to-blue-700'} p-4`}>
            <h3 className="text-xl font-bold text-white flex items-center">
              <IoTrophyOutline className="w-6 h-6 mr-2" />
              Top {activeTab === 'hosts' ? 'Hosts' : 'Users'} This Week
            </h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {currentLeaderboard.length > 0 ? currentLeaderboard.map((item, i) => (
                <div key={item._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-600' : 'bg-gray-300'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{item.userId?.name || item.name}</p>
                      <p className="text-sm text-gray-600">Level {item.level || 1}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${activeTab === 'hosts' ? 'text-green-600' : 'text-blue-600'}`}>
                      {formatDuration(item.totalCallDuration)}
                    </p>
                    <p className="text-xs text-gray-500">{item.totalCalls} calls</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-500">
                  <IoTrophyOutline className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No data yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CallHistoryTab = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{activeTab === 'hosts' ? 'Host' : 'User'} Call History</h2>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by user, host, or call ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Host</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coins</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {calls.length > 0 ? calls.map(call => (
                <tr key={call._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">#{call._id.slice(-6)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{call.userId?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{call.hostId?.userId?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FiClock className="w-4 h-4 mr-1 text-gray-500" />
                      {formatDuration(call.duration)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-yellow-600 font-semibold">
                      <BiCoin className="w-5 h-5 mr-1" />
                      {call.coinsSpent}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      call.status === 'completed' ? 'bg-green-100 text-green-800' :
                      call.status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
                      call.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {call.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(call.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <MdOutlinePhoneInTalk className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No call history found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
            <FiMenu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <div className="w-6" />
        </div>

        <div className="flex-1 p-4 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <DashboardTab />}
              {activeTab === 'hosts' && (
                <>
                  {activeSubTab === 'list' && <HostsListTab />}
                  {activeSubTab === 'levels' && <LevelsTab />}
                  {activeSubTab === 'leaderboard' && <LeaderboardTab />}
                  {activeSubTab === 'history' && <CallHistoryTab />}
                </>
              )}
              {activeTab === 'users' && (
                <>
                  {activeSubTab === 'list' && <UsersListTab />}
                  {activeSubTab === 'levels' && <LevelsTab />}
                  {activeSubTab === 'leaderboard' && <LeaderboardTab />}
                  {activeSubTab === 'history' && <CallHistoryTab />}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showAddModal && <AddUserHostModal />}
      {showCoinModal && <CoinModal />}
      {showDiamondModal && <DiamondModal />}
      {showLevelModal && <LevelModal />}
    </div>
  );
};

export default AdminPanel;