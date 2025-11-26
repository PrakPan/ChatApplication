import api from './api';

export const chatService = {
  // Get all conversations
  getConversations: async () => {
    return api.get('/conversations');
  },

  // Get or create a conversation with a specific user
  getOrCreateConversation: async (userId) => {
    return api.get(`/conversation/${userId}`);
  },

  // Get messages for a specific conversation
  getMessages: async (userId, params = {}) => {
    return api.get(`/${userId}`, { params });
  },

  // Send a message
  sendMessage: async (recipientId, content, replyTo = null, callId = null) => {
    return api.post('/send', {
      recipientId,
      content,
      replyTo,
      callId
    });
  },

  // Send media message
  sendMediaMessage: async (recipientId, file, replyTo = null, callId = null) => {
    const formData = new FormData();
    formData.append('recipientId', recipientId);
    formData.append('file', file);
    if (replyTo) formData.append('replyTo', replyTo);
    if (callId) formData.append('callId', callId);

    return api.post('/send-media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // Mark messages as read
  markAsRead: async (userId) => {
    return api.put(`/read/${userId}`);
  },

  // Delete a message
  deleteMessage: async (messageId, deleteForEveryone = false) => {
    return api.delete(`/${messageId}`, {
      data: { deleteForEveryone }
    });
  },

  // Search messages
  searchMessages: async (query, userId = null) => {
    return api.get('/search', {
      params: { query, userId }
    });
  },

  // Get unread count
  getUnreadCount: async () => {
    return api.get('/unread-count');
  }
};