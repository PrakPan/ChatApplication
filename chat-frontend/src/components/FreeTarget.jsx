import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, Clock, Target, Award, TrendingUp, Calendar, Gift, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function FreeTarget() {
  const [freeTarget, setFreeTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [isHostOnline, setIsHostOnline] = useState(false);
  const lastCompletionCheck = useRef(null);

  // Load target data
  const loadFreeTarget = useCallback(async () => {
    try {
      const response = await api.get('/free-target/my-target');
      if (response.success) {
        const data = response.data.freeTarget;
        setFreeTarget(data);
        
        // Initialize times from API
        setCurrentTime(data.timeCompleted || 0);
        setTimeRemaining(data.timeRemaining || 0);
        
        // Check if just completed
        const todayTarget = getTodayTargetFromData(data);
        if (todayTarget?.status === 'completed' && 
            lastCompletionCheck.current !== todayTarget.completedAt) {
          lastCompletionCheck.current = todayTarget.completedAt;
          setShowReward(true);
          setTimeout(() => setShowReward(false), 5000);
        }
      }
      
      // Also check host online status
      const profileResponse = await api.get('/auth/profile');
      if (profileResponse.success && profileResponse.data.hostProfile) {
        setIsHostOnline(profileResponse.data.hostProfile.isOnline);
      }
    } catch (error) {
      console.error('Failed to load target:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadFreeTarget();
  }, [loadFreeTarget]);

  // Refresh data every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadFreeTarget, 30000);
    return () => clearInterval(interval);
  }, [loadFreeTarget]);

  // Auto-increment timer (only when host is online)
  useEffect(() => {
    // Only run timer if free target exists
    if (!freeTarget) return;
    
    const timer = setInterval(() => {
      // Only increment if host is online
      if (isHostOnline) {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          
          // Check if target completed
          const targetDuration = freeTarget?.targetDuration || 28800;
          if (newTime >= targetDuration && timeRemaining > 0) {
            checkCompletion();
          }
          
          return newTime;
        });
        
        setTimeRemaining(prev => Math.max(0, prev - 1));
      } else {
        // Host is offline, just refresh data without incrementing
        loadFreeTarget();
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [freeTarget, isHostOnline, timeRemaining, loadFreeTarget]);

  // Check if target is completed
  const checkCompletion = async () => {
    try {
      const response = await api.post('/free-target/check-completion');
      if (response.success && response.data.todayTarget?.status === 'completed') {
        loadFreeTarget(); // Reload to get updated data
      }
    } catch (error) {
      console.error('Failed to check completion:', error);
    }
  };

  const getTodayTargetFromData = (targetData) => {
    if (!targetData?.currentWeek?.days) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return targetData.currentWeek.days.find(day => {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);
      return dayDate.getTime() === today.getTime();
    });
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getDayLabel = (date) => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return days[new Date(date).getDay()];
  };

  const getStatusIcon = (day) => {
    const dayDate = new Date(day.date);
    dayDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Show admin override status
    if (day.adminOverride) {
      return day.status === 'completed' ? '✅' : '❌';
    }
    
    // Show actual status
    switch (day.status) {
      case 'completed':
        return '⭐';
      case 'failed':
        return '❌';
      case 'pending':
        return dayDate.getTime() === today.getTime() ? '⏳' : '○';
      default:
        return '○';
    }
  };

  const calculateProgress = () => {
    if (!freeTarget) return 0;
    const target = freeTarget.targetDuration || 28800;
    return Math.min((currentTime / target) * 100, 100);
  };

  const todayTarget = getTodayTargetFromData(freeTarget);
  const progress = calculateProgress();

  // Reward Modal
  const RewardModal = () => {
    if (!showReward) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-white rounded-3xl p-8 max-w-md mx-4 text-center animate-bounce-in">
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-spin-slow">
            <Gift className="w-12 h-12 text-white" />
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            🎉 Congratulations! 🎉
          </h2>
          
          <p className="text-xl text-gray-700 mb-4">
            Daily Target Completed!
          </p>
          
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 mb-6">
            <p className="text-sm text-gray-600 mb-2">You've earned</p>
            <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-600">
              💎 1,00,000
            </p>
            <p className="text-sm text-gray-600 mt-2">Diamonds Added!</p>
          </div>
          
          <button
            onClick={() => setShowReward(false)}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3 rounded-xl font-semibold hover:from-yellow-600 hover:to-orange-600 transition-all"
          >
            Awesome!
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!freeTarget) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Target className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 text-lg">Free target not enabled</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-pink-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-yellow-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.history.back()}
              className="p-2 -ml-2 hover:bg-yellow-100 rounded-full transition-all duration-300"
            >
              <ChevronLeft className="w-6 h-6 text-yellow-700" />
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
              Free Target
            </h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 opacity-20 blur-3xl"></div>
          
          <div className="relative text-center py-8">
            <h2 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 mb-4 animate-pulse">
              Free Target
            </h2>
            <p className="text-gray-600 text-sm">Complete 8 hours daily to earn 1 Lakh diamonds</p>
          </div>
        </div>

        {/* Today's Progress Card */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-6 border border-yellow-100">
          {/* Offline Warning Banner */}
          {!isHostOnline && (
            <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-900">You are offline</p>
                <p className="text-xs text-orange-700 mt-1">
                  Timer is paused. Go online to start tracking your progress.
                </p>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-full font-semibold mb-4">
              <Target className="w-5 h-5" />
              <span>Today's Target</span>
            </div>
            
            {todayTarget && (
              <div className="mb-4">
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                  todayTarget.status === 'completed' ? 'bg-green-100 text-green-700' :
                  todayTarget.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {todayTarget.status === 'completed' && '🎉 Completed'}
                  {todayTarget.status === 'failed' && '❌ Failed'}
                  {todayTarget.status === 'pending' && '⏳ In Progress'}
                </span>
              </div>
            )}
          </div>

          {/* Real-time Time Display */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200 ${!isHostOnline ? 'opacity-60' : ''}`}>
              <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Online Time
                {!isHostOnline && <span className="text-xs text-orange-600 ml-1">(Paused)</span>}
              </div>
              <div className="text-2xl font-bold text-green-600 tabular-nums">
                {formatTime(currentTime)}
              </div>
            </div>

            <div className={`bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-4 border border-orange-200 ${!isHostOnline ? 'opacity-60' : ''}`}>
              <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Remaining
              </div>
              <div className="text-2xl font-bold text-orange-600 tabular-nums">
                {formatTime(timeRemaining)}
              </div>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">
                Progress {!isHostOnline && <span className="text-orange-600">(Timer Paused)</span>}
              </span>
              <span className="font-bold text-yellow-600">{progress.toFixed(1)}%</span>
            </div>
            <div className="relative w-full h-8 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div
                className={`absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 rounded-full transition-all duration-500 ease-out shadow-lg ${!isHostOnline ? 'opacity-50' : ''}`}
                style={{ width: `${progress}%` }}
              >
                {isHostOnline && <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>}
              </div>
              
              {/* Milestone markers */}
              {[25, 50, 75].map(milestone => (
                <div
                  key={milestone}
                  className="absolute top-0 w-0.5 h-full bg-white/60"
                  style={{ left: `${milestone}%` }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 font-medium">
                    {milestone}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {todayTarget?.adminOverride && (
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <p className="text-sm text-purple-700 font-semibold flex items-center gap-2">
                <Award className="w-4 h-4" />
                Admin Override: {todayTarget.adminNote}
              </p>
            </div>
          )}
        </div>

        {/* Weekly Progress */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-6 border border-yellow-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-2">
              <Calendar className="w-6 h-6 text-yellow-600" />
              Current Week
            </h3>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
              {freeTarget.daysLeftInWeek} Days Left
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {freeTarget.currentWeek?.days.map((day, index) => {
              const dayDate = new Date(day.date);
              dayDate.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isToday = dayDate.getTime() === today.getTime();
              const isPast = dayDate < today;
              
              return (
                <div
                  key={index}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center p-2 transition-all ${
                    isToday
                      ? 'bg-gradient-to-br from-yellow-400 to-orange-400 shadow-lg scale-110 border-2 border-white'
                      : day.status === 'completed'
                      ? 'bg-gradient-to-br from-green-400 to-emerald-400'
                      : day.status === 'failed'
                      ? 'bg-gradient-to-br from-red-400 to-pink-400'
                      : isPast
                      ? 'bg-gradient-to-br from-gray-300 to-gray-400'
                      : 'bg-gray-200'
                  }`}
                >
                  <div className={`text-xs font-bold mb-1 ${
                    isToday || day.status !== 'pending' || isPast ? 'text-white' : 'text-gray-600'
                  }`}>
                    {getDayLabel(day.date)}
                  </div>
                  <div className="text-2xl">
                    {getStatusIcon(day)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Week Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 text-center border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {freeTarget.currentWeek?.completedDays || 0}
              </div>
              <div className="text-xs text-gray-600">Completed</div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 text-center border border-purple-200">
              <div className="text-2xl font-bold text-purple-600">
                {freeTarget.totalWeeksCompleted || 0}
              </div>
              <div className="text-xs text-gray-600">Total Weeks</div>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-600">
                {Math.round((freeTarget.stats?.averageDailyDuration || 0) / 3600)}h
              </div>
              <div className="text-xs text-gray-600">Avg/Day</div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
          <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            How it works
          </h4>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Stay online for <strong>8 hours daily</strong> to earn ⭐ and <strong>1 Lakh diamonds</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Timer auto-runs based on your actual online time</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Past days before joining are auto-marked ❌</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Diamonds credited automatically upon completion</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Complete 7 days in a week to unlock bonus rewards</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Reward Modal */}
      <RewardModal />

      {/* Custom animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes shimmer {
          0% { background-position: -100% 0; }
          100% { background-position: 100% 0; }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        .animate-bounce-in {
          animation: bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}