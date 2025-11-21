import { allowedOrigins } from './allowedOrigins';
const scriptTag = document.currentScript as HTMLScriptElement | null;

let tk = scriptTag?.getAttribute("tk") || 'MwAKMDRPPjtoLsaJjfKdv9CUvaFHS6JJZFdCXDBd4salu76DiMuRqkcQdW9m8WE8YTeJn9XX4s6at7L0KDEmc1E9PQ..'
let parentOrigin = scriptTag?.getAttribute("parent-origin") || 'unknown'
// Custom Base64 obfuscator

// Function to fetch widget configuration
const fetchWidgetConfig = async () => {
  try {
    const response = await fetch(`https://theconnexus.ai/api/widgets/foundPhrase`, {
      headers: {
        'Content-Type': 'application/json',
        'x-widget-token': tk
      }
    });
    // console.log(response);
    if (!response.ok) {
      throw new Error('Failed to fetch widget configuration');
    }
    // console.log(response,'response.data')
    let data = await response.json();
    data.data.parentOrigin = parentOrigin;
    // data.data.parentOrigin = 'http://localhost:4000';
    return data;
  
  } catch (error) {
    console.error('Error fetching widget configuration:', error);
    // Return default configuration if fetch fails
    return {}
  }
};

// Initialize widget configuration
let widgetConfig: any = null;

// Function to initialize the configuration
export const initializeWidgetConfig = async () => {
  if (!widgetConfig) {
    widgetConfig = await fetchWidgetConfig();
  }
  return widgetConfig.data;
};

// Export the configuration getter
export const getWidgetConfig = () => {

  if (!widgetConfig) {
    throw new Error('Widget configuration not initialized.');
  }
  // console.log('widgetConfig',widgetConfig)
  return widgetConfig.data;
};
export const Key = '1b07e2d1-c19f-44de-a638-303e755e1477'

// Export allowed origins
export { allowedOrigins };