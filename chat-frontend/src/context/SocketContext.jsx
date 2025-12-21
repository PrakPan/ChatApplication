import { createContext, useEffect, useState, useContext, useRef } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { isAuthenticated, user } = useContext(AuthContext);
  const socketRef = useRef(null);
  const isHostOnlineRef = useRef(false);
  const hasSetOnlineRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);

  // FIXED: Handle page lifecycle events
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('📱 Page hidden (backgrounded)');
        // Don't disconnect, just log
      } else {
        console.log('📱 Page visible (foregrounded)');
        // Reconnect if disconnected
        if (socketRef.current && !socketRef.current.connected) {
          console.log('🔄 Reconnecting socket after page became visible');
          socketRef.current.connect();
        }
      }
    };

    const handleBeforeUnload = (e) => {
      console.log('🚪 Page unloading (tab closing)');
      
      // Mark host offline if they are a host and currently online
      if (isHostOnlineRef.current && user?.role === 'host') {
        const token = localStorage.getItem('accessToken');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1';
        
        // Use synchronous XHR as a last resort (fetch won't complete in beforeunload)
        navigator.sendBeacon(`${apiUrl}/hosts/toggle-online`, JSON.stringify({
          forceOffline: true,
        }));
        
        console.log('✅ Sent offline beacon');
      }
      
      // Close socket
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('accessToken');
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5500';

      console.log('🔌 Connecting to socket:', socketUrl);
      
      const newSocket = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity, // Keep trying to reconnect
        timeout: 20000,
      });

      socketRef.current = newSocket;

      newSocket.on('connect', () => {
        console.log('✅ Socket connected:', newSocket.id);
        setConnected(true);
        
        // Authenticate socket with user ID
        if (user?._id) {
          newSocket.emit('authenticate', user._id);
          console.log('🔐 Authenticated socket with user ID:', user._id);
        }
        
        // Re-sync online status after reconnection
        if (hasSetOnlineRef.current && isHostOnlineRef.current) {
          console.log('🔄 Re-syncing host online status after reconnection');
          newSocket.emit('host:online', { userId: user._id });
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        setConnected(false);
        
        // Only mark as disconnected if it's not a intentional disconnect
        if (reason !== 'io client disconnect') {
          console.log('🔄 Will attempt to reconnect...');
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('🔴 Socket connection error:', error.message);
        setConnected(false);
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
        setConnected(true);
        
        // Re-authenticate after reconnection
        if (user?._id) {
          newSocket.emit('authenticate', user._id);
          console.log('🔐 Re-authenticated after reconnection');
        }
      });

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 Reconnection attempt', attemptNumber);
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('🔴 Socket reconnection error:', error.message);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('🔴 Socket reconnection failed after all attempts');
      });

      setSocket(newSocket);

      // Cleanup function
      return () => {
        console.log('🧹 Cleaning up socket connection');
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        newSocket.close();
      };
    } else {
      // User not authenticated
      if (socketRef.current) {
        console.log('🔓 User logged out, closing socket');
        socketRef.current.close();
        setSocket(null);
        setConnected(false);
        socketRef.current = null;
      }
    }
  }, [isAuthenticated, user?._id]);

  const setHostOnlineStatus = (isOnline) => {
    isHostOnlineRef.current = isOnline;
    hasSetOnlineRef.current = true;
    console.log('📊 Host online status updated:', isOnline);
    
    // Emit to server if socket is connected
    if (socketRef.current && connected && user?._id) {
      if (isOnline) {
        socketRef.current.emit('host:online', { userId: user._id });
        console.log('📤 Emitted host:online');
      } else {
        socketRef.current.emit('host:offline', { userId: user._id });
        console.log('📤 Emitted host:offline');
      }
    }
  };

  const emit = (event, data) => {
    if (socketRef.current && connected) {
      socketRef.current.emit(event, data);
      console.log('📤 Emitted:', event, data);
    } else {
      console.warn('⚠️ Cannot emit, socket not connected');
    }
  };

  const on = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event, callback) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    }
  };

  const value = {
    socket: socketRef.current,
    connected,
    emit,
    on,
    off,
    setHostOnlineStatus,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};