import { useState, useEffect } from 'react';
import { ChevronLeft, Play, Square, Clock, Target, Award, TrendingUp, Calendar } from 'lucide-react';
import api from '../services/api';

export default function FreeTarget() {
  const [freeTarget, setFreeTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timerActive, setTimerActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    loadFreeTarget();
    const interval = setInterval(loadFreeTarget, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-running timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const loadFreeTarget = async () => {
    try {
      const response = await api.get('/free-target/my-target');
      const data = await response;
      if (data.success) {
        setFreeTarget(data.data.freeTarget);
        const todayTarget = getTodayTargetFromData(data.data.freeTarget);
        setTimerActive(todayTarget?.isTimerActive || false);
        setCurrentTime(todayTarget?.totalCallDuration || 0);
        setElapsedTime(0); // Reset elapsed time on data refresh
      }
    } catch (error) {
      console.error('Failed to load target:', error);
    } finally {
      setLoading(false);
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

  const todayTarget = getTodayTargetFromData(freeTarget);

  const handleStartTimer = async () => {
    try {
      const response = await fetch('/api/free-target/start-timer', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setTimerActive(true);
        loadFreeTarget();
      }
    } catch (error) {
      console.error('Failed to start timer:', error);
    }
  };

  const handleStopTimer = async () => {
    try {
      const response = await fetch('/api/free-target/stop-timer', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setTimerActive(false);
        loadFreeTarget();
      }
    } catch (error) {
      console.error('Failed to stop timer:', error);
    }
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

  const getStatusIcon = (day, daysLeftInWeek, targetDuration) => {
    // Check if this day should be marked as failed due to insufficient time
    const dayDate = new Date(day.date);
    dayDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Only apply auto-fail logic for future days
    if (dayDate > today && day.status === 'pending') {
      const dayIndex = freeTarget.currentWeek.days.findIndex(d => d.date === day.date);
      const todayIndex = freeTarget.currentWeek.days.findIndex(d => {
        const dDate = new Date(d.date);
        dDate.setHours(0, 0, 0, 0);
        return dDate.getTime() === today.getTime();
      });
      
      if (todayIndex !== -1 && dayIndex > todayIndex) {
        const daysUntilThisDay = dayIndex - todayIndex;
        const timeRemaining = (freeTarget.timeRemaining || 0);
        const hoursRemaining = timeRemaining / 3600;
        const hoursNeeded = daysUntilThisDay * (targetDuration / 3600);
        
        if (hoursRemaining < hoursNeeded) {
          return '❌';
        }
      }
    }
    
    if (day.adminOverride) {
      return day.status === 'completed' ? '✅' : '❌';
    }
    
    switch (day.status) {
      case 'completed':
        return '⭐';
      case 'failed':
        return '❌';
      case 'pending':
        return '⏳';
      default:
        return '○';
    }
  };

  const calculateProgress = () => {
    if (!freeTarget) return 0;
    const displayTime = currentTime + elapsedTime;
    const target = freeTarget.targetDuration || 28800;
    return Math.min((displayTime / target) * 100, 100);
  };

  const getDisplayTimeCompleted = () => {
    return currentTime + elapsedTime;
  };

  const getDisplayTimeRemaining = () => {
    const target = freeTarget?.targetDuration || 28800;
    const completed = getDisplayTimeCompleted();
    return Math.max(target - completed, 0);
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
            className="mt-4 px-6 py-2 bg-yellow-500 text-white rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const progress = calculateProgress();

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
          </div>
        </div>

        {/* Today's Progress Card */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl shadow-2xl p-6 border border-yellow-100">
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

          {/* Time Display */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200">
              <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Time Completed
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatTime(getDisplayTimeCompleted())}
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-4 border border-orange-200">
              <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Time Remaining
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {formatTime(getDisplayTimeRemaining())}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Progress</span>
              <span className="font-bold text-yellow-600">{progress.toFixed(0)}%</span>
            </div>
            <div className="relative w-full h-6 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 rounded-full transition-all duration-1000 ease-out shadow-lg"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
              </div>
              
              {/* Milestone markers */}
              {[25, 50, 75].map(milestone => (
                <div
                  key={milestone}
                  className="absolute top-0 w-0.5 h-full bg-white/50"
                  style={{ left: `${milestone}%` }}
                />
              ))}
            </div>
          </div>

          {/* Timer Control */}
          {/* {todayTarget?.status === 'pending' && (
            <div className="flex gap-3">
              {!timerActive ? (
                <button
                  onClick={handleStartTimer}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Play className="w-6 h-6" />
                  Start Timer
                </button>
              ) : (
                <button
                  onClick={handleStopTimer}
                  className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:from-red-600 hover:to-pink-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Square className="w-6 h-6" />
                  Stop Timer
                </button>
              )}
            </div>
          )} */}

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
                      : 'bg-gray-200'
                  }`}
                >
                  <div className={`text-xs font-bold mb-1 ${isToday || day.status !== 'pending' ? 'text-white' : 'text-gray-600'}`}>
                    {getDayLabel(day.date)}
                  </div>
                  <div className="text-2xl">
                    {getStatusIcon(day, freeTarget.daysLeftInWeek, freeTarget.targetDuration)}
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
              <span>Complete <strong>8 hours</strong> of calls each day to earn a star ⭐</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Maximum <strong>3 disconnects</strong> allowed in 10 minutes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Timer auto-runs to show real-time progress</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Days auto-marked as failed if insufficient time remains</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Admin can override any day's status if needed</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}