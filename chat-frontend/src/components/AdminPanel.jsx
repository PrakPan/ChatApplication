import React, { useState, useEffect } from "react";
import {
  FiSearch,
  FiPlus,
  FiTrash2,
  FiEye,
  FiUsers,
  FiTrendingUp,
  FiMenu,
  FiX,
  FiHome,
  FiUserCheck,
  FiAward,
  FiClock,
  FiStar,
  FiEdit,
  FiChevronDown,
  FiChevronRight,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
} from "react-icons/fi";
import { IoTrophyOutline } from "react-icons/io5";
import { MdOutlineAttachMoney, MdOutlinePhoneInTalk } from "react-icons/md";
import { BiCoin, BiDiamond, BiWallet } from "react-icons/bi";
import axios from "axios";
import { TbBan } from "react-icons/tb";
import { PhotoApprovalPanel } from "./PhotoApprovalPanel";
import { ImageIcon } from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5500/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  Authorization: `Bearer ${localStorage.getItem('accessToken')}`
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeSubTab, setActiveSubTab] = useState("list");
  const [hosts, setHosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [showDiamondModal, setShowDiamondModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalType, setModalType] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ users: [], hosts: [] });
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    totalHosts: 0,
    totalCalls: 0,
    totalRevenue: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  // Add to existing state declarations at the top
  const [pendingCount, setPendingCount] = useState(0);

  const [showFreeTargetModal, setShowFreeTargetModal] = useState(false);
const [selectedHostForTarget, setSelectedHostForTarget] = useState(null);
const [freeTargetOverrideDate, setFreeTargetOverrideDate] = useState('');
const [freeTargetOverrideStatus, setFreeTargetOverrideStatus] = useState('completed');
const [freeTargetOverrideNote, setFreeTargetOverrideNote] = useState('');


  // ADD these state declarations at the top with other existing states

  const [agents, setAgents] = useState([]);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentHosts, setAgentHosts] = useState([]);
  const [coinSellers, setCoinSellers] = useState([]);
  const [showCoinSellerModal, setShowCoinSellerModal] = useState(false);

  // Add after sortData function
  const fetchPendingCount = async () => {
    try {
      const { data } = await api.get("/admin/photos/pending");
      setPendingCount(data.data.total || 0);
    } catch (error) {
      console.error("Failed to fetch pending count:", error);
    }
  };

  useEffect(() => {
    loadData();
    if (activeTab === "photo-approvals") {
      fetchPendingCount();
    }
  }, [activeTab, activeSubTab, pagination.page, searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [activeTab, activeSubTab, pagination.page, searchTerm, sortBy, sortOrder]);

  const loadData = async () => {
  setLoading(true);
  try {
    if (activeTab === "dashboard") {
      const { data } = await api.get("/admin/dashboard/stats");
      setDashboardStats(data.data);
    } else if (activeTab === "hosts") {
      if (activeSubTab === "list") {
        const { data } = await api.get("/admin/hosts", {
          params: {
            page: pagination.page,
            limit: pagination.limit,
            search: searchTerm,
          },
        });
        let hostsData = data.data.hosts;
        hostsData = sortData(hostsData);
        setHosts(hostsData);
        setPagination((prev) => ({
          ...prev,
          total: data.data.pagination.total,
        }));
      } else if (activeSubTab === "leaderboard") {
        const { data } = await api.get("/admin/leaderboard", {
          params: { type: "host" },
        });
        setLeaderboard((prev) => ({ ...prev, hosts: data.data.hosts || [] }));
      } else if (activeSubTab === "history") {
        const { data } = await api.get("/admin/calls", {
          params: { page: pagination.page, limit: pagination.limit },
        });
        setCalls(data.data.calls.filter((call) => call.hostId));
      }
    } else if (activeTab === "users") {
      if (activeSubTab === "list") {
        const { data } = await api.get("/admin/users", {
          params: {
            page: pagination.page,
            limit: pagination.limit,
            search: searchTerm,
          },
        });
        let usersData = data.data.users;
        usersData = sortData(usersData);
        setUsers(usersData);
        setPagination((prev) => ({
          ...prev,
          total: data.data.pagination.total,
        }));
      } else if (activeSubTab === "leaderboard") {
        const { data } = await api.get("/admin/leaderboard", {
          params: { type: "user" },
        });
        setLeaderboard((prev) => ({ ...prev, users: data.data.users || [] }));
      } else if (activeSubTab === "history") {
        const { data } = await api.get("/admin/calls", {
          params: { page: pagination.page, limit: pagination.limit },
        });
        setCalls(data.data.calls.filter((call) => call.userId));
      }
    } else if (activeTab === "agents") {
      if (activeSubTab === "list") {
        const { data } = await api.get("/agents/all", {
          params: {
            page: pagination.page,
            limit: pagination.limit,
            isActive: true,
          },
        });
        let agentsData = data.data.agents;
        agentsData = sortData(agentsData);
        setAgents(agentsData);
        setPagination((prev) => ({
          ...prev,
          total: data.data.pagination.total,
        }));
      } else if (activeSubTab === "details" && selectedAgent) {
        const { data } = await api.get("/agents/hosts", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
          },
        });
        setAgentHosts(data.data.hosts || []);
      }
    } else if (activeTab === "coin-sellers") {
      const { data } = await api.get("/coin_sellers/all");
      setCoinSellers(data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: data.count || 0,
      }));
    }
  } catch (error) {
    console.error("Error loading data:", error);
    alert(error.response?.data?.message || error.response?.data?.error || "Failed to load data");
  } finally {
    setLoading(false);
  }
};

  const sortData = (data) => {
    return [...data].sort((a, b) => {
      let aVal =
        sortBy === "name" ? a.name || a.userId?.name || "" : a[sortBy] || 0;
      let bVal =
        sortBy === "name" ? b.name || b.userId?.name || "" : b[sortBy] || 0;

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const handleToggleCoinSeller = async (userId, isSeller) => {
    try {
      await api.patch(`/admin/users/${userId}/coin-seller`, {
        isCoinSeller: !isSeller,
      });
      alert(`User ${!isSeller ? "enabled" : "disabled"} as coin seller`);
      loadData();
    } catch (error) {
      alert(
        error.response?.data?.error || "Failed to update coin seller status"
      );
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
      await api.post(`/admin/users/${selectedUser._id}/add-diamonds`, {
        amount,
        reason,
      });
      alert("Diamonds added successfully!");
      setShowDiamondModal(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to add diamonds");
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
      const endpoint =
        selectedUser.type === "host"
          ? `/users/${selectedUser._id}/add-coins`
          : `/users/${selectedUser._id}/add-coins`;

      await api.post(endpoint, { amount, reason });
      alert("Coins added successfully!");
      setShowCoinModal(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to add coins");
    }
  };

  const handleSubmitLevel = async (e) => {
    e.preventDefault();
    const level = parseInt(e.target.level.value);

    try {
      const userId =
        selectedUser.type === "host"
          ? selectedUser.userId._id
          : selectedUser._id;
      await api.patch(`/admin/users/${userId}/level`, { level });
      alert("Level updated successfully!");
      setShowLevelModal(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to update level");
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
      level: parseInt(e.target.level.value),
    };

    if (modalType === "Host") {
      formData.ratePerMinute = parseInt(e.target.ratePerMinute.value);
      formData.bio = e.target.bio.value;
    }

    try {
      const endpoint = modalType === "Host" ? "/admin/hosts" : "/admin/users";
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
      await api.post(`/admin/hosts/${id}/suspend`, {
        reason: "Suspended by admin",
      });
      alert(`${type} suspended successfully`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to suspend");
    }
  };

  const handleDelete = async (id, type) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      const endpoint =
        type === "host" ? `/admin/hosts/${id}` : `/admin/users/${id}`;
      await api.delete(endpoint);
      alert(`${type} deleted successfully`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to delete");
    }
  };

  const handleViewCallHistory = async (id, type) => {
    try {
      const endpoint =
        type === "host" ? `/admin/calls/host/${id}` : `/admin/calls/user/${id}`;
      const { data } = await api.get(endpoint);
      setCalls(data.data.calls);
      setActiveSubTab("history");
    } catch (error) {
      alert("Failed to load call history");
    }
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // ADD these handler functions after existing handlers

  const handleAssignAgent = (user) => {
    setSelectedUser(user);
    setShowAgentModal(true);
  };

  const handleSubmitAgent = async (e) => {
    e.preventDefault();
    const commissionRate = parseInt(e.target.commissionRate.value);

    try {
      await api.post("/agents/assign", {
        userId: selectedUser._id,
        commissionRate,
      });
      alert("Agent assigned successfully!");
      setShowAgentModal(false);
      setSelectedUser(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to assign agent");
    }
  };

  const handleRemoveAgent = async (agentId) => {
    if (!confirm("Are you sure you want to remove this agent?")) return;

    try {
      await api.delete(`/agents/${agentId}`);
      alert("Agent removed successfully");
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to remove agent");
    }
  };

  const handleViewAgentDetails = async (agent) => {
    setSelectedAgent(agent);
    setActiveSubTab("details");

    // Load agent's hosts
    try {
      const { data } = await api.get("/agents/hosts", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
      });
      setAgentHosts(data.data.hosts || []);
    } catch (error) {
      console.error("Failed to load agent hosts:", error);
    }
  };

  const handleAddDiamondsToSeller = async (coinSellerId) => {
    const amount = prompt("Enter amount of diamonds to add:");
    if (!amount || isNaN(amount)) return;

    const reason = prompt("Enter reason (optional):");

    try {
      await api.post(`/coin_sellers/${coinSellerId}/add-diamonds`, {
        amount: parseInt(amount),
        reason,
      });
      alert("Diamonds added successfully!");
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Failed to add diamonds");
    }
  };


  const handleToggleHostFreeTarget = async (hostId, isEnabled) => {
  try {
    await api.patch(`/free-target/admin/${hostId}/toggle`, { isEnabled });
    alert(`Free target ${isEnabled ? 'enabled' : 'disabled'} for host`);
    loadData();
  } catch (error) {x
    alert(error.response?.data?.error || 'Failed to toggle free target');
  }
};

const handleOpenFreeTargetModal = (host) => {
  setSelectedHostForTarget(host);
  setShowFreeTargetModal(true);
  setFreeTargetOverrideDate('');
  setFreeTargetOverrideStatus('completed');
  setFreeTargetOverrideNote('');
};

const handleSubmitFreeTargetOverride = async (e) => {
  e.preventDefault();
  
  if (!freeTargetOverrideDate) {
    alert('Please select a date');
    return;
  }

  try {
    await api.patch(`/free-target/admin/${selectedHostForTarget._id}/override-day`, {
      date: freeTargetOverrideDate,
      status: freeTargetOverrideStatus,
      note: freeTargetOverrideNote
    });
    alert('Day status overridden successfully');
    setShowFreeTargetModal(false);
    loadData();
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to override day status');
  }
};


const FreeTargetModal = () => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl max-w-md w-full">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Override Day Status</h3>
          <button
            onClick={() => setShowFreeTargetModal(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-gray-600">Host</p>
          <p className="font-semibold text-gray-900">{selectedHostForTarget?.userId?.name}</p>
          <p className="text-sm text-gray-600">{selectedHostForTarget?.userId?.email}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date *
            </label>
            <input
              type="date"
              value={freeTargetOverrideDate}
              onChange={(e) => setFreeTargetOverrideDate(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status *
            </label>
            <select
              value={freeTargetOverrideStatus}
              onChange={(e) => setFreeTargetOverrideStatus(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            >
              <option value="completed">✅ Completed</option>
              <option value="failed">❌ Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin Note *
            </label>
            <textarea
              value={freeTargetOverrideNote}
              onChange={(e) => setFreeTargetOverrideNote(e.target.value)}
              placeholder="Reason for override..."
              rows="3"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
              required
            />
          </div>

          <button
            onClick={handleSubmitFreeTargetOverride}
            className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 text-white py-3 rounded-lg hover:from-yellow-700 hover:to-orange-700 transition-colors font-semibold"
          >
            Override Day Status
          </button>
        </div>
      </div>
    </div>
  </div>
);

  // ADD this Agent Modal component with other modals

  const AgentModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Assign as Agent</h3>
            <button
              onClick={() => setShowAgentModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <div className="mb-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-gray-600">User</p>
            <p className="font-semibold">{selectedUser?.name}</p>
            <p className="text-sm text-gray-600">{selectedUser?.email}</p>
            <p className="text-xs text-indigo-600 mt-2">
              🎯 Agents can link hosts and earn commission from their earnings
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmitAgent}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commission Rate (%)
              </label>
              <input
                name="commissionRate"
                type="number"
                required
                min="0"
                max="100"
                defaultValue="10"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter commission rate (0-100)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Default is 10% of total host earnings
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-colors"
            >
              Assign as Agent
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // ADD this Agents List Tab component

  const AgentsListTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Manage Agents</h2>
        <SortControls />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, email, or agent ID..."
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commission
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hosts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Earnings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agents.map((agent) => (
                <tr key={agent._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">
                        {agent.userId?.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {agent.userId?.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                      {agent.agentId}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-semibold text-purple-600">
                      {agent.commissionRate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FiUsers className="w-4 h-4 mr-1 text-blue-500" />
                      <span className="font-semibold">
                        {agent.hostCount || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-green-600 font-semibold">
                      ₹{agent.totalHostEarnings?.toLocaleString() || 0}
                      <div className="text-xs text-gray-500">
                        Commission: ₹
                        {agent.agentCommission?.toLocaleString() || 0}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        agent.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {agent.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewAgentDetails(agent)}
                        className="text-blue-600 hover:text-blue-800"
                        title="View Details"
                      >
                        <FiEye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleRemoveAgent(agent._id)}
                        className="text-red-600 hover:text-red-800"
                        title="Remove Agent"
                      >
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

      {agents.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FiUsers className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No agents found</p>
        </div>
      )}
    </div>
  );

  // ADD this Agent Details Tab component

  const AgentDetailsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            setActiveSubTab("list");
            setSelectedAgent(null);
            setAgentHosts([]);
          }}
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Back to Agents
        </button>
      </div>

      {/* Agent Header Card */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              {selectedAgent?.userId?.name}
            </h2>
            <p className="text-indigo-100">{selectedAgent?.userId?.email}</p>
            <div className="mt-4 inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur rounded-lg">
              <span className="text-sm mr-2">Agent ID:</span>
              <span className="font-mono font-bold text-lg">
                {selectedAgent?.agentId}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-indigo-100">Commission Rate</div>
            <div className="text-4xl font-bold">
              {selectedAgent?.commissionRate}%
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={FiUsers}
          title="Total Hosts"
          value={agentHosts.length}
          color="bg-blue-500"
        />
        <StatCard
          icon={MdOutlineAttachMoney}
          title="Host Earnings"
          value={`₹${selectedAgent?.totalHostEarnings?.toLocaleString() || 0}`}
          color="bg-green-500"
        />
        <StatCard
          icon={BiDiamond}
          title="Agent Commission"
          value={`₹${selectedAgent?.agentCommission?.toLocaleString() || 0}`}
          color="bg-purple-500"
        />
      </div>

      {/* Linked Hosts Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="text-lg font-bold">Linked Hosts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Host
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Calls
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Earnings
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agentHosts.map((host) => (
                <tr key={host._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">
                        {host.userId?.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {host.userId?.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MdOutlinePhoneInTalk className="w-4 h-4 mr-1 text-blue-500" />
                      <span className="font-semibold">
                        {host.totalCalls || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold text-green-600">
                      ₹{host.totalEarnings?.toLocaleString() || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FiStar className="w-4 h-4 mr-1 text-yellow-500 fill-current" />
                      <span className="font-semibold">
                        {host.rating?.toFixed(1) || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        host.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : host.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {host.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {agentHosts.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FiUsers className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No hosts linked to this agent yet</p>
        </div>
      )}
    </div>
  );

  // ADD this Coin Sellers Tab component

  const CoinSellersTab = () => {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAddDiamondsModal, setShowAddDiamondsModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [assignForm, setAssignForm] = useState({
    userId: '',
    initialDiamonds: '',
    notes: ''
  });
  const [diamondsForm, setDiamondsForm] = useState({
    amount: '',
    notes: ''
  });

  const handleAssignCoinSeller = async () => {
    if (!assignForm.userId) {
      alert('Please select a user');
      return;
    }

    try {
      await api.post('/coin_sellers/assign', {
        userId: assignForm.userId,
        initialDiamonds: parseInt(assignForm.initialDiamonds) || 0,
        notes: assignForm.notes
      });
      alert('Coin seller assigned successfully!');
      setShowAssignModal(false);
      setAssignForm({ userId: '', initialDiamonds: '', notes: '' });
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to assign coin seller');
    }
  };

  const handleAddDiamondsToSeller = async (seller) => {
    setSelectedSeller(seller);
    setShowAddDiamondsModal(true);
  };

  const handleSubmitAddDiamonds = async () => {
    if (!diamondsForm.amount || diamondsForm.amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await api.post(`/coin_sellers/${selectedSeller._id}/add-diamonds`, {
        amount: parseInt(diamondsForm.amount),
        notes: diamondsForm.notes
      });
      alert('Diamonds added successfully!');
      setShowAddDiamondsModal(false);
      setDiamondsForm({ amount: '', notes: '' });
      setSelectedSeller(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add diamonds');
    }
  };

  const handleRemoveCoinSeller = async (userId) => {
    if (!confirm('Are you sure you want to remove this coin seller?')) return;

    try {
      await api.delete(`/coin_sellers/${userId}`);
      alert('Coin seller removed successfully');
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to remove coin seller');
    }
  };

  const availableUsers = users.filter(u => !u.isCoinSeller);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Coin Sellers Management</h2>
          <p className="text-sm text-gray-600 mt-1">Manage diamond inventory and coin seller accounts</p>
        </div>
        <div className="flex items-center space-x-3">
          <SortControls />
          <button
            onClick={() => setShowAssignModal(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors flex items-center"
          >
            <FiPlus className="w-5 h-5 mr-2" />
            Assign Coin Seller
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, email, or user ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-50 to-blue-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Seller Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  User ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Diamond Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Total Allocated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Distributed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Withdrawn
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {coinSellers.map((seller) => (
                <tr key={seller._id} className="hover:bg-purple-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                        {seller.userId?.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {seller.userId?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {seller.userId?.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-lg">
                      {seller.userId?.userId}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <BiDiamond className="w-6 h-6 mr-2 text-purple-600 fill-current" />
                      <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                        {seller.diamondBalance?.toLocaleString() || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-gray-700">
                      <BiDiamond className="w-5 h-5 mr-1 text-gray-400" />
                      <span className="font-semibold">
                        {seller.totalDiamondsAllocated?.toLocaleString() || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-blue-600">
                      <FiTrendingUp className="w-4 h-4 mr-1" />
                      <span className="font-semibold">
                        {seller.totalDiamondsDistributed?.toLocaleString() || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-orange-600">
                      <MdOutlineAttachMoney className="w-5 h-5 mr-1" />
                      <span className="font-semibold">
                        {seller.totalDiamondsWithdrawn?.toLocaleString() || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        seller.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {seller.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleAddDiamondsToSeller(seller)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Add Diamonds"
                      >
                        <FiPlus className="w-5 h-5" />
                      </button>
                      <button
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Transactions"
                      >
                        <FiEye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleRemoveCoinSeller(seller.userId._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove Coin Seller"
                      >
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

      {coinSellers.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <BiDiamond className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg font-medium">No coin sellers found</p>
          <p className="text-gray-400 text-sm mt-2">Click "Assign Coin Seller" to add your first seller</p>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Assign Coin Seller</h3>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssignForm({ userId: '', initialDiamonds: '', notes: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-700 flex items-center">
                  <BiDiamond className="w-4 h-4 mr-2" />
                  Coin sellers can distribute diamonds (coins) to users and manage their inventory
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select User *
                  </label>
                  <select
                    value={assignForm.userId}
                    onChange={(e) => setAssignForm({...assignForm, userId: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Choose a user...</option>
                    {availableUsers.map(user => (
                      <option key={user._id} value={user._id}>
                        {user.name} ({user.userId}) - {user.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Diamonds (Optional)
                  </label>
                  <input
                    type="number"
                    value={assignForm.initialDiamonds}
                    onChange={(e) => setAssignForm({...assignForm, initialDiamonds: e.target.value})}
                    placeholder="Enter initial diamond allocation"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Starting inventory for the seller</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={assignForm.notes}
                    onChange={(e) => setAssignForm({...assignForm, notes: e.target.value})}
                    placeholder="Add any notes about this assignment..."
                    rows="3"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                <button
                  onClick={handleAssignCoinSeller}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors font-semibold"
                >
                  Assign as Coin Seller
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddDiamondsModal && selectedSeller && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Add Diamonds to Inventory</h3>
                <button
                  onClick={() => {
                    setShowAddDiamondsModal(false);
                    setDiamondsForm({ amount: '', notes: '' });
                    setSelectedSeller(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm text-gray-600">Coin Seller</p>
                    <p className="font-semibold text-gray-900">{selectedSeller.userId?.name}</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    {selectedSeller.userId?.name?.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-purple-200">
                  <span className="text-sm text-gray-600">Current Balance:</span>
                  <div className="flex items-center text-purple-600 font-bold">
                    <BiDiamond className="w-5 h-5 mr-1 fill-current" />
                    {selectedSeller.diamondBalance?.toLocaleString() || 0}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Diamond Amount *
                  </label>
                  <div className="relative">
                    <BiDiamond className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-500 w-5 h-5" />
                    <input
                      type="number"
                      value={diamondsForm.amount}
                      onChange={(e) => setDiamondsForm({...diamondsForm, amount: e.target.value})}
                      placeholder="Enter diamond amount"
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      min="1"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Amount to add to seller's inventory</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={diamondsForm.notes}
                    onChange={(e) => setDiamondsForm({...diamondsForm, notes: e.target.value})}
                    placeholder="Restock, bonus, promotion, etc."
                    rows="3"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                <button
                  onClick={handleSubmitAddDiamonds}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors font-semibold flex items-center justify-center"
                >
                  <FiPlus className="w-5 h-5 mr-2" />
                  Add Diamonds
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
        <div
          className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}
        >
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
            <button
              onClick={() => setShowAddModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmitAdd}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                name="name"
                type="text"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                name="phone"
                type="tel"
                required
                pattern="[0-9]{10}"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                minLength="8"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {modalType === "Host" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rate Per Minute (Coins)
                  </label>
                  <input
                    name="ratePerMinute"
                    type="number"
                    required
                    min="10"
                    defaultValue="50"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    name="bio"
                    rows="3"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  ></textarea>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Initial Level
              </label>
              <input
                name="level"
                type="number"
                required
                min="1"
                max="100"
                defaultValue="1"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
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
            <button
              onClick={() => setShowCoinModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">User</p>
            <p className="font-semibold">
              {selectedUser?.name || selectedUser?.userId?.name}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Current Balance:{" "}
              {selectedUser?.coinBalance || selectedUser?.totalEarnings || 0}{" "}
              coins
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmitCoins}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (Coins)
              </label>
              <input
                name="amount"
                type="number"
                required
                min="1"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <textarea
                name="reason"
                rows="2"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Bonus, Promotion, etc."
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
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
            <h3 className="text-xl font-bold">
              Add Diamonds (Seller Inventory)
            </h3>
            <button
              onClick={() => setShowDiamondModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
            <p className="text-sm text-gray-600">Coin Seller</p>
            <p className="font-semibold">{selectedUser?.name}</p>
            <p className="text-sm text-gray-600 mt-1">
              Current Diamonds: {selectedUser?.totalDiamonds || 0}
            </p>
            <p className="text-xs text-purple-600 mt-2">
              💎 Diamonds are used to sell coins to other users
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmitDiamonds}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (Diamonds)
              </label>
              <input
                name="amount"
                type="number"
                required
                min="1"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <textarea
                name="reason"
                rows="2"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Restock, Bonus, etc."
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors"
            >
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
            <button
              onClick={() => setShowLevelModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">User</p>
            <p className="font-semibold">
              {selectedUser?.name || selectedUser?.userId?.name}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Current Level: {selectedUser?.level || 1}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmitLevel}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Level (1-100)
              </label>
              <input
                name="level"
                type="number"
                required
                min="1"
                max="100"
                defaultValue={selectedUser?.level || 1}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed lg:sticky top-0 left-0 h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white w-64 transform transition-transform duration-300 z-50 overflow-y-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <FiX className="w-6 h-6" />
            </button>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => {
                setActiveTab("dashboard");
                setActiveSubTab("list");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === "dashboard"
                  ? "bg-white text-blue-900"
                  : "hover:bg-blue-700"
              }`}
            >
              <FiHome className="w-5 h-5" />
              <span>Dashboard</span>
            </button>

            {/* Hosts with submenu */}
            <div>
              <button
                onClick={() => {
                  if (expandedMenu === "hosts") {
                    setExpandedMenu(null);
                  } else {
                    setExpandedMenu("hosts");
                    setActiveTab("hosts");
                    setActiveSubTab("list");
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "hosts"
                    ? "bg-white text-blue-900"
                    : "hover:bg-blue-700"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FiUserCheck className="w-5 h-5" />
                  <span>Hosts</span>
                </div>
                {expandedMenu === "hosts" ? (
                  <FiChevronDown className="w-4 h-4" />
                ) : (
                  <FiChevronRight className="w-4 h-4" />
                )}
              </button>

              {expandedMenu === "hosts" && (
                <div className="ml-4 mt-2 space-y-1">
                  <button
                    onClick={() => {
                      setActiveSubTab("list");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === "list"
                        ? "bg-blue-700"
                        : "hover:bg-blue-700/50"
                    }`}
                  >
                    Host List
                  </button>
                  <button
                    onClick={() => {
                      setActiveSubTab("levels");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === "levels"
                        ? "bg-blue-700"
                        : "hover:bg-blue-700/50"
                    }`}
                  >
                    Levels
                  </button>

                  <button
                    onClick={() => {
                      setActiveSubTab("leaderboard");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === "leaderboard"
                        ? "bg-blue-700"
                        : "hover:bg-blue-700/50"
                    }`}
                  >
                    Leaderboard
                  </button>
                  <button
                    onClick={() => {
                      setActiveSubTab("history");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === "history"
                        ? "bg-blue-700"
                        : "hover:bg-blue-700/50"
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
                  if (expandedMenu === "users") {
                    setExpandedMenu(null);
                  } else {
                    setExpandedMenu("users");
                    setActiveTab("users");
                    setActiveSubTab("list");
                  }
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "users"
                    ? "bg-white text-blue-900"
                    : "hover:bg-blue-700"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FiUsers className="w-5 h-5" />
                  <span>Users</span>
                </div>
                {expandedMenu === "users" ? (
                  <FiChevronDown className="w-4 h-4" />
                ) : (
                  <FiChevronRight className="w-4 h-4" />
                )}
              </button>

              {expandedMenu === "users" && (
                <div className="ml-4 mt-2 space-y-1">
                  <button
                    onClick={() => {
                      setActiveSubTab("list");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === "list"
                        ? "bg-blue-700"
                        : "hover:bg-blue-700/50"
                    }`}
                  >
                    User List
                  </button>
                  <button
                    onClick={() => {
                      setActiveSubTab("levels");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === "levels"
                        ? "bg-blue-700"
                        : "hover:bg-blue-700/50"
                    }`}
                  >
                    Levels
                  </button>
                  <button
                    onClick={() => {
                      setActiveSubTab("leaderboard");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === "leaderboard"
                        ? "bg-blue-700"
                        : "hover:bg-blue-700/50"
                    }`}
                  >
                    Leaderboard
                  </button>
                  <button
                    onClick={() => {
                      setActiveSubTab("history");
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeSubTab === "history"
                        ? "bg-blue-700"
                        : "hover:bg-blue-700/50"
                    }`}
                  >
                    Call History
                  </button>
                </div>
              )}

              {/* Agents Section */}
              <div>
                <button
                  onClick={() => {
                    if (expandedMenu === "agents") {
                      setExpandedMenu(null);
                    } else {
                      setExpandedMenu("agents");
                      setActiveTab("agents");
                      setActiveSubTab("list");
                    }
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    activeTab === "agents"
                      ? "bg-white text-blue-900"
                      : "hover:bg-blue-700"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <FiAward className="w-5 h-5" />
                    <span>Agents</span>
                  </div>
                  {expandedMenu === "agents" ? (
                    <FiChevronDown className="w-4 h-4" />
                  ) : (
                    <FiChevronRight className="w-4 h-4" />
                  )}
                </button>

                {expandedMenu === "agents" && (
                  <div className="ml-4 mt-2 space-y-1">
                    <button
                      onClick={() => {
                        setActiveSubTab("list");
                        setSidebarOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                        activeSubTab === "list"
                          ? "bg-blue-700"
                          : "hover:bg-blue-700/50"
                      }`}
                    >
                      Agent List
                    </button>
                    {selectedAgent && activeSubTab === "details" && (
                      <button
                        onClick={() => {
                          setActiveSubTab("details");
                          setSidebarOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 rounded-lg text-sm bg-blue-700"
                      >
                        Agent Details
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Coin Sellers */}
              <button
                onClick={() => {
                  setActiveTab("coin-sellers");
                  setActiveSubTab("list");
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "coin-sellers"
                    ? "bg-white text-blue-900"
                    : "hover:bg-blue-700"
                }`}
              >
                <BiDiamond className="w-5 h-5" />
                <span>Coin Sellers</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab("photo-approvals");
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === "photo-approvals"
                    ? "bg-white text-blue-900"
                    : "hover:bg-blue-700"
                }`}
              >
                <ImageIcon className="w-5 h-5" />
                <span>Photo Approvals</span>
                {pendingCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white px-2 py-0.5 rounded-full text-xs min-w-6 flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </button>


              <button
  onClick={() => {
    setActiveTab('withdrawals');
    setSidebarOpen(false);
  }}
  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
    activeTab === 'withdrawals'
      ? 'bg-white text-blue-900'
      : 'hover:bg-blue-700'
  }`}
>
  <BiWallet className="w-5 h-5" />
  <span>Withdrawals</span>
</button>
            </div>
          </nav>
        </div>
      </div>
    </>
  );

  const DashboardTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={FiUsers}
          title="Total Users"
          value={dashboardStats.totalUsers.toLocaleString()}
          trend="+12% this month"
          color="bg-blue-500"
        />
        <StatCard
          icon={FiUserCheck}
          title="Total Hosts"
          value={dashboardStats.totalHosts}
          trend="+8% this month"
          color="bg-green-500"
        />
        <StatCard
          icon={MdOutlinePhoneInTalk}
          title="Total Calls"
          value={dashboardStats.totalCalls.toLocaleString()}
          trend="+23% this month"
          color="bg-purple-500"
        />
        <StatCard
          icon={MdOutlineAttachMoney}
          title="Total Revenue"
          value={`₹${dashboardStats.totalRevenue.toLocaleString()}`}
          trend="+18% this month"
          color="bg-orange-500"
        />
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
        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
        className="px-3 py-1 border rounded-lg text-sm hover:bg-gray-50"
      >
        {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
      </button>
    </div>
  );

  const HostGradeDropdown = ({ host, onGradeChange }) => {
  const [updating, setUpdating] = useState(false);
  
  const gradeInfo = {
    'D': { rate: 800, color: 'bg-gray-100 text-gray-800' },
    'C': { rate: 900, color: 'bg-blue-100 text-blue-800' },
    'B': { rate: 1100, color: 'bg-purple-100 text-purple-800' },
    'A': { rate: 1200, color: 'bg-yellow-100 text-yellow-800' }
  };

  const handleGradeChange = async (newGrade) => {
    if (newGrade === host.grade) return;
    
    if (!confirm(`Change host grade from ${host.grade} to ${newGrade}? Rate will change from ${host.ratePerMinute} to ${gradeInfo[newGrade].rate} coins/min.`)) {
      return;
    }

    setUpdating(true);
    try {
      await api.patch(`/admin/hosts/${host._id}/grade`, { grade: newGrade });
      alert(`Host grade updated to ${newGrade}`);
      onGradeChange();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update grade');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="relative">
      <select
        value={host.grade || 'D'}
        onChange={(e) => handleGradeChange(e.target.value)}
        disabled={updating}
        className={`px-3 py-1 text-sm font-semibold rounded-lg border-2 focus:ring-2 focus:ring-purple-500 ${gradeInfo[host.grade || 'D'].color}`}
      >
        <option value="D">Grade D (800/min)</option>
        <option value="C">Grade C (900/min)</option>
        <option value="B">Grade B (1100/min)</option>
        <option value="A">Grade A (1200/min)</option>
      </select>
      {updating && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

  const HostsListTab = () => {
    const [updatingStatus, setUpdatingStatus] = useState(null);
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [selectedHost, setSelectedHost] = useState(null);
    const [newStatus, setNewStatus] = useState("");
    const [reason, setReason] = useState("");

    const handleStatusChange = async (host, newStatus) => {
      // For rejections and suspensions, require a reason
      if (newStatus === "rejected" || newStatus === "suspended") {
        setSelectedHost(host);
        setNewStatus(newStatus);
        setShowReasonModal(true);
        return;
      }

      await updateHostStatus(host, newStatus);
    };

    const updateHostStatus = async (host, status, reason = "") => {
      setUpdatingStatus(host._id);
      try {
        await api.patch(`/admin/hosts/${host._id}/status`, {
          status,
          reason,
        });
        alert(`Host status updated to ${status}`);
        loadData();
      } catch (error) {
        alert(error.response?.data?.error || "Failed to update status");
      } finally {
        setUpdatingStatus(null);
      }
    };

    const handleConfirmStatusChange = async () => {
      if (
        (newStatus === "rejected" || newStatus === "suspended") &&
        !reason.trim()
      ) {
        alert("Please provide a reason for rejection or suspension");
        return;
      }

      await updateHostStatus(selectedHost, newStatus, reason);
      setShowReasonModal(false);
      setReason("");
      setSelectedHost(null);
      setNewStatus("");
    };

    const getStatusColor = (status) => {
      switch (status) {
        case "approved":
          return "bg-green-100 text-green-800";
        case "pending":
          return "bg-yellow-100 text-yellow-800";
        case "rejected":
          return "bg-red-100 text-red-800";
        case "suspended":
          return "bg-orange-100 text-orange-800";
        default:
          return "bg-gray-100 text-gray-800";
      }
    };

    const getStatusOptions = (currentStatus) => {
      const allStatuses = ["pending", "approved", "rejected", "suspended"];
      return allStatuses.filter((status) => status !== currentStatus);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold">Manage Hosts</h2>
          <div className="flex items-center space-x-3">
            <SortControls />
            <button
              onClick={() => handleAddNew("Host")}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Host
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Earnings
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
  Free Target
</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {hosts.map((host) => (
                  <tr key={host._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">
                          {host.userId?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {host.userId?.email}
                        </div>
                        {host.rejectionReason && host.status === "rejected" && (
                          <div className="text-xs text-red-600 mt-1">
                            Reason: {host.rejectionReason}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FiAward className="w-4 h-4 mr-1 text-yellow-500" />
                        <span className="font-semibold">{host.level || 1}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
  <HostGradeDropdown host={host} onGradeChange={loadData} />
  <div className="text-xs text-gray-500 mt-1 flex items-center">
    <BiCoin className="w-3 h-3 mr-1" />
    {host.ratePerMinute}/min
  </div>
</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-green-600">
                        ₹{host.totalEarnings?.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                            host.status
                          )}`}
                        >
                          {host.status}
                        </span>
                        <select
                          value=""
                          onChange={(e) =>
                            handleStatusChange(host, e.target.value)
                          }
                          disabled={updatingStatus === host._id}
                          className="text-xs border rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Change...</option>
                          {getStatusOptions(host.status).map((status) => (
                            <option key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </option>
                          ))}
                        </select>
                        {updatingStatus === host._id && (
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
    host.freeTargetEnabled ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
  }`}>
    {host.freeTargetEnabled ? 'Enabled' : 'Disabled'}
  </span>
</td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleAddCoins(host, "host")}
                          className="text-green-600 hover:text-green-800"
                          title="Add Coins"
                        >
                          <BiCoin className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEditLevel(host, "host")}
                          className="text-purple-600 hover:text-purple-800"
                          title="Edit Level"
                        >
                          <FiEdit className="w-5 h-5" />
                        </button>

                        <button
  onClick={() => handleToggleHostFreeTarget(host._id, !host.freeTargetEnabled)}
  className={`p-2 rounded-lg transition-colors ${
    host.freeTargetEnabled 
      ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100' 
      : 'text-gray-400 hover:bg-gray-100'
  }`}
  title={host.freeTargetEnabled ? 'Disable Free Target' : 'Enable Free Target'}
>
  <IoTrophyOutline className="w-5 h-5" />
</button>

{host.freeTargetEnabled && (
  <button
    onClick={() => handleOpenFreeTargetModal(host)}
    className="p-2 text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
    title="Override Day Status"
  >
    <FiEdit className="w-5 h-5" />
  </button>
)}

                        <button
                          onClick={() =>
                            handleViewCallHistory(host._id, "host")
                          }
                          className="text-blue-600 hover:text-blue-800"
                          title="View History"
                        >
                          <FiEye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(host._id, "host")}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
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

        {/* Reason Modal for Rejections/Suspensions */}
        {showReasonModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">
                    {newStatus === "rejected" ? "Reject Host" : "Suspend Host"}
                  </h3>
                  <button
                    onClick={() => {
                      setShowReasonModal(false);
                      setReason("");
                      setSelectedHost(null);
                      setNewStatus("");
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="w-6 h-6" />
                  </button>
                </div>

                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Host</p>
                  <p className="font-semibold">{selectedHost?.userId?.name}</p>
                  <p className="text-sm text-gray-600">
                    {selectedHost?.userId?.email}
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for{" "}
                    {newStatus === "rejected" ? "rejection" : "suspension"} *
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={`Enter reason for ${
                      newStatus === "rejected" ? "rejecting" : "suspending"
                    } this host...`}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows="4"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowReasonModal(false);
                      setReason("");
                      setSelectedHost(null);
                      setNewStatus("");
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmStatusChange}
                    disabled={!reason.trim()}
                    className={`flex-1 px-4 py-2 text-white rounded-lg font-semibold transition-colors ${
                      newStatus === "rejected"
                        ? "bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        : "bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                    }`}
                  >
                    {newStatus === "rejected" ? "Reject Host" : "Suspend Host"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const UsersListTab = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Manage Users</h2>
        <div className="flex items-center space-x-3">
          <SortControls />
          <button
            onClick={() => handleAddNew("User")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coins
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diamonds
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.name}
                      </div>
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
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {/* Agent Button */}
                      <button
                        onClick={() => handleAssignAgent(user)}
                        className={`p-2 rounded-lg transition-colors ${
                          user.isAgent
                            ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                            : "text-gray-400 hover:bg-gray-100"
                        }`}
                        title={
                          user.isAgent ? "Manage Agent" : "Assign as Agent"
                        }
                      >
                        <FiAward className="w-5 h-5" />
                      </button>

                      {/* Coin Seller Button */}
                      <button
                        onClick={() =>
                          handleToggleCoinSeller(user._id, user.isCoinSeller)
                        }
                        className={`p-2 rounded-lg transition-colors ${
                          user.isCoinSeller
                            ? "text-purple-600 bg-purple-50 hover:bg-purple-100"
                            : "text-gray-400 hover:bg-gray-100"
                        }`}
                        title={
                          user.isCoinSeller
                            ? "Disable Coin Seller"
                            : "Enable Coin Seller"
                        }
                      >
                        <BiDiamond className="w-5 h-5" />
                      </button>

                      {/* Add Diamonds (only for coin sellers) */}
                      {user.isCoinSeller && (
                        <button
                          onClick={() => handleAddDiamonds(user)}
                          className="text-purple-600 hover:text-purple-800"
                          title="Add Diamonds"
                        >
                          <BiDiamond className="w-5 h-5 fill-current" />
                        </button>
                      )}

                      {/* Add Coins */}
                      <button
                        onClick={() => handleAddCoins(user, "user")}
                        className="text-green-600 hover:text-green-800"
                        title="Add Coins"
                      >
                        <BiCoin className="w-5 h-5" />
                      </button>

                      {/* Edit Level */}
                      <button
                        onClick={() => handleEditLevel(user, "user")}
                        className="text-purple-600 hover:text-purple-800"
                        title="Edit Level"
                      >
                        <FiEdit className="w-5 h-5" />
                      </button>

                      {/* View History */}
                      <button
                        onClick={() => handleViewCallHistory(user._id, "user")}
                        className="text-blue-600 hover:text-blue-800"
                        title="View History"
                      >
                        <FiEye className="w-5 h-5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(user._id, "user")}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
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
    const currentData = activeTab === "hosts" ? hosts : users;
    const dataWithNames = currentData.map((item) => ({
      ...item,
      displayName: item.name || item.userId?.name || "",
      displayEmail: item.email || item.userId?.email || "",
    }));

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold">
            {activeTab === "hosts" ? "Host" : "User"} Levels
          </h2>
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
            .filter((item) =>
              item.displayName.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((item) => (
              <div
                key={item._id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {item.level || 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {item.displayName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.displayEmail}
                      </p>
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
                    onClick={() =>
                      handleEditLevel(
                        item,
                        activeTab === "hosts" ? "host" : "user"
                      )
                    }
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
    const currentLeaderboard =
      activeTab === "hosts" ? leaderboard.hosts : leaderboard.users;

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">
          Weekly {activeTab === "hosts" ? "Host" : "User"} Leaderboard
        </h2>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div
            className={`bg-gradient-to-r ${
              activeTab === "hosts"
                ? "from-green-600 to-green-700"
                : "from-blue-600 to-blue-700"
            } p-4`}
          >
            <h3 className="text-xl font-bold text-white flex items-center">
              <IoTrophyOutline className="w-6 h-6 mr-2" />
              Top {activeTab === "hosts" ? "Hosts" : "Users"} This Week
            </h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {currentLeaderboard.length > 0 ? (
                currentLeaderboard.map((item, i) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                          i === 0
                            ? "bg-yellow-500"
                            : i === 1
                            ? "bg-gray-400"
                            : i === 2
                            ? "bg-orange-600"
                            : "bg-gray-300"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {item.userId?.name || item.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Level {item.level || 1}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          activeTab === "hosts"
                            ? "text-green-600"
                            : "text-blue-600"
                        }`}
                      >
                        {formatDuration(item.totalCallDuration)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.totalCalls} calls
                      </p>
                    </div>
                  </div>
                ))
              ) : (
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
      <h2 className="text-2xl font-bold">
        {activeTab === "hosts" ? "Host" : "User"} Call History
      </h2>

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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Call ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Host
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Coins
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {calls.length > 0 ? (
                calls.map((call) => (
                  <tr key={call._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">
                      #{call._id.slice(-6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {call.userId?.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {call.hostId?.userId?.name}
                    </td>
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
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          call.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : call.status === "ongoing"
                            ? "bg-blue-100 text-blue-800"
                            : call.status === "cancelled"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {call.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(call.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-12 text-center text-gray-500"
                  >
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

const WithdrawalManagementTab = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [statusForm, setStatusForm] = useState({
    status: 'processing',
    transactionId: '',
    notes: '',
    rejectionReason: ''
  });
  const [filterStatus, setFilterStatus] = useState('pending');

  useEffect(() => {
    loadWithdrawals();
  }, [filterStatus]);

  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/withdrawals', {
        params: { status: filterStatus, page: 1, limit: 50 }
      });
      setWithdrawals(data.data.withdrawals);
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (statusForm.status === 'completed' && !statusForm.transactionId) {
      alert('Transaction ID is required for completed status');
      return;
    }

    if (statusForm.status === 'rejected' && !statusForm.rejectionReason) {
      alert('Rejection reason is required');
      return;
    }

    try {
      await api.patch(`/admin/withdrawals/${selectedWithdrawal._id}/status`, statusForm);
      alert(`Withdrawal status updated to ${statusForm.status}`);
      setShowStatusModal(false);
      setStatusForm({ status: 'processing', transactionId: '', notes: '', rejectionReason: '' });
      loadWithdrawals();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update status');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'failed': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <FiCheckCircle className="text-green-500" />;
      case 'pending': return <FiClock className="text-yellow-500" />;
      case 'processing': return <FiAlertCircle className="text-blue-500" />;
      case 'rejected': return <FiXCircle className="text-red-500" />;
      case 'failed': return <FiXCircle className="text-orange-500" />;
      default: return <FiAlertCircle className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Withdrawal Management</h2>
        
        <div className="flex items-center space-x-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Host</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {withdrawals.map((withdrawal) => (
                  <tr key={withdrawal._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">{withdrawal.hostId?.userId?.name}</div>
                        <div className="text-sm text-gray-500">{withdrawal.hostId?.userId?.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <BiDiamond className="w-5 h-5 mr-1 text-purple-600" />
                        <span className="font-bold text-lg">{withdrawal.amount.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-gray-500">≈ ₹{withdrawal.amount.toLocaleString('en-IN')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium">{withdrawal.bankDetails.bankName}</div>
                        <div className="text-gray-600">{withdrawal.bankDetails.accountName}</div>
                        <div className="text-gray-500 font-mono text-xs">{withdrawal.bankDetails.accountNumber}</div>
                        <div className="text-gray-500 text-xs">IFSC: {withdrawal.bankDetails.ifscCode}</div>
                        {withdrawal.bankDetails.upiId && (
                          <div className="text-gray-500 text-xs">UPI: {withdrawal.bankDetails.upiId}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2 mb-1">
                        {getStatusIcon(withdrawal.status)}
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(withdrawal.status)}`}>
                          {withdrawal.status}
                        </span>
                      </div>
                      {withdrawal.transactionId && (
                        <div className="text-xs text-gray-500 font-mono">TXN: {withdrawal.transactionId}</div>
                      )}
                      {withdrawal.rejectionReason && (
                        <div className="text-xs text-red-600 mt-1">{withdrawal.rejectionReason}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="text-gray-900">{new Date(withdrawal.createdAt).toLocaleDateString()}</div>
                      <div className="text-gray-500 text-xs">{new Date(withdrawal.createdAt).toLocaleTimeString()}</div>
                      {withdrawal.processedAt && (
                        <div className="text-green-600 text-xs mt-1">
                          Processed: {new Date(withdrawal.processedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(withdrawal.status === 'pending' || withdrawal.status === 'processing') ? (
                        <button
                          onClick={() => {
                            setSelectedWithdrawal(withdrawal);
                            setStatusForm({
                              status: withdrawal.status === 'pending' ? 'processing' : 'completed',
                              transactionId: '',
                              notes: '',
                              rejectionReason: ''
                            });
                            setShowStatusModal(true);
                          }}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                        >
                          Update Status
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500">
                          {withdrawal.status === 'completed' ? 'Completed' : withdrawal.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {withdrawals.length === 0 && (
            <div className="text-center py-12">
              <BiWallet className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No {filterStatus || 'pending'} withdrawals found</p>
            </div>
          )}
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Update Withdrawal Status</h3>
              <button onClick={() => setShowStatusModal(false)}>
                <FiX className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Host</span>
                <span className="font-semibold">{selectedWithdrawal.hostId?.userId?.name}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Amount</span>
                <div className="flex items-center">
                  <BiDiamond className="w-4 h-4 mr-1 text-purple-600" />
                  <span className="font-bold">{selectedWithdrawal.amount.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Current Status</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedWithdrawal.status)}`}>
                  {selectedWithdrawal.status}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Status *</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({...statusForm, status: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {statusForm.status === 'completed' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Transaction ID *</label>
                  <input
                    type="text"
                    value={statusForm.transactionId}
                    onChange={(e) => setStatusForm({...statusForm, transactionId: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter transaction ID"
                  />
                </div>
              )}

              {(statusForm.status === 'rejected' || statusForm.status === 'failed') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {statusForm.status === 'rejected' ? 'Rejection Reason *' : 'Failure Reason'}
                  </label>
                  <textarea
                    value={statusForm.rejectionReason}
                    onChange={(e) => setStatusForm({...statusForm, rejectionReason: e.target.value})}
                    rows="3"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Explain the reason..."
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    💎 Diamonds will be automatically refunded to host
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes (Optional)</label>
                <textarea
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({...statusForm, notes: e.target.value})}
                  rows="2"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Add any internal notes..."
                />
              </div>

              <button
                onClick={handleUpdateStatus}
                className={`w-full py-3 rounded-lg font-semibold text-white ${
                  statusForm.status === 'completed' ? 'bg-green-600 hover:bg-green-700' :
                  statusForm.status === 'processing' ? 'bg-blue-600 hover:bg-blue-700' :
                  'bg-red-600 hover:bg-red-700'
                }`}
              >
                Update to {statusForm.status}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <div className="lg:hidden bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600"
          >
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
              {activeTab === "dashboard" && <DashboardTab />}
              {activeTab === "hosts" && (
                <>
                  {activeSubTab === "list" && <HostsListTab />}
                  {activeSubTab === "levels" && <LevelsTab />}
                  {activeSubTab === "leaderboard" && <LeaderboardTab />}
                  {activeSubTab === "history" && <CallHistoryTab />}
                </>
              )}
              {activeTab === "users" && (
                <>
                  {activeSubTab === "list" && <UsersListTab />}
                  {activeSubTab === "levels" && <LevelsTab />}
                  {activeSubTab === "leaderboard" && <LeaderboardTab />}
                  {activeSubTab === "history" && <CallHistoryTab />}
                </>
              )}

              {activeTab === "agents" && (
                <>
                  {activeSubTab === "list" && <AgentsListTab />}
                  {activeSubTab === "details" && <AgentDetailsTab />}
                </>
              )}

              {activeTab === "coin-sellers" && <CoinSellersTab />}

              {activeTab === "photo-approvals" && <PhotoApprovalPanel />}

              {activeTab === 'withdrawals' && <WithdrawalManagementTab />}
            </>
          )}
        </div>
      </div>

      {showAddModal && <AddUserHostModal />}
      {showCoinModal && <CoinModal />}
      {showDiamondModal && <DiamondModal />}
      {showLevelModal && <LevelModal />}
      {showAgentModal && <AgentModal />}
      {showFreeTargetModal && <FreeTargetModal />}

      
    </div>
  );
};

export default AdminPanel;
