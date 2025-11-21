function generateSourceIdFromURL(): string {
    const url = window.location.origin;
    return btoa(url); // Simple base64 encoding; swap for SHA if you want stronger obfuscation
  }
  
const scriptTag = document.currentScript as HTMLScriptElement | null;
const origin = window.location.origin
const allowedOrigins = [
  "http://americanhighschool.org",
  "https://americanhighschool.org",
  "http://www.americanhighschool.org",
  "https://www.americanhighschool.org",
  "https://www.americanhighschool.org/"
];


const widgetConfig = {
    sourceId:scriptTag?.getAttribute("data-source-id") || generateSourceIdFromURL(),
    agentId: scriptTag?.getAttribute("data-agent-id") || "agent_ce01bdc30264329416220de0f7", 
    transferAgentId: scriptTag?.getAttribute("data-transfer-agent-id") || "agent_ce01bdc30264329416220de0f7",
    agentName: scriptTag?.getAttribute("data-agent-name") || "Isabella",
    oldAgentName: scriptTag?.getAttribute("data-agent-name") || "Isabella",
    oldAgentID: scriptTag?.getAttribute("data-agent-id") || "agent_ce01bdc30264329416220de0f7",
    transferAgentName: scriptTag?.getAttribute("data-transfer-agent-name") || "Noah",
    apiKey:'1b07e2d1-c19f-44de-a638-303e755e1477',
    textOne:'Speak With',
    divId: scriptTag?.getAttribute("data-div-id") || "ConnexUSVRep-chat",
    onSite: allowedOrigins.includes(origin),
    userId: scriptTag?.getAttribute("data-user-id") || 'user_7890',
    maxCalls: parseInt(scriptTag?.getAttribute("data-max-calls") || "500", 10),
    widgetId: scriptTag?.getAttribute("data-widget-id") || "widget_xyz99",
    type: scriptTag?.getAttribute("data-type") || "internal",
    // onSite: allowedOrigins.includes(origin),
  };

  // Optional: attach globally if needed
  if (typeof window !== "undefined") {
    window.connexVRepConfig = {
      ...window.connexVRepConfig,
      ...widgetConfig,
    };
  }
  
  export default widgetConfig;