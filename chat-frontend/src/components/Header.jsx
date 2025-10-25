import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Coins, LogOut, User, Video } from 'lucide-react';

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    
      
        
          
            <>
           <p>VideoCall</p> 
          

          
            {user && (
              <>
                
                  
                  {user.name}
                

                
                  
                  {user.coinBalance || 0}
                

                {user.role === 'host' && (
                  
                    Dashboard
                  
                )}

                {user.role === 'admin' && (
                  
                    Admin
                  
                )}

                
                  
                  Logout
                
              </>
            )}
          
        </>
      
    
  );
};