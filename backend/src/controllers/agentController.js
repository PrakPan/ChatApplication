const Agent = require('../models/Agent');
const User = require('../models/User');
const Host = require('../models/Host');
const Call = require('../models/Call');
const { ApiResponse, ApiError } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// Admin: Assign user as agent
const assignAgent = asyncHandler(async (req, res) => {
  const { userId, commissionRate = 10 } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Check if already an agent
  const existingAgent = await Agent.findOne({ userId });
  if (existingAgent) {
    throw new ApiError(400, 'User is already an agent');
  }

  // Create agent
  const agent = await Agent.create({
    userId,
    commissionRate,
    assignedBy: req.user._id
  });

  // Update user
  user.isAgent = true;
  await user.save();

  logger.info(`Agent assigned: ${userId}, Agent ID: ${agent.agentId}`);

  ApiResponse.success(res, 201, 'Agent assigned successfully', { agent });
});

// Admin: Remove agent
const removeAgent = asyncHandler(async (req, res) => {
  const { agentId } = req.params;

  const agent = await Agent.findById(agentId);
  if (!agent) {
    throw new ApiError(404, 'Agent not found');
  }

  agent.isActive = false;
  await agent.save();

  const user = await User.findById(agent.userId);
  if (user) {
    user.isAgent = false;
    await user.save();
  }

  logger.info(`Agent removed: ${agentId}`);

  ApiResponse.success(res, 200, 'Agent removed successfully');
});

// Admin: Get all agents
const getAllAgents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isActive } = req.query;

  const query = {};
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const agents = await Agent.find(query)
    .populate('userId', 'name email phone avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Get host count and earnings for each agent
  const agentsWithStats = await Promise.all(
    agents.map(async (agent) => {
      const stats = await agent.calculateTotalEarnings ? 
        await Agent.findById(agent._id).then(a => a.calculateTotalEarnings()) :
        { totalHostEarnings: 0, agentCommission: 0, hostCount: 0 };
      
      return {
        ...agent,
        ...stats
      };
    })
  );

  const total = await Agent.countDocuments(query);

  ApiResponse.success(res, 200, 'Agents retrieved', {
    agents: agentsWithStats,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Host: Link to agent using agent ID
const linkToAgent = asyncHandler(async (req, res) => {
  const { agentId } = req.body;

  // Get host profile
  const host = await Host.findOne({ userId: req.user._id });
  if (!host) {
    throw new ApiError(404, 'Host profile not found');
  }

  // Check if already linked
  if (host.agentId) {
    throw new ApiError(400, 'Already linked to an agent. Contact support to change.');
  }

  // Find agent
  const agent = await Agent.findOne({ agentId: agentId.toUpperCase(), isActive: true });
  if (!agent) {
    throw new ApiError(404, 'Agent not found or inactive');
  }

  // Link host to agent
  host.agentId = agent.agentId;
  await host.save();

  // Update agent host count
  agent.totalHosts += 1;
  await agent.save();

  logger.info(`Host ${req.user.email} linked to agent ${agent.agentId}`);

  ApiResponse.success(res, 200, 'Linked to agent successfully', {
    agentId: agent.agentId
  });
});

// Agent: Get dashboard
const getAgentDashboard = asyncHandler(async (req, res) => {
  const agent = await Agent.findOne({ userId: req.user._id });
  if (!agent) {
    throw new ApiError(404, 'Agent profile not found');
  }

  // Get linked hosts
  const hosts = await Host.find({ agentId: agent.agentId })
    .populate('userId', 'name email avatar')
    .select('totalEarnings totalCalls rating')
    .lean();

  // Calculate earnings
  const stats = await agent.calculateTotalEarnings();

  // Get recent activity
  const hostUserIds = hosts.map(h => h.userId._id);
  const recentCalls = await Call.find({
    hostId: { $in: hosts.map(h => h._id) },
    status: 'completed'
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('userId', 'name avatar')
    .populate({
      path: 'hostId',
      populate: { path: 'userId', select: 'name' }
    })
    .lean();

  ApiResponse.success(res, 200, 'Agent dashboard retrieved', {
    agentInfo: {
      agentId: agent.agentId,
      commissionRate: agent.commissionRate,
      totalHosts: hosts.length,
      ...stats
    },
    hosts,
    recentCalls
  });
});

// Agent: Get linked hosts
const getLinkedHosts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const agent = await Agent.findOne({ userId: req.user._id });
  if (!agent) {
    throw new ApiError(404, 'Agent profile not found');
  }

  const hosts = await Host.find({ agentId: agent.agentId })
    .populate('userId', 'name email phone avatar')
    .sort({ totalEarnings: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  const total = await Host.countDocuments({ agentId: agent.agentId });

  ApiResponse.success(res, 200, 'Linked hosts retrieved', {
    hosts,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    }
  });
});

// Agent: Get earnings breakdown
const getAgentEarnings = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const agent = await Agent.findOne({ userId: req.user._id });
  if (!agent) {
    throw new ApiError(404, 'Agent profile not found');
  }

  // Get all linked hosts
  const hosts = await Host.find({ agentId: agent.agentId }).select('_id userId totalEarnings');

  // Get calls in date range if specified
  const callQuery = {
    hostId: { $in: hosts.map(h => h._id) },
    status: 'completed'
  };

  if (startDate && endDate) {
    callQuery.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const calls = await Call.find(callQuery);

  // Calculate earnings
  const totalHostEarnings = calls.reduce((sum, call) => sum + (call.coinsSpent * 0.7), 0);
  const agentCommission = (totalHostEarnings * agent.commissionRate) / 100;

  // Group by host
  const earningsByHost = hosts.map(host => {
    const hostCalls = calls.filter(c => c.hostId.toString() === host._id.toString());
    const hostEarnings = hostCalls.reduce((sum, call) => sum + (call.coinsSpent * 0.7), 0);
    
    return {
      hostId: host._id,
      userId: host.userId,
      earnings: hostEarnings,
      callCount: hostCalls.length
    };
  });

  ApiResponse.success(res, 200, 'Agent earnings retrieved', {
    totalHostEarnings,
    agentCommission,
    commissionRate: agent.commissionRate,
    earningsByHost
  });
});

module.exports = {
  // Admin
  assignAgent,
  removeAgent,
  getAllAgents,
  
  // Host
  linkToAgent,
  
  // Agent
  getAgentDashboard,
  getLinkedHosts,
  getAgentEarnings
};