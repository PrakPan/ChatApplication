import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Send, MoreVertical } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { chatService } from '../services/chatService';
import toast from 'react-hot-toast';

const MessagesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchConversations();
  }, []);

  // Handle opening specific chat from navigation state
  useEffect(() => {
    if (location.state?.openChatWithUserId) {
      handleOpenChatWithUser(location.state.openChatWithUserId);
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat:message', handleIncomingMessage);
    socket.on('chat:read', handleMessageRead);

    return () => {
      socket.off('chat:message');
      socket.off('chat:read');
    };
  }, [socket, selectedChat]);

  const fetchConversations = async () => {
    try {
      const response = await chatService.getConversations();
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChatWithUser = async (userId) => {
    try {
      // Check if this conversation already exists in our list
      const existingConv = conversations.find(
        conv => conv.userId._id === userId
      );

      if (existingConv) {
        // Conversation exists, just select it and fetch messages
        setSelectedChat(existingConv);
        fetchMessages(userId);
        return;
      }

      // New conversation - fetch user details and create empty conversation
      const response = await chatService.getOrCreateConversation(userId);
      
      if (response.data.success) {
        const conversationData = response.data.conversation;
        
        // Create new conversation object
        const newConversation = {
          userId: conversationData.participant,
          conversationId: conversationData.conversationId,
          lastMessage: null,
          unreadCount: 0
        };
        
        // Add to conversations list at the top
        setConversations(prev => [newConversation, ...prev]);
        
        // Select the chat
        setSelectedChat(newConversation);
        
        // Set empty messages (new conversation)
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to open chat:', error);
      toast.error('Failed to open conversation');
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const response = await chatService.getMessages(userId);
      setMessages(response.data.messages || []);
      
      // Mark as read
      await chatService.markAsRead(userId);
      
      // Update conversation unread count
      setConversations(prev =>
        prev.map(conv =>
          conv.userId._id === userId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      toast.error('Failed to load messages');
    }
  };

  const handleIncomingMessage = (message) => {
    if (selectedChat && message.senderId === selectedChat.userId._id) {
      setMessages(prev => [...prev, message]);
      chatService.markAsRead(message.senderId);
    }
    
    // Always refresh conversations to update the list
    fetchConversations();
  };

  const handleMessageRead = ({ userId }) => {
    if (selectedChat && userId === selectedChat.userId._id) {
      setMessages(prev =>
        prev.map(msg => ({ ...msg, isRead: true }))
      );
    }
  };

  const handleSelectChat = (conversation) => {
    setSelectedChat(conversation);
    fetchMessages(conversation.userId._id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    try {
      const response = await chatService.sendMessage(
        selectedChat.userId._id,
        newMessage.trim()
      );
      
      const sentMessage = response.data.message;
      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
      
      // Update the conversation's last message in the list
      setConversations(prev => {
        const updatedConvs = prev.map(conv => {
          if (conv.userId._id === selectedChat.userId._id) {
            return {
              ...conv,
              lastMessage: {
                message: sentMessage.content || sentMessage.message,
                createdAt: sentMessage.createdAt
              }
            };
          }
          return conv;
        });
        
        // Move this conversation to the top
        const selectedConvIndex = updatedConvs.findIndex(
          conv => conv.userId._id === selectedChat.userId._id
        );
        if (selectedConvIndex > 0) {
          const [selectedConv] = updatedConvs.splice(selectedConvIndex, 1);
          updatedConvs.unshift(selectedConv);
        }
        
        return updatedConvs;
      });
      
      // Emit socket event
      if (socket) {
        socket.emit('chat:send', {
          to: selectedChat.userId._id,
          message: sentMessage
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const msgDate = new Date(date);
    const diffInHours = (now - msgDate) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return msgDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (diffInHours < 168) {
      return msgDate.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return msgDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.userId?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1">Messages</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List */}
        <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-96 flex-col border-r bg-gray-50`}>
          {/* Search */}
          <div className="p-4 bg-white border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                <p className="text-lg font-medium">No messages yet</p>
                <p className="text-sm mt-2 text-center">
                  Start a conversation with a host
                </p>
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <button
                  key={conversation.userId._id}
                  onClick={() => handleSelectChat(conversation)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-gray-100 transition-colors border-b ${
                    selectedChat?.userId._id === conversation.userId._id
                      ? 'bg-purple-50'
                      : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={conversation.userId.avatar  || ' https://i.pravatar.cc/150?img=0'}
                      alt={conversation.userId.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    {conversation.userId.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {conversation.userId.name}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {conversation.lastMessage?.createdAt && formatTime(conversation.lastMessage.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 truncate">
                        {conversation.lastMessage?.message || 'Start chatting...'}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="flex-shrink-0 ml-2 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`${selectedChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-white`}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="md:hidden p-2 hover:bg-gray-100 rounded-full"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <img
                    src={selectedChat.userId.avatar || 'https://via.placeholder.com/40'}
                    alt={selectedChat.userId.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {selectedChat.userId.name}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {selectedChat.userId.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-full">
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Send className="w-12 h-12 mb-2 text-gray-300" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs text-gray-400 mt-1">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isOwn = message.senderId === user._id || message.sender?._id === user._id;
                    return (
                      <div
                        key={message._id || index}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            isOwn
                              ? 'bg-purple-600 text-white rounded-br-none'
                              : 'bg-gray-100 text-gray-900 rounded-bl-none'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.message || message.content}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              isOwn ? 'text-purple-200' : 'text-gray-500'
                            }`}
                          >
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t bg-gray-50">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-3 bg-white rounded-full border focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-500">
              <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Send className="w-12 h-12 text-purple-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Your Messages
              </h2>
              <p className="text-sm text-center max-w-sm">
                Send private messages to hosts and keep the conversation going
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;