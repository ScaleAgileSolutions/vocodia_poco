import React, { useEffect, useState, useRef } from 'react';
import AudioMotionAnalyzer from 'audiomotion-analyzer';
import "../../../../src/app.css";
import { agent } from '../constant';
import { getWidgetConfig } from "../../../constants/config";
import { styles } from "../../styles";
import { CallTrackingData } from "../../../types/tracking";
import { callTrackingService } from '../../../services/callTracking';
import { navigationWarningService } from '../../../services/navigationWarning';

// Import AI Agent SDK
declare global {
  interface Window {
    AIAgentSDK: any;
  }
}

// State management for call control

// Type definitions
interface ModalWindowProps {
  visible: boolean;
  setVisible: (val: boolean) => void;
}

function ModalWindow(props: ModalWindowProps) {
  // State management for audio and call status
  const [micStream, setMicStream] = useState(null);
  const [audioMotion, setAudioMotion] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isTransferActive, setTransferActive] = useState(false);
  const [chatData, setChatData] = useState([]);
  const widgetConfig = getWidgetConfig();
  const [currentAgentName, setCurrentAgentName] = useState(widgetConfig.agentName);
  const [currentAgentId, setCurrentAgentId] = useState(widgetConfig.agentId);
  const [hasStartedInitialCall, setHasStartedInitialCall] = useState(false);
  const [canMakeCall, setCanMakeCall] = useState(true);
  const [callCount, setCallCount] = useState(0);
  const [startingCall, setstartingCall] = useState(false);
  const [callLimitError, setCallLimitError] = useState(null);
  // Refs for maintaining state between renders
  const agentLastQuestion = useRef("");
  const chatContainerRef = useRef(null);
  const [micAccess, setMicAccess] = useState(null);
  const transferTriggeredRef = useRef(false);
  const holdMusicRef = useRef(null);
  const handleUpdateCounter = useRef(0);

  // User data storage
  const userData = useRef({
    first_name: "",
    last_name: "",
    phone_number: "",
    customer_email: ""
  });

  // Initialize AI Agent SDK
  const agentSDK = useRef<any>(null);

  useEffect(() => {
    // Load the AI Agent SDK script
    if (!window.AIAgentSDK) {
      const script = document.createElement('script');
      script.src = '/ai-agent-sdk.js';
      script.async = true;
      script.onload = () => {
        console.log('AI Agent SDK loaded successfully');
      };
      document.head.appendChild(script);
    }
  }, []);

  // Hold music management functions
  const playHoldMusic = () => {
    if (!holdMusicRef.current) {
      const audio = new Audio('/Jazz.mp3');
      audio.loop = true;
      audio.volume = 0.5;
      holdMusicRef.current = audio;
    }
    holdMusicRef.current.play().catch(console.error);
  };

  const stopHoldMusic = () => {
    holdMusicRef.current?.pause();
    if (holdMusicRef.current) holdMusicRef.current.currentTime = 0;
  };

  // Utility function for delays
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Function to start a call with AI Agent SDK
  async function startCall(agentId: string, context: any = {}): Promise<boolean> {
    try {
      setstartingCall(true);
      
      // Generate tracking data for analytics
      const trackingData: CallTrackingData = {
        sourceId: widgetConfig.sourceId,
        timestamp: Date.now(),
        metadata: {
          widgetId: widgetConfig.widgetId,
          userId: widgetConfig.userId,
          usageType: widgetConfig.type,
          origin: window.location.origin,
          userAgent: navigator.userAgent,
          referrer: document.referrer,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          colorDepth: String(window.screen.colorDepth),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          cookiesEnabled: navigator.cookieEnabled,
          doNotTrack: navigator.doNotTrack,
          ipAddress: await fetch('https://api.ipify.org?format=json')
            .then(response => response.json())
            .then(data => data.ip)
            .catch(() => 'unknown'),
          location: await fetch('https://ipapi.co/json/')
            .then(response => response.json())
            .then(data => `${data.city}, ${data.region}, ${data.country_name}`)
            .catch(() => 'unknown'),
          sessionId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          connectionType: (navigator as any).connection?.type || 'unknown',
          connectionSpeed: String((navigator as any).connection?.downlink || 'unknown'),
          memory: String((navigator as any).deviceMemory || 'unknown'),
          hardwareConcurrency: String(navigator.hardwareConcurrency || 'unknown'),
          batteryStatus: await (navigator as any).getBattery?.().then(battery => ({
            charging: battery.charging,
            level: battery.level,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime
          })).catch(() => 'unknown'),
          permissions: await Promise.all([
            navigator.permissions.query({ name: 'microphone' as PermissionName }),
            navigator.permissions.query({ name: 'camera' as PermissionName }),
            navigator.permissions.query({ name: 'notifications' as PermissionName })
          ]).then(([mic, cam, notif]) => ({
            microphone: mic.state,
            camera: cam.state,
            notifications: notif.state
          })).catch(() => 'unknown'),
          deviceInfo: {
            platform: navigator.platform,
            vendor: navigator.vendor,
            mobile: /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(navigator.userAgent),
            browser: {
              name: navigator.appName,
              version: navigator.appVersion
            }
          }
        }
      };

      // Log call tracking
      try {
        await fetch("https://theconnexus.ai/agent/widgetCalls", {
          method: "POST",
          headers: {
            'Authorization': 'Bearer 1b07e2d1-c19f-44de-a638-303e755e1477',
            'Content-Type': 'application/json',
            'x-retell-signature': '1b07e2d1-c19f-44de-a638-303e755e1477',
          },
          body: JSON.stringify({
            agent_id: agentId,
            metadata: {
              ...trackingData,
              sourceId: widgetConfig.sourceId
            },
            context
          }),
        });
      } catch(err) {
        console.error("Error saving call data:", err);
      }

      // Initialize AI Agent SDK if not already done
      if (!agentSDK.current && window.AIAgentSDK) {
        agentSDK.current = new window.AIAgentSDK({
          agentId: agentId,
          mode: 'voice'
        });

        // Set up event handlers
        agentSDK.current
          .on('connected', handleCallStarted)
          .on('disconnected', handleCallEnded)
          .on('transcriptReceived', handleTranscript)
          .on('error', handleError);
      }

      // Connect to the agent
      await agentSDK.current.connect();
      return true;

    } catch (err) {
      console.error("Call start failed:", err);
      setstartingCall(false);
      return false;
    }
  }

  // Function to handle call transfers between agents
  const transferCall = async (newAgentId: string, context: any) => {
    // Prevent multiple concurrent transfers
    if (isTransferActive) {
      return;
    }

    try {
      console.log("Starting transfer to agent:", newAgentId);
      setTransferActive(true);
      
      // Disconnect current call
      if (agentSDK.current) {
        await agentSDK.current.disconnect();
      }
      
      playHoldMusic();
      await wait(1500);
      
      // Update current agent
      setCurrentAgentId(newAgentId);
      
      // Start new call with new agent
      const success = await startCall(newAgentId, context);
      
      if (!success) {
        throw new Error('Failed to start transfer call');
      }

      stopHoldMusic();
      setTransferActive(false);
      setIsCalling(true);
      setstartingCall(false);
      setHasStartedInitialCall(true);
      setCallLimitError(null);
      props.setVisible(true);
      transferTriggeredRef.current = false;
      
      console.log("Transfer completed successfully");
    } catch (err) {
      console.error("Transfer failed:", err);
      setCallLimitError('Failed to transfer call. Please try again.');
      stopHoldMusic();
      setTransferActive(false);
      transferTriggeredRef.current = false;
    }
  };

  // Function to end call and reset all states
  const endCallAndReset = async () => {
    console.log("Ending call and resetting...");
    
    if (agentSDK.current) {
      await agentSDK.current.disconnect();
    }
    
    setIsCalling(false);
    setTransferActive(false);
    setHasStartedInitialCall(false);
    
    // Update navigation warning service
    navigationWarningService.setCallActive(false);
    props.setVisible(false);
  };

  // Utility function to clean and normalize text
  function cleanText(text: string): string {
    return text.toLowerCase().replace(/[""]/g, '"').replace(/['']/g, "'").replace(/…/g, "...").replace(/[^\w\s']+$/g, '').trim();
  }

  // Function to check if transfer should be triggered based on agent's message
  function shouldTriggerTransfer(content: string, triggerPhrases: string[]): boolean {
    const last = content.split(/[.!?]/).map(cleanText).filter(Boolean).pop();
    return !!last && triggerPhrases.some(phrase => last === cleanText(phrase));
  }


  // Handler for transcript updates from AI Agent SDK
  const handleTranscript = (data: any) => {
    handleUpdateCounter.current++;
    console.log('Transcript received:', data);
    
    const { segments, isUser } = data;
    if (!segments || segments.length === 0) return;
    
    // Process each segment
    segments.forEach((segment: any) => {
      const role = isUser ? "user" : "agent";
      const newContent = segment.text || "";
      
      if (!newContent) return;

      debugSetChatData(prev => {
        const lastMessage = prev[prev.length - 1];
        
        // If the last message is from the same role, UPDATE it
        if (lastMessage?.role === role) {
          const updatedMessage = { ...lastMessage, content: newContent };
          return [...prev.slice(0, -1), updatedMessage];
        }
        
        // Otherwise add new message
        return [...prev, { role, content: newContent }];
      });

      // Handle agent messages and potential transfers
      if (role === "agent" && newContent) {
        agentLastQuestion.current = newContent.toLowerCase();
        
        // Define trigger phrases for call transfers
        const transferExamples = [
          "Please hold on for a moment",
          "Please hold on for a moment while I transfer you",
          "Please hold on for a moment while I transfer your call",
          "Please hold on for a moment while I connect you",
          "please hold on for just a moment"
        ];

        const shouldTransfer = shouldTriggerTransfer(newContent, transferExamples);
        if (shouldTransfer && !transferTriggeredRef.current) {
          transferTriggeredRef.current = true;
          
          // Build conversation summary
          const summary = chatData.map(msg => `${msg.role}: ${msg.content}`).join("\n");
          
          // Delay and trigger transfer
          wait(3000).then(() => {
            (window as any).transferToAgent?.(widgetConfig.transferAgentName);
            transferCall(widgetConfig.transferAgentId, {
              handoff_reason: "agent_triggered_transfer",
              conversation_summary: summary,
            });
          });
        }
      }
      
      // Handle user data collection based on agent questions
      if (role === "user" && newContent) {
        if (agentLastQuestion.current.includes("your name")) {
          const nameParts = newContent.trim().split(" ");
          if (nameParts.length >= 2) {
            userData.current.first_name = nameParts[0];
            userData.current.last_name = nameParts.slice(1).join(" ");
          }
        }

        if (agentLastQuestion.current.includes("your phone")) {
          userData.current.phone_number = newContent.trim();
        }

        if (newContent.includes("@")) {
          userData.current.customer_email = newContent.trim();
        }

        if (agentLastQuestion.current.includes("interests you the most")) {
          userData.current.customer_inquiry = newContent.trim();
        }

        if (agentLastQuestion.current.includes("preferred time")) {
          userData.current.preferred_contact_time = newContent.trim();
        }
      }
    });
  };

  // Effect to check call availability
  // useEffect(() => {
  //   const checkCallAvailability = async () => {
  //     try {
  //       const canCall = await callTrackingService.canMakeCall(
  //         widgetConfig.userId,
  //         widgetConfig.widgetId
  //       );
  //       setCanMakeCall(canCall);
  //     } catch (error) {
  //       console.error('Failed to check call availability:', error);
  //       setCanMakeCall(false);
  //     }
  //   };
  //   checkCallAvailability();
  // }, []);

  // Event handlers for AI Agent SDK
  const handleCallStarted = () => {
    console.log("📞 Call started event received");
    setIsCalling(true);
    navigationWarningService.setCallActive(true);
  };
  
  const handleCallEnded = () => {
    console.log("📞 Call ended event received");
    setIsCalling(false);
    navigationWarningService.setCallActive(false);
    props.setVisible(false);
  };
  
  const handleError = (err: Error) => {
    console.error("❌ Call error:", err);
    if (agentSDK.current) {
      agentSDK.current.disconnect();
    }
    setCallLimitError(err.message || 'An error occurred during the call');
  };

  // Effect to handle initial call setup and cleanup
  useEffect(() => {
    const setupCall = async () => {
      if (props.visible && !isTransferActive && !hasStartedInitialCall) {
        try {
          // Ensure we're not already in a call
          if (isCalling && agentSDK.current) {
            await agentSDK.current.disconnect();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          // Start the call
          const success = await startCall(currentAgentId);
          
          if (!success) {
            setCallLimitError('Failed to start call. Please try again.');
            return;
          }

          setHasStartedInitialCall(true);
          setCallLimitError(null);
          
        } catch (err) {
          console.error("Call setup failed:", err);
          setCallLimitError('Failed to start call. Please try again.');
        }
      } else if (!props.visible && isTransferActive === false) {
        console.log("Widget closed - cleaning up call");
        endCallAndReset();
      }
    };

    setupCall();
  }, [props.visible]);

  // Effect to setup navigation warning service
  useEffect(() => {
    // Only setup navigation warnings for non-SPA sites
    if (!navigationWarningService.getIsSPA()) {
      navigationWarningService.setWarningOptions({
        onBeforeNavigate: (targetUrl: string) => {
          // This will be called before navigation, but we handle it in the modal
          return true;
        },
        onConfirmNavigate: (targetUrl: string) => {
          // Open the target URL in a new tab
          window.open(targetUrl, '_blank');
        },
        onCancelNavigate: () => {
          // User cancelled navigation, do nothing
          //console.log('Navigation cancelled by user');
        }
      });
    }
  }, []);

  // Effect to update navigation warning service when call status changes
  useEffect(() => {
    navigationWarningService.setCallActive(isCalling);
  }, [isCalling]);

  // Effect to cleanup navigation warning service on unmount
  useEffect(() => {
    return () => {
      // Cleanup navigation warning service when component unmounts
      navigationWarningService.setCallActive(false);
    };
  }, []);

  // Debug wrapper for setChatData to track all calls
  const debugSetChatData = (value: any) => {
    // //console.log("🐛 setChatData called with:", value);
    // console.trace("🐛 Call stack:");
    setChatData(value);
  };

  // Monitor chatData changes
  useEffect(() => {
    //console.log("🔍 ChatData changed - Length:", chatData.length, "Data:", chatData);
  }, [chatData]);

  // Render the chat interface
  return (
    <div
      style={{
        ...styles.modalWindow,
        display: false ? "block" : "none",
        opacity: false ? "1" : "0",
        transition: "opacity 0.3s ease",
      }}
    >
      <div
        className="chat-container"
        ref={chatContainerRef}
        style={{
          height: "56vh",
          width: "100%",
          overflowY: "auto",
          background: "#333",
          padding: "1rem",
          borderRadius: "10px",
          display: startingCall && !isCalling ? "flex" : "block",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {startingCall && !isCalling ? (
          <div className="loading-icon">
            <div className="spinner"></div>
            <p style={{ color: "#fff", marginTop: "1rem" }}>Connecting with {currentAgentName}...</p>
          </div>
        ) : (
          <>
            {chatData.map((message, index) => (
              <div
                key={index}
                className={`chat-bubble ${message.role === "agent" ? "agent" : "user"}`}
              >
                {message.content}
              </div>
            ))}
            {isCalling && (
              <button onClick={endCallAndReset} className="end-call-button">
                End Call with {currentAgentName}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ModalWindow;

// declare global {
//   interface Window {
//     transferToAgent?: (name: string) => void;
//   }
// }
