/**
 * AI Agent SDK
 * A simplified JavaScript SDK for integrating voice and text AI agents
 * 
 * @version 1.0.0
 * @author AI Agent Platform
 */

class AIAgentSDK {
    constructor(options = {}) {
        // Configuration
        this.agentId = options.agentId;
        this.serverUrl = options.serverUrl || 'https://portal.theconnexus.ai/api';
        this.livekitUrl = options.livekitUrl || 'wss://webrtc.theconnexus.ai';
        this.mode = options.mode || 'voice'; // 'voice' or 'text'
        
        // State management
        this.isConnected = false;
        this.isConnecting = false;
        this.connectionState = 'disconnected';
        
        // LiveKit components (for voice mode)
        this.room = null;
        this.audioContext = null;
        this.audioOutputElement = null;
        this.attachedTracks = new Set();
        
        // WebSocket components (for text mode)
        this.socket = null;
        this.sessionId = null;
        this.agentInitialized = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.isReconnecting = false;
        this.isCallEnded = false;
        this.messageIdCounter = 0;
        
        // Event handlers
        this.eventHandlers = {
            connected: [],
            disconnected: [],
            connectionStateChanged: [],
            transcriptReceived: [],
            dataReceived: [],
            error: [],
            audioTrackReceived: [],
            participantConnected: [],
            participantDisconnected: [],
            messageReceived: [],
            messageChunk: [],
            typing: [],
            sessionInitialized: []
        };
        
        // Bind methods
        this.connect = this.connect.bind(this);
        this.disconnect = this.disconnect.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the SDK
     */
    async init() {
        if (!this.agentId) {
            throw new Error('Agent ID is required');
        }
        
        if (this.mode === 'voice') {
            await this.loadLiveKit();
        }
    }
    
    /**
     * Load LiveKit client library
     */
    async loadLiveKit() {
        return new Promise((resolve, reject) => {
            if (window.LivekitClient) {
                resolve(window.LivekitClient);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js';
            script.crossOrigin = 'anonymous';
            
            script.onload = () => {
                const checkLiveKit = () => {
                    if (window.LivekitClient) {
                        resolve(window.LivekitClient);
                    } else {
                        setTimeout(checkLiveKit, 100);
                    }
                };
                checkLiveKit();
            };
            
            script.onerror = () => reject(new Error('Failed to load LiveKit client'));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Event handler registration
     */
    on(event, handler) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].push(handler);
        } else {
            throw new Error(`Unknown event: ${event}`);
        }
        return this; // For chaining
    }
    
    /**
     * Remove event handler
     */
    off(event, handler) {
        if (this.eventHandlers[event]) {
            const index = this.eventHandlers[event].indexOf(handler);
            if (index > -1) {
                this.eventHandlers[event].splice(index, 1);
            }
        }
        return this;
    }
    
    /**
     * Emit event to registered handlers
     */
    emit(event, ...args) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => {
                try {
                    handler(...args);
                } catch (error) {
                    console.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }
    
    /**
     * Connect to the AI agent
     */
    async connect() {
        if (this.isConnected || this.isConnecting) {
            console.warn('Already connected or connecting');
            return;
        }
        
        this.isConnecting = true;
        this.updateConnectionState('connecting');
        
        try {
            if (this.mode === 'voice') {
                // Get connection token from server for voice mode
                const response = await fetch(`${this.serverUrl}/create-call`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        agent_id: this.agentId,
                        mode: this.mode
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                if (!data || !data.token) {
                    throw new Error('Failed to get connection token from server');
                }
                
                await this.connectVoice(data.token);
            } else {
                // Text mode connects directly via WebSocket without token
                await this.connectText();
            }
            
        } catch (error) {
            this.isConnecting = false;
            this.updateConnectionState('failed');
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * Connect to voice agent via LiveKit
     */
    async connectVoice(token) {
        const LivekitClient = window.LivekitClient;
        const { Room, RoomEvent, ConnectionState, createLocalTracks, Track, DataPacket_Kind } = LivekitClient;
        
        // Check microphone permission
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (error) {
            throw new Error('Microphone access denied. Please grant permission and try again.');
        }
        
        this.room = new Room({
            adaptiveStream: true,
            dynacast: true,
        });
        
        // Set up event listeners
        this.room
            .on(RoomEvent.ConnectionStateChanged, (state) => {
                this.updateConnectionState(state);
                if (state === ConnectionState.Connected) {
                    this.isConnected = true;
                    this.isConnecting = false;
                    this.emit('connected');
                } else if (state === ConnectionState.Disconnected) {
                    this.handleDisconnection();
                } else if (state === ConnectionState.Failed) {
                    this.emit('error', new Error('Connection failed'));
                }
            })
            .on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
                const message = new TextDecoder().decode(payload);
                this.emit('dataReceived', {
                    topic,
                    message,
                    participant: participant?.identity
                });
            })
            .on(RoomEvent.TranscriptionReceived, (segments, participant) => {
                this.emit('transcriptReceived', {
                    segments,
                    participant: participant?.identity,
                    isUser: participant?.identity === 'client-participant'
                });
            })
            .on(RoomEvent.ParticipantConnected, (participant) => {
                this.emit('participantConnected', participant?.identity);
            })
            .on(RoomEvent.ParticipantDisconnected, (participant) => {
                this.emit('participantDisconnected', participant?.identity);
                // If agent disconnects, end the call
                if (participant?.identity !== 'client-participant') {
                    this.disconnect();
                }
            })
            .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                if (track.kind === Track.Kind.Audio) {
                    console.log('Audio track subscribed:', track.sid);
                    
                    // Automatically attach audio track for playback
                    this.attachAudioTrack(track);
                    
                    this.emit('audioTrackReceived', {
                        track,
                        participant: participant?.identity
                    });
                }
            })
            .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                if (track.kind === Track.Kind.Audio) {
                    console.log('Audio track unsubscribed:', track.sid);
                    this.detachAudioTrack(track);
                }
            });
        
        // Connect to room
        await this.room.connect(this.livekitUrl, token);
        
        // Create and publish local audio track
        const SAMPLE_RATE = 24000;
        const tracks = await createLocalTracks({
            audio: {
                sampleRate: SAMPLE_RATE,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
            },
            video: false
        });
        
        const audioTrack = tracks.find(track => track.kind === Track.Kind.Audio);
        if (audioTrack) {
            await this.room.localParticipant.publishTrack(audioTrack);
        }
    }
    
    /**
     * Connect to text agent via WebSocket
     */
    async connectText(token) {
        return new Promise((resolve, reject) => {
            try {
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.close();
                }

                // Reset state
                this.agentInitialized = false;
                this.reconnectAttempts = 0;
                this.isReconnecting = false;
                this.isCallEnded = false;

                // Construct WebSocket URL
                const serverUrl = this.serverUrl.replace('http://', 'ws://').replace('https://', 'wss://');
                const baseUrl = `${serverUrl}/chat/v1/${this.agentId}?communication_type=text`;
                const wsUrl = this.sessionId && this.isReconnecting 
                    ? `${baseUrl}&reconnect_session_id=${this.sessionId}`
                    : baseUrl;
                
                console.log('SDK connecting to text WebSocket:', wsUrl);
                this.socket = new WebSocket(wsUrl);

                this.socket.onopen = () => {
                    console.log('SDK text WebSocket connected');
                    this.isConnected = true;
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    this.isReconnecting = false;
                    this.updateConnectionState('connected');
                    
                    // Send initial connection message
                    const initMessage = {
                        type: 'text-chat-init',
                        data: {
                            agentId: this.agentId,
                            userId: `user-${Date.now()}`,
                            dynamic_variables: {}
                        }
                    };

                    this.socket.send(JSON.stringify(initMessage));
                    this.emit('connected');
                    resolve();
                };

                this.socket.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleTextMessage(message);
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                        this.emit('error', new Error('Failed to parse WebSocket message'));
                    }
                };

                this.socket.onclose = (event) => {
                    console.log('SDK text WebSocket closed:', event.code, event.reason);
                    this.isConnected = false;
                    
                    // Don't show errors or attempt reconnection if call was intentionally ended
                    if (this.isCallEnded) {
                        this.emit('disconnected');
                        return;
                    }
                    
                    // Only attempt to reconnect if we have a session and haven't exceeded retry limit
                    if (event.code !== 1000 && this.sessionId && this.agentInitialized && 
                        this.reconnectAttempts < this.maxReconnectAttempts && !this.isReconnecting) {
                        this.attemptTextReconnection();
                    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        this.emit('error', new Error('Connection lost after 3 retry attempts'));
                        this.sessionId = null;
                    } else if (!this.agentInitialized) {
                        this.emit('error', new Error('Agent failed to initialize'));
                    }
                    
                    this.handleDisconnection();
                };

                this.socket.onerror = (error) => {
                    console.error('SDK text WebSocket error:', error);
                    this.emit('error', new Error('WebSocket connection error'));
                    reject(error);
                };

            } catch (error) {
                this.emit('error', error);
                reject(error);
            }
        });
    }
    
    /**
     * Handle text message from WebSocket
     */
    handleTextMessage(message) {
        console.log('SDK received text message:', message);
        
        switch (message.type) {
            case 'session_initialized':
                this.sessionId = message.session_id;
                this.agentInitialized = true;
                this.emit('sessionInitialized', { sessionId: this.sessionId });
                console.log('SDK session initialized:', this.sessionId);
                break;
                
            case 'reconnection_success':
                this.agentInitialized = true;
                console.log('SDK reconnection successful');
                break;
                
            case 'text-chat-connected':
                this.agentInitialized = true;
                console.log('SDK text chat connected');
                break;
                
            case 'text-chat-typing':
                this.emit('typing', { isTyping: message.data.typing });
                break;
                
            case 'text-chat-chunk':
                this.handleTextChunk(message);
                break;
                
            case 'text-chat-message-complete':
                this.emit('messageReceived', {
                    type: 'complete',
                    messageId: message.data.messageId,
                    timestamp: message.data.timestamp
                });
                break;
                
            case 'text-chat-error':
                this.emit('error', new Error(message.data.error || "An error occurred during the conversation"));
                break;
                
            case 'end-call':
                this.handleTextCallEnded();
                break;
        }
    }

    /**
     * Handle text chunk from WebSocket
     */
    handleTextChunk(message) {
        // Clean up the complete text by removing stream markers
        let cleanText = message.data.chunk || "";
        cleanText = cleanText.replace(/<beginning_of_stream>/g, "");
        cleanText = cleanText.replace(/<end_of_stream>/g, "");
        cleanText = cleanText.trim();
        
        if (cleanText) {
            const messageId = message.data.messageId || `assistant-${++this.messageIdCounter}`;
            
            this.emit('messageChunk', {
                messageId: messageId,
                content: cleanText,
                timestamp: message.data.timestamp || Date.now(),
                isComplete: message.data.chunk && message.data.chunk.includes('<end_of_stream>')
            });

            // Also emit as complete message for compatibility
            this.emit('messageReceived', {
                id: messageId,
                role: 'assistant',
                content: cleanText,
                timestamp: message.data.timestamp || Date.now()
            });
        }
    }

    /**
     * Attempt reconnection for text mode
     */
    async attemptTextReconnection() {
        if (this.isReconnecting || !this.sessionId) return;
        
        this.isReconnecting = true;
        this.reconnectAttempts++;
        
        try {
            // Check if session is still available for reconnection
            const response = await fetch(`${this.serverUrl}/chat/v1/session/${this.sessionId}/status`);
            
            if (!response.ok) {
                throw new Error(`Session status check failed: ${response.status}`);
            }
            
            const status = await response.json();
            
            if (!status.canReconnect) {
                this.sessionId = null;
                this.isReconnecting = false;
                this.emit('error', new Error('Session expired. Please start a new conversation.'));
                return;
            }
            
            // Wait before reconnecting (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 2000 * this.reconnectAttempts));
            
            // Attempt to reconnect
            await this.connectText();
            
        } catch (error) {
            console.error('Error during SDK text reconnection attempt:', error);
            this.isReconnecting = false;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.emit('error', new Error('Failed to reconnect after 3 attempts'));
                this.sessionId = null;
            } else {
                // Try again after a delay
                setTimeout(() => {
                    this.attemptTextReconnection();
                }, 2000 * this.reconnectAttempts);
            }
        }
    }

    /**
     * Handle text call ended
     */
    handleTextCallEnded() {
        this.isCallEnded = true;
        
        // Add a delay before ending the session to allow final messages to process
        setTimeout(() => {
            this.sessionId = null;
            this.isReconnecting = false;
            
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.close(1000, 'Call ended');
            }
            this.socket = null;
            
            this.isConnected = false;
            this.updateConnectionState('disconnected');
            this.emit('disconnected');
        }, 2000);
    }

    /**
     * Send a text message (for text mode)
     */
    sendMessage(message) {
        if (this.mode !== 'text') {
            throw new Error('sendMessage is only available in text mode');
        }
        
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            throw new Error('Not connected to text agent');
        }
        
        const messageData = {
            type: 'text-chat-message',
            data: {
                message: message,
                timestamp: Date.now()
            }
        };
        
        this.socket.send(JSON.stringify(messageData));
        
        // Emit user message for consistency
        this.emit('messageReceived', {
            id: `user-${++this.messageIdCounter}`,
            role: 'user',
            content: message,
            timestamp: Date.now()
        });
    }
    
    /**
     * Send data to the agent
     */
    sendData(topic, data) {
        if (this.mode === 'voice' && this.room) {
            const encoder = new TextEncoder();
            const payload = encoder.encode(JSON.stringify(data));
            this.room.localParticipant.publishData(payload, DataPacket_Kind.RELIABLE, topic);
        } else if (this.mode === 'text' && this.socket) {
            this.socket.send(JSON.stringify({
                type: 'data',
                topic: topic,
                data: data,
                timestamp: Date.now()
            }));
        } else {
            throw new Error('Not connected');
        }
    }
    
    /**
     * Disconnect from the agent
     */
    async disconnect() {
        if (!this.isConnected && !this.isConnecting) {
            return;
        }
        
        this.isConnected = false;
        this.isConnecting = false;
        
        // Clean up audio tracks first
        this.cleanupAudioTracks();
        
        if (this.mode === 'voice' && this.room) {
            await this.room.disconnect();
            this.room = null;
        } else if (this.mode === 'text' && this.socket) {
            // Clear session and reset state for text mode
            this.sessionId = null;
            this.isReconnecting = false;
            this.isCallEnded = false;
            this.agentInitialized = false;
            this.reconnectAttempts = 0;
            
            this.socket.close();
            this.socket = null;
        }
        
        // Clean up audio context
        if (this.audioContext && this.audioContext.state !== 'closed') {
            await this.audioContext.close();
            this.audioContext = null;
        }
        
        this.updateConnectionState('disconnected');
    }
    
    /**
     * Handle disconnection cleanup
     */
    handleDisconnection() {
        this.isConnected = false;
        this.isConnecting = false;
        this.updateConnectionState('disconnected');
        this.emit('disconnected');
    }
    
    /**
     * Update connection state and emit event
     */
    updateConnectionState(state) {
        const oldState = this.connectionState;
        this.connectionState = state;
        this.emit('connectionStateChanged', { 
            state, 
            previousState: oldState 
        });
    }
    
    /**
     * Get current connection state
     */
    getConnectionState() {
        return {
            isConnected: this.isConnected,
            isConnecting: this.isConnecting,
            connectionState: this.connectionState,
            mode: this.mode,
            audioTracksCount: this.attachedTracks ? this.attachedTracks.size : 0
        };
    }
    
    /**
     * Get audio status information
     */
    getAudioStatus() {
        if (this.mode !== 'voice') {
            return { mode: this.mode, message: 'Audio not available in text mode' };
        }
        
        const attachedCount = this.attachedTracks ? this.attachedTracks.size : 0;
        const hasAudioOutput = !!this.audioOutputElement;
        const hasDefaultContainer = !!this.defaultAudioContainer;
        
        const audioElements = [];
        if (this.attachedTracks) {
            this.attachedTracks.forEach(({ track, element }) => {
                audioElements.push({
                    trackId: track.sid,
                    isPaused: element.paused,
                    volume: element.volume,
                    muted: element.muted,
                    hasParent: !!element.parentNode
                });
            });
        }
        
        return {
            mode: this.mode,
            attachedTracksCount: attachedCount,
            hasAudioOutput,
            hasDefaultContainer,
            audioElements,
            audioContextState: this.audioContext ? this.audioContext.state : 'none'
        };
    }
    
    /**
     * Attach an audio track for playback
     */
    attachAudioTrack(track) {
        try {
            // Create audio element from track
            const audioElement = track.attach();
            audioElement.autoplay = true;
            audioElement.playsInline = true;
            
            // Handle autoplay policy restrictions
            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn('Audio autoplay was prevented:', error);
                    // Emit event to let the application handle this (e.g., show a play button)
                    this.emit('error', new Error('Audio autoplay blocked. User interaction may be required.'));
                });
            }
            
            // Keep track of attached elements
            this.attachedTracks.add({
                track: track,
                element: audioElement
            });
            
            // If we have a designated audio output element, append there
            if (this.audioOutputElement) {
                this.audioOutputElement.appendChild(audioElement);
            } else {
                // Create a default hidden audio container
                if (!this.defaultAudioContainer) {
                    this.defaultAudioContainer = document.createElement('div');
                    this.defaultAudioContainer.style.display = 'none';
                    document.body.appendChild(this.defaultAudioContainer);
                }
                this.defaultAudioContainer.appendChild(audioElement);
            }
            
            console.log('Audio track attached successfully');
            
            // Set up audio context for analysis if needed
            if (!this.audioContext) {
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                } catch (error) {
                    console.warn('Could not create AudioContext:', error);
                }
            }
            
        } catch (error) {
            console.error('Error attaching audio track:', error);
            this.emit('error', new Error(`Failed to attach audio track: ${error.message}`));
        }
    }
    
    /**
     * Detach an audio track
     */
    detachAudioTrack(track) {
        const trackData = Array.from(this.attachedTracks).find(t => t.track === track);
        if (trackData) {
            // Remove the audio element from DOM
            if (trackData.element && trackData.element.parentNode) {
                trackData.element.parentNode.removeChild(trackData.element);
            }
            
            // Remove from our tracking
            this.attachedTracks.delete(trackData);
            
            console.log('Audio track detached');
        }
    }
    
    /**
     * Clean up all audio tracks
     */
    cleanupAudioTracks() {
        // Remove all attached audio elements
        this.attachedTracks.forEach(({ element }) => {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        
        // Clear the tracking set
        this.attachedTracks.clear();
        
        // Remove default audio container if it exists
        if (this.defaultAudioContainer && this.defaultAudioContainer.parentNode) {
            this.defaultAudioContainer.parentNode.removeChild(this.defaultAudioContainer);
            this.defaultAudioContainer = null;
        }
        
        console.log('Audio tracks cleaned up');
    }
    
    /**
     * Set audio output element (for voice mode)
     */
    setAudioOutput(audioElement) {
        if (this.mode !== 'voice') {
            console.warn('setAudioOutput is only relevant for voice mode');
            return;
        }
        
        this.audioOutputElement = audioElement;
        
        // Move any existing attached tracks to the new audio output element
        this.attachedTracks.forEach(({ element }) => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            audioElement.appendChild(element);
        });
        
        console.log('Audio output element set');
    }
    
    /**
     * Cleanup and destroy the SDK instance
     */
    async destroy() {
        await this.disconnect();
        
        // Additional cleanup for audio tracks
        this.cleanupAudioTracks();
        
        // Clear all event handlers
        Object.keys(this.eventHandlers).forEach(event => {
            this.eventHandlers[event] = [];
        });
        
        // Clear references
        this.room = null;
        this.socket = null;
        this.audioContext = null;
        this.audioOutputElement = null;
        this.defaultAudioContainer = null;
        this.attachedTracks = null;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIAgentSDK;
} else if (typeof window !== 'undefined') {
    window.AIAgentSDK = AIAgentSDK;
} 