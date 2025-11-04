import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { CoinPurchase } from './pages/CoinPurchase';
// import { CallHistory } from './pages/CallHistory';
import { HostDashboard } from './pages/HostDashboard';
import { useAuth } from './hooks/useAuth';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#363636',
                color: '#fff',
                borderRadius: '12px',
                padding: '12px 24px',
                fontSize: '14px',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
                style: {
                  background: '#10b981',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
                style: {
                  background: '#ef4444',
                },
              },
            }}
          />

          <AppRoutes />
          
        
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  const { user } = useAuth(); // ✅ now inside AuthProvider
  return (
     <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                 { user?.role == 'host'? <Home/> : <Home />}
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/coins"
              element={
                <ProtectedRoute>
                  <CoinPurchase />
                </ProtectedRoute>
              }
            />
            
            {/* <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <CallHistory />
                </ProtectedRoute>
              }
            /> */}

            <Route
              path="/balance"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/following"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <p className="text-gray-500">Messages - Coming Soon</p>
                  </div>
                </ProtectedRoute>
              }
            />

            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <p className="text-gray-500">Notifications - Coming Soon</p>
                  </div>
                </ProtectedRoute>
              }
            />
            
            {/* Host Routes */}
            <Route
              path="/host/dashboard"
              element={
                <ProtectedRoute allowedRoles={['host', 'admin']}>
                  <HostDashboard />
                </ProtectedRoute>
              }
            />

            {/* <Route
              path="/host/call-history"
              element={
                <ProtectedRoute allowedRoles={['host', 'admin']}>
                  <CallHistory />
                </ProtectedRoute>
              }
            /> */}

            <Route
              path="/host/earnings"
              element={
                <ProtectedRoute allowedRoles={['host', 'admin']}>
                  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <p className="text-gray-500">Earnings - Coming Soon</p>
                  </div>
                </ProtectedRoute>
              }
            />

            <Route
              path="/host/payouts"
              element={
                <ProtectedRoute allowedRoles={['host', 'admin']}>
                  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <p className="text-gray-500">Payouts - Coming Soon</p>
                  </div>
                </ProtectedRoute>
              }
            />

            <Route
              path="/host/settings"
              element={
                <ProtectedRoute allowedRoles={['host', 'admin']}>
                  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <p className="text-gray-500">Settings - Coming Soon</p>
                  </div>
                </ProtectedRoute>
              }
            />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
  );
}

export default App;