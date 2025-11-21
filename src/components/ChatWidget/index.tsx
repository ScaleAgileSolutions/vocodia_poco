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

    return (
        <div ref={widgetRef}>
            {/* Call Modal Window */}
            <ModalWindow visible={visible} setVisible={setVisible} />

            {/* New Horizontal AI Assistant Widget - Correct speech bubble design */}
            <div
                style={{
                    position: 'fixed',
                    bottom: 32,
                    right: 32,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    cursor: 'pointer',
                    zIndex: 1000,
                }}
                onClick={handleWidgetClick}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {/* Main widget container with mic and speech bubble */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: 8, // Space between main widget and agent status
                    }}
                >
                    {/* Microphone Button - Just the icon, no background */}
                    <div
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            background: callState === 'active' 
                                ? 'transparent' 
                                : callState === 'offline' 
                                ? '#6B7280' 
                                : 'linear-gradient(135deg, #d7c3b4 0%, #bfa897 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease',
                            flexShrink: 0,
                            zIndex: 2, // Above the white background
                            boxShadow: callState === 'active' ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleWidgetClick();
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        {/* Microphone Icon */}
                        {callState === 'active' ? (
                            <img 
                                src="https://vocodia-maxoderm-multi-widget.pages.dev/Asset/active_call.png"
                                alt="Active Microphone"
                                width="59" 
                                height="59" 
                                style={{ 
                                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
                                    boxShadow: '0 0 20px rgba(20, 174, 92, 0.8)',
                                    animation: 'pulse-green 2s infinite',
                                    borderRadius: '50%'
                                }}
                            />
                        ) : callState === 'offline' ? (
                            <img 
                                src="https://vocodia-maxoderm-multi-widget.pages.dev/Asset/mute_call.png"
                                alt="Offline Microphone"
                                width="59" 
                                height="59" 
                                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                            />
                        ) : (
                            <img 
                                src="https://vocodia-maxoderm-multi-widget.pages.dev/Asset/inactive_call.png"
                                alt="Available Microphone"
                                width="59" 
                                height="59" 
                                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                            />
                        )}
                    </div>

                    {/* Speech bubble - White background extending to the right */}
                    <div
                        style={{
                            width: 176,
                            backgroundColor: '#ffffff',
                            borderRadius: '20px',
                            padding: '5px 20px 6px 35px', // More padding on left to account for mic overlap
                            marginLeft: -28, // Overlap with the mic icon
                            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
                            border: '1px solid #e0e0e0',
                            animation: 'none',
                            transition: 'all 0.2s ease',
                            transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
                        }}
                    >
                        {/* Text Content */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                justifyContent: 'center',
                            }}
                        >
                            {/* Primary Text */}
                            <div
                                style={{
                                    color: '#159895',
                                    fontWeight: '600',
                                    fontSize: '11px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                    lineHeight: 1.1,
                                    marginBottom: 1,
                                }}
                            >
                                {callState === 'offline' ? 'ASSISTANT' : callState === 'active' ? 'TELL ME HOW' : 'TALK TO OUR '}
                            </div>
                            {/* Secondary Text */}
                            <div
                                style={{
                                    color: '#159895',
                                    fontWeight: '600',
                                    fontSize: '11px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                    lineHeight: 1.1,
                                }}
                            >
                                {callState === 'offline' ? 'OFFLINE' : callState === 'active' ? 'I CAN HELP' : 'AI ASSISTANT'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Agent Status - Outside and below the main widget */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 4,
                        marginRight: 8, // Align with the right edge of the speech bubble
                        marginTop: -11, // Move status text up closer
                    }}
                >
                    {/* Agent Status Label */}
                    <div
                        style={{
                            color: '#999999',
                            fontSize: '9px',
                            fontWeight: '400',
                            textTransform: 'uppercase',
                            letterSpacing: '0.2px',
                        }}
                    >
                        {callState === 'active' || callState === 'offline' ? 'CALL STATUS:' : 'AGENT STATUS:'}
                    </div>
                    
                    {/* Status Indicator Dot */}
                    <div
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: callState === 'active' 
                                ? '#EC221F' 
                                : callState === 'offline' 
                                ? '#D1D5DB' 
                                : '#2ecc71',
                            flexShrink: 0,
                            animation: callState === 'active' ? 'pulse-red 2s infinite' :  'none',
                        }}
                    />
                    
                    {/* Status Text */}
                    <div
                        style={{
                            color: '#333333',
                            fontSize: '10px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.2px',
                        }}
                    >
                        {callState === 'offline' ? 'OFFLINE' : callState === 'active' ? 'NOW ASSISTING' : 'AVAILABLE'}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ChatWidget;



