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

  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('accessToken');
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5500';
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5500/api/v1';

      const newSocket = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
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
      });

      newSocket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        setConnected(false);
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
        }
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('🔴 Socket reconnection error:', error.message);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('🔴 Socket reconnection failed after all attempts');
      });

      setSocket(newSocket);

      // Handle beforeunload - mark host offline when tab closes
      // const handleBeforeUnload = async (e) => {
      //   if (user?.role === 'host' && isHostOnlineRef.current) {
      //     const token = localStorage.getItem('accessToken');
      //     if (token) {
      //       const url = `${apiUrl}/hosts/toggle-online`;
      //       const data = JSON.stringify({ forceOffline: true });
            
      //       // Use sendBeacon for reliable request on page unload
      //       const blob = new Blob([data], { type: 'application/json' });
      //       navigator.sendBeacon(url, blob);
            
      //       // Fallback: try regular fetch with keepalive
      //       try {
      //         fetch(url, {
      //           method: 'PUT',
      //           headers: {
      //             'Authorization': `Bearer ${token}`,
      //             'Content-Type': 'application/json'
      //           },
      //           body: data,
      //           keepalive: true
      //         }).catch(() => {
      //           console.log('Fetch request failed, beacon sent');
      //         });
      //       } catch (err) {
      //         console.error('Error in beforeunload handler:', err);
      //       }
      //     }
      //   }
      // };

      // // Handle visibility change (optional - for additional tracking)
      // const handleVisibilityChange = () => {
      //   if (document.hidden) {
      //     console.log('📱 Tab hidden');
      //   } else {
      //     console.log('📱 Tab visible');
      //   }
      // };

      // window.addEventListener('beforeunload', handleBeforeUnload);
      // document.addEventListener('visibilitychange', handleVisibilityChange);

      // // Cleanup
      // return () => {
      //   console.log('🧹 Cleaning up socket connection');
      //   window.removeEventListener('beforeunload', handleBeforeUnload);
      //   document.removeEventListener('visibilitychange', handleVisibilityChange);
      //   newSocket.close();
      // };
    } else {
      // User not authenticated
      if (socket) {
        console.log('🔓 User logged out, closing socket');
        socket.close();
        setSocket(null);
        setConnected(false);
      }
    }
  }, [isAuthenticated, user]);


  // const setHostOnlineStatus = (isOnline) => {
  //   isHostOnlineRef.current = isOnline;
  //   console.log('📊 Host online status updated:', isOnline);
  // };


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
      socketRef.current.off(event, callback);
    }
  };

  const value = {
    socket,
    connected,
    emit,
    on,
    off,
    // setHostOnlineStatus 
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
