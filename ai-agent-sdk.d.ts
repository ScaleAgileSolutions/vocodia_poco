/**
 * AI Agent SDK TypeScript Declarations
 * @version 1.0.0
 */

declare module 'ai-agent-sdk' {
    export default AIAgentSDK;
}

/**
 * Configuration options for the AI Agent SDK
 */
interface AIAgentSDKOptions {
    /** Required: Your agent ID */
    agentId: string;
    /** Your server URL (default: 'https://agent.vocode.dev') */
    serverUrl?: string;
    /** LiveKit server URL (default: 'wss://callcenter-livekit.vocode.dev') */
    livekitUrl?: string;
    /** Agent mode: 'voice' for audio calls, 'text' for messaging (default: 'voice') */
    mode?: 'voice' | 'text';
}

/**
 * Connection state information
 */
interface ConnectionState {
    /** Whether currently connected to the agent */
    isConnected: boolean;
    /** Whether currently attempting to connect */
    isConnecting: boolean;
    /** Current connection state string */
    connectionState: 'disconnected' | 'connecting' | 'connected' | 'failed';
    /** Current mode of operation */
    mode: 'voice' | 'text';
}

/**
 * Transcript segment data
 */
interface TranscriptSegment {
    /** The transcript text */
    text: string;
    /** Whether this segment is final (completed) */
    final?: boolean;
    /** Segment ID */
    id?: string;
}

/**
 * Transcript data received from agent
 */
interface TranscriptData {
    /** Array of transcript segments */
    segments: TranscriptSegment[];
    /** Participant identifier */
    participant: string;
    /** Whether this transcript is from the user (true) or agent (false) */
    isUser: boolean;
}

/**
 * Data message received from agent
 */
interface DataMessage {
    /** Topic/channel of the message */
    topic: string;
    /** Message content */
    message: string;
    /** Participant who sent the data */
    participant: string;
}

/**
 * Connection state change event data
 */
interface ConnectionStateChange {
    /** New connection state */
    state: string;
    /** Previous connection state */
    previousState: string;
}

/**
 * Audio track received event data (voice mode only)
 */
interface AudioTrackData {
    /** LiveKit audio track */
    track: any; // LiveKit RemoteTrack
    /** Participant who owns the track */
    participant: string;
}

/**
 * Event handler function signatures
 */
interface EventHandlers {
    /** Fired when successfully connected to agent */
    connected: () => void;
    /** Fired when disconnected from agent */
    disconnected: () => void;
    /** Fired when connection state changes */
    connectionStateChanged: (data: ConnectionStateChange) => void;
    /** Fired when transcript/message is received */
    transcriptReceived: (data: TranscriptData) => void;
    /** Fired when structured data is received */
    dataReceived: (data: DataMessage) => void;
    /** Fired when an error occurs */
    error: (error: Error) => void;
    /** Fired when audio track is received (voice mode only) */
    audioTrackReceived: (data: AudioTrackData) => void;
    /** Fired when participant connects (voice mode only) */
    participantConnected: (participantId: string) => void;
    /** Fired when participant disconnects (voice mode only) */
    participantDisconnected: (participantId: string) => void;
}

/**
 * AI Agent SDK main class
 */
declare class AIAgentSDK {
    /**
     * Create a new AI Agent SDK instance
     * @param options Configuration options
     */
    constructor(options: AIAgentSDKOptions);

    /**
     * Connect to the AI agent
     * @returns Promise that resolves when connected
     * @throws Error if connection fails
     */
    connect(): Promise<void>;

    /**
     * Disconnect from the AI agent
     * @returns Promise that resolves when disconnected
     */
    disconnect(): Promise<void>;

    /**
     * Send a text message to the agent (text mode only)
     * @param message The message to send
     * @throws Error if not in text mode or not connected
     */
    sendMessage(message: string): void;

    /**
     * Send structured data to the agent
     * @param topic Data topic/channel
     * @param data Data to send
     * @throws Error if not connected
     */
    sendData(topic: string, data: any): void;

    /**
     * Set the audio output element (voice mode only)
     * @param audioElement HTML audio element for output
     */
    setAudioOutput(audioElement: HTMLElement): void;

    /**
     * Get current connection state
     * @returns Current connection state information
     */
    getConnectionState(): ConnectionState;

    /**
     * Register an event handler
     * @param event Event name
     * @param handler Event handler function
     * @returns SDK instance for chaining
     */
    on<K extends keyof EventHandlers>(event: K, handler: EventHandlers[K]): AIAgentSDK;

    /**
     * Remove an event handler
     * @param event Event name
     * @param handler Event handler function to remove
     * @returns SDK instance for chaining
     */
    off<K extends keyof EventHandlers>(event: K, handler: EventHandlers[K]): AIAgentSDK;

    /**
     * Clean up and destroy the SDK instance
     * @returns Promise that resolves when cleanup is complete
     */
    destroy(): Promise<void>;
}

export = AIAgentSDK; 