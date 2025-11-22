import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { coinService } from '../services/coinService';
import { callService } from '../services/callService';
import toast from 'react-hot-toast';
import { ChevronLeft, Coins } from 'lucide-react';

export const CoinPurchase = () => {
  const { user, updateUser } = useAuth();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [callHistory, setCallHistory] = useState([]);

  useEffect(() => {
    fetchPackages();
    fetchCallHistory();
    loadRazorpayScript();
  }, []);

  const loadRazorpayScript = () => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

  const fetchPackages = async () => {
    try {
      const response = await coinService.getPackages();
      setPackages(response.data);
    } catch (error) {
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const fetchCallHistory = async () => {
    try {
      const response = await callService.getHistory({ page: 1, limit: 10 });
      setCallHistory(response.data.calls);
    } catch (error) {
      console.error('Failed to load call history');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('en', { month: 'short' });
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} ${month}. ${year} ${time}`;
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `Tday ${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handlePurchase = async (pkg) => {
    setProcessing(true);

    try {
      const { data } = await coinService.createOrder(pkg.id);
      const { order, package: packageData } = data;

      const options = {
        key: "rzp_test_Rg6uxquiilZAWe", 
        amount: order.amount,
        currency: order.currency,
        name: 'VideoCall Platform',
        description: `${packageData.coins} Coins`,
        order_id: order.id,
        handler: async (response) => {
          try {
            await coinService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            toast.success(`Successfully purchased ${packageData.coins} coins!`);
            updateUser({ coinBalance: user.coinBalance + packageData.coins });
            setProcessing(false);
          } catch (error) {
            toast.error('Payment verification failed');
            setProcessing(false);
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone,
        },
        theme: {
          color: '#9333ea',
        },
        modal: {
          ondismiss: () => setProcessing(false),
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      toast.error('Failed to create order');
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-gray-700" onClick={() => window.history.back()} />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Get More {user?.role == 'host' ? 'Diamonds' : 'Coins'}</h1>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Coin Packages */}
        <div className="space-y-3 mb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">Loading packages...</p>
            </div>
          ) : packages.length > 0 ? (
            packages.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => !processing && handlePurchase(pkg)}
                className={`bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between transition-all border border-gray-100 ${
                  processing 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:shadow-md cursor-pointer'
                }`}
              >
                {/* Left Side - Coin Info */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-md">
                   {user?.role == 'host' ? <p className="text-lg text-purple-600">💎</p> :<Coins className="w-8 h-8" />}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">
                      {pkg.coins.toLocaleString()} {user?.role == 'host' ? 'diamonds' : 'coins'}
                    </p>
                    {pkg.discount > 0 && (
                      <p className="text-xs text-green font-medium">
                        Save {pkg.discount}%
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Side - Price */}
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900">
                    ${(pkg.price / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No packages available</p>
            </div>
          )}
        </div>

        {/* Processing Indicator */}
        {processing && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-6 flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
            <span className="text-purple-700 font-medium">Processing payment...</span>
          </div>
        )}

        {/* Video Chat History */}
        {callHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Video Chat History</h2>
            <div className="space-y-4">
              {callHistory.slice(0, 5).map((call) => (
                <div
                  key={call._id}
                  className="flex items-center gap-4 pb-4 border-b border-gray-100 last:border-0"
                >
                  {/* Host Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {call.hostId?.userId?.avatar ? (
                      <img
                        src={call.hostId.userId.avatar}
                        alt={call.hostId?.userId?.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      call.hostId?.userId?.name?.charAt(0)?.toUpperCase() || 'H'
                    )}
                  </div>

                  {/* Call Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">
                      {call.hostId?.userId?.name || 'Unknown Host'}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {formatDate(call.startTime)}
                    </p>
                  </div>

                  {/* Duration & Coins */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900">
                      {formatDuration(call.duration)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Used {call.coinsSpent} coins
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State for No History */}
        {callHistory.length === 0 && !loading && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Coins className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Call History</h3>
            <p className="text-gray-500 text-sm">
              Start calling hosts to see your history here
            </p>
          </div>
        )}
      </div>

      {/* Bottom Navigation Spacer */}
      <div className="h-20" />
    </div>
  );
};