import api from './api';

export const chatService = {
  // Get all conversations
  getConversations: async (params = {}) => {
    try {
      const response = await api.get('/messages/conversations', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  },

  // Get or create a conversation with a specific user
  getOrCreateConversation: async (userId) => {
    try {
      console.log('🔍 Getting conversation with user:', userId);
      const response = await api.get(`/messages/conversation/${userId}`);
      console.log('✅ Conversation response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  },

  // Get messages for a conversation
  getMessages: async (userId, params = {}) => {
    try {
      console.log('📥 Fetching messages for user:', userId);
      const response = await api.get(`/messages/${userId}/messages`, { params });
      console.log('✅ Messages response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  },

  // Send a text message
  sendMessage: async (recipientId, content, options = {}) => {
    try {
      console.log('📤 Sending message to:', recipientId);
      const response = await api.post('/messages/send', {
        recipientId,
        content,
        ...options
      });
      console.log('✅ Send message response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Send a media message
  sendMediaMessage: async (recipientId, file, options = {}) => {
    try {
      const formData = new FormData();
      formData.append('recipientId', recipientId);
      formData.append('file', file);
      
      if (options.replyTo) {
        formData.append('replyTo', options.replyTo);
      }
      if (options.callId) {
        formData.append('callId', options.callId);
      }

      const response = await api.post('/messages/send-media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error sending media message:', error);
      throw error;
    }
  },

  // Mark messages as read
  markAsRead: async (userId) => {
    try {
      console.log('✅ Marking messages as read for user:', userId);
      const response = await api.put(`/messages/read/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  },

  // Delete a message
  deleteMessage: async (messageId, deleteForEveryone = false) => {
    try {
      const response = await api.delete(`/messages/${messageId}`, {
        data: { deleteForEveryone }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  },

  // Search messages
  searchMessages: async (query, userId = null) => {
    try {
      const params = { query };
      if (userId) {
        params.userId = userId;
      }
      const response = await api.get('/messages/search', { params });
      return response.data;
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  },

  // Get unread count
  getUnreadCount: async () => {
    try {
      const response = await api.get('/messages/unread-count');
      return response.data;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  }
};