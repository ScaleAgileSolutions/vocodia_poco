import React, { useEffect, useState, useRef } from 'react';
import AudioMotionAnalyzer from 'audiomotion-analyzer';
import { RetellWebClient } from "retell-client-js-sdk";
import "../../../../src/app.css";
import { agent } from '../constant';
import { getWidgetConfig } from "../../../constants/config";
import { styles } from "../../styles";
import { CallTrackingData } from "../../../types/tracking";
import { callTrackingService } from '../../../services/callTracking';
import { navigationWarningService } from '../../../services/navigationWarning';

// State management for call control

// Type definitions
interface RegisterCallResponse {
  access_token: string;
}

interface ModalWindowProps {
  visible: boolean;
  setVisible: (val: boolean) => void;
  // microphoneStream?: MediaStream | null;
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

  const getSharedMicrophoneStream = () => {
    return (window as any).retellMicrophoneStream;
  };


  // Initialize Retell client
  const retellWebClient = useRef(new RetellWebClient()).current;

  useEffect(() => {
    (window as any).retellWebClient = retellWebClient;
  }, [retellWebClient]);

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

  // Function to register a new call with the Retell API
  async function registerCall(agentId: string, context: any = {}): Promise<RegisterCallResponse | null> {
    try {
      // Generate tracking data for analytics
     //console.log("registering call",...context);
      setstartingCall(true);
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
      // Make API call to create web call
     
      const response = await fetch("https://api.retellai.com/v2/create-web-call", {
        method: "POST",
        headers: {
          'Authorization': 'Bearer 1b07e2d1-c19f-44de-a638-303e755e1477',
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          agent_id: agentId,
          metadata: {
            ...trackingData,
            sourceId: widgetConfig.sourceId,
          },
          retell_llm_dynamic_variables: {
            ...context
          }
        }),
      });
      if (!response.ok) {
        //console.log(`Error: ${response.status}`);
        return null;
      }

        //save data here
      const data: RegisterCallResponse = await response.json();

      try{
        fetch("https://theconnexus.ai/retell/widgetCalls", {
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
            callInfo: data
          }),
        });
      }catch(err){
        console.error("Error saving call data:");
      }
     

      return data;
    } catch (err) {
      console.error("Call registration failed:");
      return null;
    }
  }

  // Function to handle call transfers between agents
  const transferCall = async (newAgentId: string, context: any) => {
    // Prevent multiple concurrent transfers
    if (isTransferActive) {
      //console.log("Transfer already in progress, ignoring duplicate request");
      return;
    }

    try {
      //console.log("Starting transfer to agent:", newAgentId);
      setTransferActive(true); // Set flag immediately to prevent duplicates
      
      await retellWebClient.stopCall();
      playHoldMusic();
      
      const res = await registerCall(newAgentId, context);
      if (!res) {
        throw new Error('Failed to register call');
      }
      const { access_token } = res;
      await wait(1500);
      
      await retellWebClient.startCall({
        accessToken: access_token,
        emitRawAudioSamples: true,
        sampleRate: 24000,
        ...(getSharedMicrophoneStream() && {
          captureDeviceId: getSharedMicrophoneStream().getAudioTracks()[0]?.getSettings().deviceId || 'default'
      })
      });

      stopHoldMusic();
      setTransferActive(false);
      setIsCalling(true);
      setstartingCall(false);
      setHasStartedInitialCall(true);
      setCallLimitError(null);
      props.setVisible(true);
      transferTriggeredRef.current = false;
      
      //console.log("Transfer completed successfully");
    } catch (err) {
      console.error("Transfer failed:");
      setCallLimitError('Failed to transfer call. Please try again.');
      stopHoldMusic();
      setTransferActive(false); // Reset flag on error
      transferTriggeredRef.current = false;
    }
  };

  // Function to end call and reset all states
  const endCallAndReset = async () => {
    //console.log("Ending call and resetting...");
    await retellWebClient.stopCall();
    setIsCalling(false);
    setTransferActive(false);
    //console.log("🧹 endCallAndReset - clearing chatData");
    // debugSetChatData([]);
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


  // Main update handler for chat messages and call events
  const handleUpdate = async (update: any) => {
    let postData = []
    handleUpdateCounter.current++;
    //console.log(`🔥 handleUpdate called #${handleUpdateCounter.current} with:`, update);
    
    const last = update.transcript?.[update.transcript.length - 1];
    if (!last) {
      //console.log("❌ No last transcript found, returning early");
      return;
    }
    
    const newContent = last.content || "";
    const role = last.role;
    
  

    debugSetChatData(prev => {
   
      
      const lastMessage = prev[prev.length - 1];
      
      // If the last message is from the same role, UPDATE it instead of adding new
      if (lastMessage?.role === role) {
        ("🔄 Updating existing message content");
        const updatedMessage = { ...lastMessage, content: newContent };
        const newData = [...prev.slice(0, -1), updatedMessage];
        ////console.log("🔄 Updated data:", newData);
       
        return newData;
      }
      
      // If different role or first message, ADD new message
      //console.log("🔄 Adding new message");
      const newData = [...prev, { role, content: newContent }];
      //console.log("🔄 New data:", newData);
      return newData;
    }); 
   
    // Define trigger phrases for call transfers
    const transferExamples = [
      "Please hold on for a moment",
      "Please hold on for a moment while I transfer you",
      "Please hold on for a moment while I transfer your call",
      "Please hold on for a moment while I connect you",
      "please hold on for just a moment"
    ];

    // Handle agent messages and potential transfers
    if (role === "agent" && newContent) {
      agentLastQuestion.current = newContent.toLowerCase();
    }
     // Handle user data collection based on agent questions
     if (role === "user" && newContent) {
      if (agentLastQuestion.current.includes("your name")) {
        //console.log("agentLastQuestion.current!!!!!!!!!!!!!!!!!!! Name",agentLastQuestion.current);
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


    const shouldTransfer = shouldTriggerTransfer(newContent, transferExamples);
    if (role === "agent" && shouldTransfer && !transferTriggeredRef.current) {

    //console.log("chatData before transfer!!!!!!!!!!!!!!!!!!!",chatData);
      transferTriggeredRef.current = true;
      const summary = update.transcript.map(msg => `${msg.role}: ${msg.content}`).join("\n");
      await wait(3000);
      //console.log("transferring to agent!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",summary);
      (window as any).transferToAgent?.(widgetConfig.transferAgentName);
      
      await transferCall(widgetConfig.transferAgentId, {
        handoff_reason: "agent_triggered_transfer",
        conversation_summary: summary,
      });
     
      return;
    }
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

  // Effect to set up Retell client event listeners
  useEffect(() => {
    //console.log("🎧 Setting up Retell event listeners");
    const client = retellWebClient;

    const handleCallStarted = () => {
      //console.log("📞 Call started event received");
      setIsCalling(true);
      // Update navigation warning service
      navigationWarningService.setCallActive(true);
    };
    const handleCallEnded = (data) => {
      //console.log("📞 Call ended event received", data);
      setIsCalling(false);
      // Update navigation warning service
      navigationWarningService.setCallActive(false);
      props.setVisible(false);
    };
    const handleError = (err) => {
      console.error("❌ Call error:");
      client.stopCall();
    };

    client.on("call_started", handleCallStarted);
    client.on("call_ended", handleCallEnded);
    client.on("update", handleUpdate);
    client.on("error", handleError);
    
    //console.log("✅ Event listeners attached successfully");

    return () => {
      //console.log("🧹 Cleaning up event listeners");
      client.off("call_started", handleCallStarted);
      client.off("call_ended", handleCallEnded);
      client.off("update", handleUpdate);
      client.off("error", handleError);
    };
  }, []); // ✅ Empty dependency array - only run once on mount

  // Effect to handle initial call setup and cleanup
  useEffect(() => {
    const setupCall = async () => {
      if (props.visible && !isTransferActive && !hasStartedInitialCall) {
        // //console.log("Setting up call... canMakeCall", canMakeCall);
        // if (!canMakeCall) {
        //   setCallLimitError('You have reached your call limit for this period.');
        //   return;
        // }
        try {
       
          const res = await registerCall(currentAgentId);
          if (!res) {
            throw new Error('Failed to register call');
          }

          // Ensure we're not already in a call
          if (isCalling) {
            await retellWebClient.stopCall();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
          }

          // Start the call with proper error handling
          try {
            await retellWebClient.startCall({
              accessToken: res.access_token,
              emitRawAudioSamples: true,
              sampleRate: 24000,
              ...(getSharedMicrophoneStream() && {
                captureDeviceId: getSharedMicrophoneStream().getAudioTracks()[0]?.getSettings().deviceId || 'default'
            })
            });
          } catch (callError) {
            //console.error("Failed to start call:", callError);
            setCallLimitError('Failed to start call. Please try again.');
            return;
          }

          // Update call tracking
          // await callTrackingService.incrementCallCount(
          //   widgetConfig.userId,
          //   widgetConfig.widgetId
          // );

          // const canStillCall = await callTrackingService.canMakeCall(
          //   widgetConfig.userId,
          //   widgetConfig.widgetId
          // );
          // setCanMakeCall(canStillCall);
          setstartingCall(true);
          setHasStartedInitialCall(true);
          setCallLimitError(null);
        } catch (err) {
          //console.error("Call registration failed:", err);
          setCallLimitError('Failed to update call count. Please try again.');
        }
      } else if (!props.visible && isTransferActive === false) {
        //console.log("Widget closed - cleaning up call");
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
