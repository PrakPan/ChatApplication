import { useState, useEffect, useCallback, useContext, useRef } from 'react';

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { SocketContext } from '../context/SocketContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1';

export const useChat = (recipientId) => {
  const { socket, connected, emit, on, off } = useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typing, setTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Generate conversation ID
  useEffect(() => {
    if (recipientId) {
      // This should match backend logic
      const userId = localStorage.getItem('userId'); // Store this during login
      const ids = [userId, recipientId].sort();
      setConversationId(`${ids[0]}_${ids[1]}`);
    }
  }, [recipientId]);

  // Join conversation room when component mounts
  useEffect(() => {
    if (connected && recipientId) {
      emit('chat:join', { recipientId });

      return () => {
        emit('chat:leave', { recipientId });
      };
    }
  }, [connected, recipientId, emit]);


  useEffect(() => {
  if (!socket) return;

  const handleMessageRead = ({ messageIds }) => {
    console.log('📖 Messages marked as read:', messageIds);
    setMessages(prev =>
      prev.map(msg => 
        messageIds.includes(msg._id) 
          ? { ...msg, status: 'read' }
          : msg
      )
    );
  };

  socket.on('messages:read', handleMessageRead);

  return () => {
    socket.off('messages:read', handleMessageRead);
  };
}, [socket]);
  // Load initial messages


  useEffect(() => {
    if (recipientId) {
      loadMessages();
    }
  }, [recipientId]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Message sent confirmation
    const handleMessageSent = ({ tempId, message }) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.tempId === tempId 
            ? { ...message, status: 'sent' }
            : msg
        )
      );
    };





    // Receive new message
    const handleMessageReceive = ({ message, conversation }) => {
      if (message.sender._id === recipientId || message.sender === recipientId) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m._id === message._id)) {
            return prev;
          }
          return [...prev, message];
        });

        // Auto-mark as read if conversation is open
        if (conversation) {
          setTimeout(() => {
            markAsRead([message._id]);
          }, 500);
        }

        scrollToBottom();
      }
    };

    // Message delivered
    const handleMessageDelivered = ({ messageId }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg._id === messageId
            ? { ...msg, status: 'delivered' }
            : msg
        )
      );
    };

    // Messages delivered (bulk)
    const handleMessagesDelivered = ({ conversationId: convId }) => {
      if (convId === conversationId) {
        setMessages(prev =>
          prev.map(msg =>
            msg.status === 'sent'
              ? { ...msg, status: 'delivered' }
              : msg
          )
        );
      }
    };

    // Messages read
    const handleMessagesRead = ({ messageIds }) => {
      setMessages(prev =>
        prev.map(msg =>
          messageIds.includes(msg._id)
            ? { ...msg, status: 'read', readAt: new Date() }
            : msg
        )
      );
    };

    // Typing indicators
    const handleTypingStart = ({ conversationId: convId, userId }) => {
      if (convId === conversationId && userId === recipientId) {
        setTyping(true);
      }
    };

    const handleTypingStop = ({ conversationId: convId, userId }) => {
      if (convId === conversationId && userId === recipientId) {
        setTyping(false);
      }
    };

    // Message deleted
    const handleMessageDeleted = ({ messageId, deleteForEveryone }) => {
      if (deleteForEveryone) {
        setMessages(prev =>
          prev.map(msg =>
            msg._id === messageId
              ? { ...msg, isDeleted: true, content: 'This message was deleted' }
              : msg
          )
        );
      } else {
        setMessages(prev => prev.filter(msg => msg._id !== messageId));
      }
    };

    // Message reaction
    const handleMessageReaction = ({ messageId, reactions }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg._id === messageId
            ? { ...msg, reactions }
            : msg
        )
      );
    };

    // Error handling
    const handleMessageError = ({ message }) => {
      console.error('Message error:', message);
    };

    // Register listeners
    on('message:sent', handleMessageSent);
    on('message:receive', handleMessageReceive);
    on('message:delivered', handleMessageDelivered);
    on('messages:delivered', handleMessagesDelivered);
    on('messages:read', handleMessagesRead);
    on('typing:start', handleTypingStart);
    on('typing:stop', handleTypingStop);
    on('message:deleted', handleMessageDeleted);
    on('message:reaction', handleMessageReaction);
    on('message:error', handleMessageError);

    // Cleanup
    return () => {
      off('message:sent', handleMessageSent);
      off('message:receive', handleMessageReceive);
      off('message:delivered', handleMessageDelivered);
      off('messages:delivered', handleMessagesDelivered);
      off('messages:read', handleMessagesRead);
      off('typing:start', handleTypingStart);
      off('typing:stop', handleTypingStop);
      off('message:deleted', handleMessageDeleted);
      off('message:reaction', handleMessageReaction);
      off('message:error', handleMessageError);
    };
  }, [socket, recipientId, conversationId, on, off]);

  // Load messages from API
  const loadMessages = async (before = null) => {
    if (loading || !recipientId) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const params = { limit: 50 };
      if (before) params.before = before;

      const response = await axios.get(
        `${API_URL}/messages/${recipientId}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params
        }
      );

      const { messages: newMessages, pagination } = response.data;

      if (before) {
        setMessages(prev => [...newMessages, ...prev]);
      } else {
        setMessages(newMessages);
        // Mark messages as read
        const unreadMessageIds = newMessages
          .filter(msg => msg.recipient === localStorage.getItem('userId') && msg.status !== 'read')
          .map(msg => msg._id);
        
        if (unreadMessageIds.length > 0) {
          setTimeout(() => markAsRead(unreadMessageIds), 500);
        }
      }

      setHasMore(pagination.hasMore);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load more messages (pagination)
  const loadMore = useCallback(() => {
    if (messages.length > 0 && hasMore && !loading) {
      const oldestMessage = messages[0];
      loadMessages(oldestMessage.createdAt);
    }
  }, [messages, hasMore, loading]);

  // Send text message
  const sendMessage = useCallback((content, replyTo = null) => {
    if (!content.trim() || !connected) return;

    const tempId = uuidv4();
    const userId = localStorage.getItem('userId');

    // Optimistic UI update
    const optimisticMessage = {
      _id: tempId,
      tempId,
      conversationId,
      sender: {
        _id: userId,
        name: 'You'
      },
      recipient: recipientId,
      content,
      messageType: 'text',
      status: 'sending',
      createdAt: new Date(),
      replyTo
    };

    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();

    // Emit via socket
    emit('message:send', {
      recipientId,
      content,
      messageType: 'text',
      replyTo,
      tempId
    });
  }, [connected, recipientId, conversationId, emit]);

  // Send media message
  const sendMediaMessage = async (file, replyTo = null) => {
    try {
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('recipientId', recipientId);
      if (replyTo) formData.append('replyTo', replyTo);

      const response = await axios.post(
        `${API_URL}/messages/send/media`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const { message } = response.data;
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    } catch (error) {
      console.error('Error sending media:', error);
    }
  };

  // Mark messages as read
  const markAsRead = useCallback((messageIds) => {
    if (!connected || !messageIds.length) return;

    emit('messages:read', {
      recipientId,
      messageIds
    });
  }, [connected, recipientId, emit]);

  // Start typing indicator
  const startTyping = useCallback(() => {
    if (!connected) return;

    emit('typing:start', { recipientId });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [connected, recipientId, emit]);

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    if (!connected) return;

    emit('typing:stop', { recipientId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [connected, recipientId, emit]);

  // Delete message
  const deleteMessage = useCallback(async (messageId, deleteForEveryone = false) => {
    try {
      emit('message:delete', { messageId, deleteForEveryone });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }, [emit]);

  // React to message
  const reactToMessage = useCallback((messageId, emoji) => {
    if (!connected) return;

    emit('message:react', { messageId, emoji });
  }, [connected, emit]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return {
    messages,
    loading,
    hasMore,
    typing,
    conversationId,
    unreadCount,
    sendMessage,
    sendMediaMessage,
    loadMore,
    startTyping,
    stopTyping,
    deleteMessage,
    reactToMessage,
    markAsRead,
    messagesEndRef,
    scrollToBottom
  };
};