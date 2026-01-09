export const getDeviceId = () => {
  const DEVICE_ID_KEY = 'catlive_device_id';
  
  // Check if device ID exists in localStorage
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate new device ID
    const platform = navigator.platform || 'unknown';
    const userAgent = navigator.userAgent || 'unknown';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    
    // Create a unique device ID
    deviceId = `${platform}_${random}_${timestamp}`;
    
    // Store it in localStorage
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
};

export const clearDeviceId = () => {
  localStorage.removeItem('catlive_device_id');
};