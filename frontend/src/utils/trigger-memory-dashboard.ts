/**
 * Utility to trigger memory dashboard initialization
 * This makes an HTTP request to ensure the controller is instantiated
 */

export async function triggerMemoryDashboard() {
  try {
    console.log('🔧 Triggering memory dashboard initialization...');
    
    const response = await fetch('http://localhost:3000/api/dashboard/metrics', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Memory dashboard initialized:', data);
      return true;
    } else {
      console.error('❌ Failed to initialize memory dashboard:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Error triggering memory dashboard:', error);
    return false;
  }
}