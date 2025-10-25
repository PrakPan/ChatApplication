import { Video, Star, DollarSign } from 'lucide-react';

export const HostCard = ({ host, onCall }) => {
  const user = host.userId;

  return (
    <>
      
        <img
          src={user.avatar || '/placeholder-avatar.png'}
          alt={user.name}
          className="w-full h-48 object-cover"
        />
      

      
        
          {user.name}
          {/* {host.isOnline && (
            
              
              Online
            
          )} */}
        

        {host.bio && (
          host.bio
        )}

        
          
            
            {host.rating.toFixed(1)}
          
          
            
            {host.ratePerMinute} coins/min
          
        

        {host.languages && host.languages.length > 0 && (
          
            host.languages.map((lang, idx) => (
              
                lang
              
            ))
          
        )}

        <button
          onClick={() => onCall(host)}
          disabled={!host.isOnline}
          className={`w-full flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-medium transition-colors ${
            host.isOnline
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          
          {host.isOnline ? 'Call Now' : 'Offline'}
        
      
    </button>
    </>
  );
};