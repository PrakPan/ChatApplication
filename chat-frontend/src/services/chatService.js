import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1';

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

export const chatService = {
  /**
   * Get all conversations for the logged-in user
   * @returns {Promise} Array of conversations
   */
  async getConversations() {
    try {
      const response = await axios.get(
        `${API_URL}/messages/conversations`,
        getAuthHeaders()
      );
      console.log('✅ Fetched conversations:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Error fetching conversations:', error);
      throw error;
    }
  },

  /**
   * Get or create a specific conversation with a user
   * @param {string} userId - The other user's ID
   * @returns {Promise} Conversation data
   */
  async getOrCreateConversation(userId) {
    try {
      const response = await axios.get(
        `${API_URL}/messages/conversation/${userId}`,
        getAuthHeaders()
      );
      console.log('✅ Got/created conversation:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Error getting conversation:', error);
      throw error;
    }
  },

  /**
   * Get messages for a specific conversation
   * @param {string} userId - The other user's ID
   * @param {Object} options - Pagination options
   * @returns {Promise} Array of messages
   */
  async getMessages(userId, options = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      const response = await axios.get(
        `${API_URL}/messages/${userId}/messages`,
        {
          ...getAuthHeaders(),
          params: { page, limit }
        }
      );
      console.log('✅ Fetched messages:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      throw error;
    }
  },

  /**
   * Send a text message
   * @param {string} recipientId - Recipient's user ID
   * @param {string} content - Message content
   * @param {Object} options - Additional options (replyTo, callId)
   * @returns {Promise} Sent message data
   */
  async sendMessage(recipientId, content, options = {}) {
    try {
      const { replyTo, callId } = options;
      const response = await axios.post(
        `${API_URL}/messages/send`,
        { 
          recipientId, 
          content,
          replyTo,
          callId
        },
        getAuthHeaders()
      );
      console.log('✅ Message sent:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  },

  /**
   * Send a media message (image/file)
   * @param {string} recipientId - Recipient's user ID
   * @param {File} file - File to send
   * @param {Object} options - Additional options (replyTo, callId)
   * @returns {Promise} Sent message data
   */
  async sendMediaMessage(recipientId, file, options = {}) {
    try {
      const { replyTo, callId } = options;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('recipientId', recipientId);
      if (replyTo) formData.append('replyTo', replyTo);
      if (callId) formData.append('callId', callId);

      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        `${API_URL}/messages/send-media`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      console.log('✅ Media message sent:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Error sending media message:', error);
      throw error;
    }
  },

  /**
   * Mark messages as read
   * @param {string} userId - The other user's ID
   * @returns {Promise} Success response
   */
  async markAsRead(userId) {
    try {
      const response = await axios.put(
        `${API_URL}/messages/read/${userId}`,
        {},
        getAuthHeaders()
      );
      console.log('✅ Messages marked as read');
      return response.data;
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
      throw error;
    }
  },

  /**
   * Delete a message
   * @param {string} messageId - Message ID to delete
   * @param {boolean} deleteForEveryone - Delete for both users (within 1 hour)
   * @returns {Promise} Success response
   */
  async deleteMessage(messageId, deleteForEveryone = false) {
    try {
      const response = await axios.delete(
        `${API_URL}/messages/${messageId}`,
        {
          ...getAuthHeaders(),
          data: { deleteForEveryone }
        }
      );
      console.log('✅ Message deleted');
      return response.data;
    } catch (error) {
      console.error('❌ Error deleting message:', error);
      throw error;
    }
  },

  /**
   * Search messages
   * @param {string} query - Search query
   * @param {string} userId - Optional: Search within specific conversation
   * @returns {Promise} Array of matching messages
   */
  async searchMessages(query, userId = null) {
    try {
      const params = { query };
      if (userId) params.userId = userId;

      const response = await axios.get(
        `${API_URL}/messages/search`,
        {
          ...getAuthHeaders(),
          params
        }
      );
      console.log('✅ Search results:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('❌ Error searching messages:', error);
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