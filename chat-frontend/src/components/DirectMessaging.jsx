import { useState, useEffect, useRef } from 'react';
import { 
  Send, Image as ImageIcon, Smile, MoreVertical, 
  ArrowLeft, Phone, Video, Search, X, Reply, 
  Trash2, Copy, CheckCheck, Check 
} from 'lucide-react';
import { useChat } from '../hooks/useChat';
import toast from 'react-hot-toast';

export const DirectMessaging = ({ recipient, onBack, onStartCall }) => {
  const {
    messages,
    loading,
    hasMore,
    typing,
    sendMessage,
    sendMediaMessage,
    loadMore,
    startTyping,
    stopTyping,
    deleteMessage,
    reactToMessage,
    messagesEndRef
  } = useChat(recipient._id);

  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  const messageInputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  const userId = localStorage.getItem('userId');

  // Auto-focus input
  useEffect(() => {
    messageInputRef.current?.focus();
  }, []);

  // Handle scroll to load more
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop } = messagesContainerRef.current;
      if (scrollTop === 0 && hasMore && !loading) {
        loadMore();
      }
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageText.trim()) {
      sendMessage(messageText, replyingTo?._id);
      setMessageText('');
      setReplyingTo(null);
      stopTyping();
    }
  };

  const handleInputChange = (e) => {
    setMessageText(e.target.value);
    if (e.target.value.length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }

      await sendMediaMessage(file, replyingTo?._id);
      setReplyingTo(null);
    }
  };

  const handleDeleteMessage = async (message, deleteForEveryone = false) => {
    await deleteMessage(message._id, deleteForEveryone);
    setSelectedMessage(null);
    toast.success('Message deleted');
  };

  const handleReaction = (message, emoji) => {
    reactToMessage(message._id, emoji);
    setSelectedMessage(null);
  };

  const handleCopyMessage = (message) => {
    navigator.clipboard.writeText(message.content);
    toast.success('Message copied');
    setSelectedMessage(null);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date) => {
    const messageDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages.forEach(message => {
      const date = formatDate(message.createdAt);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    return groups;
  };

  const filteredMessages = searchQuery
    ? messages.filter(msg => 
        msg.messageType === 'text' && 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const groupedMessages = groupMessagesByDate(filteredMessages);

  const quickEmojis = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={recipient.avatar || '/default-avatar.png'}
                alt={recipient.name}
                className="w-10 h-10 rounded-full"
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{recipient.name}</h3>
              {typing && (
                <p className="text-xs text-green-500">typing...</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Search className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={() => onStartCall('audio')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Phone className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={() => onStartCall('video')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Video className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5"
              >
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {loading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        )}

        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date}>
            {/* Date Divider */}
            <div className="flex items-center justify-center my-4">
              <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                {date}
              </div>
            </div>

            {/* Messages */}
            {dateMessages.map((message) => {
              const isOwn = message.sender._id === userId || message.sender === userId;
              
              return (
                <div
                  key={message._id}
                  className={`flex mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Reply Preview */}
                    {message.replyTo && (
                      <div className={`mb-1 px-3 py-1 rounded-lg text-xs ${
                        isOwn ? 'bg-purple-100 text-purple-900' : 'bg-gray-200 text-gray-700'
                      }`}>
                        <Reply className="h-3 w-3 inline mr-1" />
                        {message.replyTo.content?.substring(0, 50)}
                        {message.replyTo.content?.length > 50 && '...'}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`group relative rounded-2xl px-4 py-2 ${
                        isOwn
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedMessage(message);
                      }}
                    >
                      {message.isDeleted ? (
                        <p className="text-sm italic opacity-70">
                          This message was deleted
                        </p>
                      ) : (
                        <>
                          {message.messageType === 'text' && (
                            <p className="text-sm break-words">{message.content}</p>
                          )}
                          
                          {message.messageType === 'image' && (
                            <img
                              src={message.mediaUrl}
                              alt="Shared image"
                              className="max-w-full rounded-lg"
                            />
                          )}
                          
                          {message.messageType === 'file' && (
                            <div className="flex items-center space-x-2">
                              <div className="bg-white/20 p-2 rounded">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {message.mediaMetadata?.fileName}
                                </p>
                                <p className="text-xs opacity-70">
                                  {(message.mediaMetadata?.fileSize / 1024).toFixed(2)} KB
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Reactions */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(
                            message.reactions.reduce((acc, r) => {
                              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([emoji, count]) => (
                            <span
                              key={emoji}
                              className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full"
                            >
                              {emoji} {count > 1 && count}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Time and Status */}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className={`text-xs ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
                          {formatTime(message.createdAt)}
                        </span>
                        {isOwn && !message.isDeleted && (
                          <span className={`text-xs ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
                            {message.status === 'read' ? (
                              <CheckCheck className="h-3 w-3 inline text-blue-300" />
                            ) : message.status === 'delivered' ? (
                              <CheckCheck className="h-3 w-3 inline" />
                            ) : (
                              <Check className="h-3 w-3 inline" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <button
                        onClick={() => setSelectedMessage(message)}
                        className={`absolute top-1 ${isOwn ? 'left-1' : 'right-1'} p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                          isOwn ? 'bg-purple-700' : 'bg-gray-200'
                        }`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Context Menu */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setSelectedMessage(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-2 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
            {/* Quick Reactions */}
            <div className="flex justify-around p-2 border-b border-gray-200">
              {quickEmojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(selectedMessage, emoji)}
                  className="text-2xl hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Actions */}
            <button
              onClick={() => {
                setReplyingTo(selectedMessage);
                setSelectedMessage(null);
                messageInputRef.current?.focus();
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <Reply className="h-5 w-5 text-gray-600" />
              <span className="text-gray-700">Reply</span>
            </button>

            {selectedMessage.messageType === 'text' && (
              <button
                onClick={() => handleCopyMessage(selectedMessage)}
                className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <Copy className="h-5 w-5 text-gray-600" />
                <span className="text-gray-700">Copy</span>
              </button>
            )}

            {(selectedMessage.sender._id === userId || selectedMessage.sender === userId) && (
              <>
                <button
                  onClick={() => handleDeleteMessage(selectedMessage, false)}
                  className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <Trash2 className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-700">Delete for me</span>
                </button>

                {/* Allow delete for everyone within 1 hour */}
                {new Date() - new Date(selectedMessage.createdAt) < 3600000 && (
                  <button
                    onClick={() => handleDeleteMessage(selectedMessage, true)}
                    className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors text-red-600"
                  >
                    <Trash2 className="h-5 w-5" />
                    <span>Delete for everyone</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Reply Preview */}
      {replyingTo && (
        <div className="bg-gray-100 px-4 py-2 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Reply className="h-4 w-4 text-purple-600" />
            <div>
              <p className="text-xs text-gray-500">Replying to</p>
              <p className="text-sm text-gray-900">
                {replyingTo.content?.substring(0, 50)}
                {replyingTo.content?.length > 50 && '...'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <form 
        onSubmit={handleSendMessage}
        className="bg-white border-t border-gray-200 px-4 py-3"
      >
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ImageIcon className="h-5 w-5 text-gray-600" />
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex-1 relative">
            <input
              ref={messageInputRef}
              type="text"
              value={messageText}
              onChange={handleInputChange}
              onBlur={stopTyping}
              placeholder="Type a message..."
              className="w-full bg-gray-100 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Smile className="h-5 w-5 text-gray-600" />
          </button>

          <button
            type="submit"
            disabled={!messageText.trim()}
            className="p-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors"
          >
            <Send className="h-5 w-5 text-white" />
          </button>
        </div>
      </form>
    </div>
  );
};