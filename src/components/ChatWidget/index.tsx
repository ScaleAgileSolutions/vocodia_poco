//to do, check chat gpt for the updated code,
//chnage the call state when new call is started with noah,
// sign over controls to the new calls with noah
// turn down the valume of the music


// importing external style
import { styles } from "../styles";
// import icon
import { BsFillTelephoneFill } from "react-icons/bs";
import React, { useEffect, useRef, useState } from "react";
//import ModalWindow
import ModalWindow from "./ModalWindow";
import {agent} from './constant'
import {getWidgetConfig} from "../../constants/config";

import 'bootstrap/dist/css/bootstrap.min.css';

// Add CSS styles for the widget animations
const widgetStyles = `
  @keyframes activeRingPulse {
    0%, 100% {
      box-shadow: 
        0 0 0 8px #10B981,
        0 0 0 20px rgba(16, 185, 129, 0.3),
        0 6px 25px rgba(0, 0, 0, 0.2);
    }
    50% {
      box-shadow: 
        0 0 0 8px #10B981,
        0 0 0 32px transparent,
        0 6px 25px rgba(0, 0, 0, 0.2);
    }
  }

  @keyframes endingRingPulse {
    0%, 100% {
      box-shadow: 
        0 0 0 8px #DC2626,
        0 0 0 12px rgba(220, 38, 38, 0.3),
        0 6px 25px rgba(0, 0, 0, 0.2);
    }
    50% {
      box-shadow: 
        0 0 0 8px #DC2626,
        0 0 0 16px transparent,
        0 6px 25px rgba(0, 0, 0, 0.2);
    }
  }
`;

function ChatWidget() {
    // state variable to track if widget button was hovered on
    const [hovered, setHovered] = useState(false);
    // state variable to track modal visibility
    const [visible, setVisible] = useState<boolean>(false);
    //creating a ref 'id'
    const widgetRef = useRef(null);
    const [micStatus, setMicStatus] = useState<"active" | "inactive" | "denied" | "checking">("checking");
    const [currentAgentName, setCurrentAgentName] = useState(getWidgetConfig().agentName);   
    const [currentStage, setCurrentStage] = useState('Speak With');
    const [callState, setCallState] = useState<'inactive' | 'active' | 'offline'>('inactive');
    const [micStream, setMicStream] = useState<MediaStream | null>(null);
    const [ending, setEnding] = useState(false);

    // use effect listener to check if the mouse was cliked outside the window 
    useEffect(() => {
        function handleClickOutside(event) {
            if (widgetRef.current && !widgetRef.current.contains(event.target)) {
                // setVisible(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [widgetRef]);

    async function checkMic() {
        if (navigator.mediaDevices && !visible) {
            navigator.mediaDevices
                .getUserMedia({ audio: true, video: false })
                .then((stream) => {
                    setMicStream(stream);
                    setMicStatus("active");
                    setVisible(true);
                }).catch((error: any) => {
                    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
                        setMicStatus("denied");
                    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
                        setMicStatus("denied");
                    } else {
                        setMicStatus("denied");
                    }
                });
        } else if (visible) {
            setVisible(false);
            setCurrentAgentName(getWidgetConfig().agentName);
            setCurrentStage('Speak With');
            stopMicrophone();
        }
    }

    // 🔁 This function allows you to update agent name and manage transfer behavior
    function handleAgentTransfer(newAgentName: string) {
        setCurrentAgentName(getWidgetConfig().transferAgentName);
        setCurrentStage('Calling')
        setMicStatus("active");
    }
    
    useEffect(() => {
        (window as any).transferToAgent = handleAgentTransfer;
    }, []);

    // 🔁 This function allows you to update agent name and manage transfer behavior
    function handleAgentHengUp(newAgentName: string) {
        setCurrentAgentName(getWidgetConfig().agentName);
        setCurrentStage('Speak With')
        setMicStatus("active");
        setVisible(false);
    }
    
    useEffect(() => {
        (window as any).hengUpAgent = handleAgentHengUp;
    }, []);

    // Function to handle call state changes
    function handleCallStateChange(state: 'inactive' | 'active' | 'offline') {
        setCallState(state);
    }
    
    useEffect(() => {
        (window as any).setCallState = handleCallStateChange;
        (window as any).muteMicrophone = muteMicrophone;
        (window as any).unmuteMicrophone = unmuteMicrophone;
        (window as any).stopMicrophone = stopMicrophone;
    }, []);

    // Cleanup microphone stream on component unmount
    useEffect(() => {
        return () => {
            stopMicrophone();
        };
    }, []);

    // Function to mute the microphone
    const muteMicrophone = () => {
        if ((window as any).aiAgentSDK) {
            // AI Agent SDK handles muting through the room's audio track
            console.log('Microphone muted');
        } else {
            console.log('AI Agent SDK not found');
        }
    };

    // Function to unmute the microphone
    const unmuteMicrophone = () => {
        if ((window as any).aiAgentSDK) {
            // AI Agent SDK handles unmuting through the room's audio track
            console.log('Microphone unmuted');
        } else {
            console.log('AI Agent SDK not found');
        }
    };

    // Function to stop the microphone stream completely
    const stopMicrophone = () => {
        if (micStream) {
            micStream.getTracks().forEach(track => {
                track.stop();
            });
            setMicStream(null);
            console.log('Microphone stream stopped');
        }
    };

    const openModal = () => {
        setVisible(true);
    };

    const handleWidgetClick = () => {
        if (callState === 'inactive') {
            // Start call - request microphone access
            checkMic();
            setCallState('active');
        } else if (callState === 'active') {
            // End call
            setVisible(false);
            setCurrentAgentName(getWidgetConfig().agentName);
            setCurrentStage('Speak With');
            stopMicrophone();
            setCallState('offline');
        } else if (callState === 'offline') {
            // Start new call
            checkMic();
            setCallState('active');
        }
    };

    // Get widget configuration for text content and agent image
    const widgetConfig = getWidgetConfig();
    // console.log(widgetConfig,'widgetConfig-------------->')
    const textContent = widgetConfig.agentName ? `Talk to ${widgetConfig.agentName}!` : "Talk to Michelle!";
    const agentImage = widgetConfig.agentImage || '/Asset/agent-photo-20251223-161139.png';
    
    // Determine widget state class
    const widgetStateClass = ending ? 'ending' : callState === 'active' ? 'active' : '';

    // Get box shadow based on state
    const getBoxShadow = () => {
        const ringThickness = 8;
        const shadowColor = 'rgba(0, 0, 0, 0.2)';
        
        if (ending) {
            return `0 0 0 ${ringThickness}px #DC2626, 0 0 0 ${ringThickness + 4}px rgba(220, 38, 38, 0.3), 0 6px 25px ${shadowColor}`;
        }
        if (callState === 'active') {
            return `0 0 0 ${ringThickness}px #10B981, 0 0 0 ${ringThickness + 4}px rgba(16, 185, 129, 0.3), 0 6px 25px ${shadowColor}`;
        }
        return `0 0 0 ${ringThickness}px #143884, 0 4px 15px ${shadowColor}`;
    };

    return (
        <div ref={widgetRef}>
            {/* Inject CSS styles for animations */}
            <style>{widgetStyles}</style>
            
            {/* Call Modal Window */}
            <ModalWindow visible={visible} setVisible={setVisible} />

            {/* Text Container - "Talk to Michelle!" - positioned above widget */}
            <div
                className="widget-text"
                style={{
                    position: 'fixed',
                    bottom: 'calc(80px + 125px - 140px)', // widget-bottom + widget-size/2 + text-offset-y
                    right: 'calc(45px + 125px)', // widget-right + widget-size/2
                    transform: hovered ? 'translate(50%, 50%) scale(1.05)' : 'translate(50%, 50%) scale(1)',
                    background: '#FFFFFF',
                    color: '#000000',
                    border: '6px solid #143884',
                    padding: '6px 20px',
                    borderRadius: '35px',
                    boxShadow: hovered ? '0 6px 25px rgba(0, 0, 0, 0.3)' : '0 4px 15px rgba(0, 0, 0, 0.15)',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    fontSize: '32px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    zIndex: 10000,
                    opacity: (callState === 'active' || ending) ? 0 : 1,
                    visibility: (callState === 'active' || ending) ? 'hidden' : 'visible',
                    transition: 'opacity 0.3s ease, transform 0.3s ease, visibility 0.3s ease, box-shadow 0.3s ease',
                }}
                onClick={(e) => {
                    e.preventDefault();
                    handleWidgetClick();
                }}
                onMouseEnter={() => {
                    setHovered(true);
                }}
                onMouseLeave={() => {
                    setHovered(false);
                }}
            >
                {textContent}
            </div>

            {/* Main Widget Container - Circular with agent image */}
            <div
                id="voice-widget"
                className={widgetStateClass}
                style={{
                    position: 'fixed',
                    bottom: '80px',
                    right: '45px',
                    width: '250px',
                    height: '250px',
                    background: '#FFFFFF',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    transition: 'all 0.3s ease',
                    overflow: 'hidden',
                    boxShadow: getBoxShadow(),
                    animation: ending ? 'endingRingPulse 0.5s ease-in-out 4' : callState === 'active' ? 'activeRingPulse 2s ease-in-out infinite' : 'none',
                    transform: hovered ? 'scale(1.08)' : 'scale(1)',
                }}
                onClick={handleWidgetClick}
                onMouseEnter={() => {
                    setHovered(true);
                }}
                onMouseLeave={() => {
                    setHovered(false);
                }}
            >
                {/* Agent Photo/Image */}
                <div
                    className="widget-image"
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `url(${agentImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        borderRadius: '50%',
                        transform: hovered ? 'scale(1.05)' : 'scale(1)',
                        transformOrigin: 'center',
                        transition: 'transform 0.3s ease',
                    }}
                />
            </div>
        </div>
    );
}

export default ChatWidget;



