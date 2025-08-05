// scripts/network_manager.js

/**
 * @class NetworkManager
 * @classdesc Manages peer-to-peer and broadcast communication between OopisOS instances.
 * It uses a combination of BroadcastChannel for local tab communication and a WebSocket
 * signaling server with WebRTC for cross-browser/cross-machine communication.
 */
class NetworkManager {
    /**
     * Initializes the NetworkManager, creating a unique instance ID, setting up
     * a BroadcastChannel, and connecting to the signaling server.
     */
    constructor() {
        /**
         * A unique identifier for this OopisOS instance.
         * @type {string}
         */
        this.instanceId = `oos-${Date.now()}-${Math.floor(Math.random() * 100)}`;

        /**
         * The BroadcastChannel for communication between tabs on the same origin.
         * @type {BroadcastChannel}
         */
        this.channel = new BroadcastChannel('oopisos-network');

        /**
         * A container for dependency injection.
         * @type {object}
         */
        this.dependencies = {};

        /**
         * A callback function to be executed when a message is received in listen mode.
         * @type {Function|null}
         */
        this.listenCallback = null;

        /**
         * A queue for incoming messages when no listen callback is set.
         * @type {Array<object>}
         */
        this.messageQueue = [];

        /**
         * A map to store callbacks for pending ping requests.
         * @type {Map<string, Function>}
         */
        this.pingCallbacks = new Map();

        /**
         * The URL of the WebSocket signaling server.
         * @type {string}
         */
        this.signalingServerUrl = 'ws://localhost:8080';

        /**
         * The WebSocket instance for the signaling server connection.
         * @type {WebSocket|null}
         */
        this.websocket = null;

        /**
         * A map of active WebRTC peer connections, keyed by target instance ID.
         * @type {Map<string, RTCPeerConnection>}
         */
        this.peers = new Map();

        /**
         * A set of discovered remote instance IDs.
         * @type {Set<string>}
         */
        this.remoteInstances = new Set();

        this.channel.onmessage = this._handleBroadcastMessage.bind(this);
        this._initializeSignaling();

        console.log(`NetworkManager initialized with ID: ${this.instanceId}`);
    }

    /**
     * Sets the dependencies for the NetworkManager.
     * @param {object} dependencies - The dependency container.
     */
    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    /**
     * Returns the unique instance ID.
     * @returns {string} The instance ID.
     */
    getInstanceId() {
        return this.instanceId;
    }

    /**
     * Returns an array of discovered remote instance IDs.
     * @returns {string[]} An array of instance IDs.
     */
    getRemoteInstances() {
        return Array.from(this.remoteInstances);
    }

    /**
     * Returns the map of active WebRTC peer connections.
     * @returns {Map<string, RTCPeerConnection>} The peers map.
     */
    getPeers() {
        return this.peers;
    }

    /**
     * Sets the callback function to be invoked when a message is received.
     * @param {Function} callback - The callback function.
     */
    setListenCallback(callback) {
        this.listenCallback = callback;
    }

    /**
     * Handles incoming messages from the BroadcastChannel.
     * @private
     * @param {MessageEvent} event - The message event.
     */
    _handleBroadcastMessage(event) {
        this._processIncomingMessage(event.data);
    }

    /**
     * Initializes the connection to the WebSocket signaling server and sets up event handlers.
     * @private
     */
    _initializeSignaling() {
        this.websocket = new WebSocket(this.signalingServerUrl);

        this.websocket.onopen = () => {
            console.log('Connected to signaling server.');
            const presencePayload = { type: 'discover', sourceId: this.instanceId };
            this.websocket.send(JSON.stringify(presencePayload));
        };

        this.websocket.onmessage = async (event) => {
            try {
                let messageData = event.data;
                if (messageData instanceof Blob) {
                    messageData = await messageData.text();
                }
                const payload = JSON.parse(messageData);
                if (payload.sourceId === this.instanceId) return;

                switch (payload.type) {
                    case 'discover':
                        if (!this.remoteInstances.has(payload.sourceId)) {
                            this.remoteInstances.add(payload.sourceId);
                            const presencePayload = { type: 'discover', sourceId: this.instanceId };
                            this.websocket.send(JSON.stringify(presencePayload));
                        }
                        break;
                    case 'offer': await this._handleOffer(payload); break;
                    case 'answer': await this._handleAnswer(payload); break;
                    case 'candidate': await this._handleCandidate(payload); break;
                    case 'ping': case 'pong': case 'direct_message':
                        this._processIncomingMessage(payload);
                        break;
                }
            } catch (error) {
                console.error('Error parsing signaling message:', error);
            }
        };

        this.websocket.onclose = () => {
            console.log('Disconnected from signaling server. Reconnecting in 5s...');
            setTimeout(() => this._initializeSignaling(), 5000);
        };

        this.websocket.onerror = (error) => console.error('Signaling server error:', error);
    }

    /**
     * Sends a message through the signaling server if connected.
     * @private
     * @param {object} payload - The message payload to send.
     */
    _sendSignalingMessage(payload) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(payload));
        }
    }

    /**
     * Creates and configures a new RTCPeerConnection for a given target ID.
     * @private
     * @param {string} targetId - The instance ID of the peer to connect to.
     * @returns {Promise<RTCPeerConnection>} A promise that resolves to the peer connection.
     */
    async _createPeerConnection(targetId) {
        if (this.peers.has(targetId)) return this.peers.get(targetId);

        const peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this._sendSignalingMessage({ type: 'candidate', targetId, sourceId: this.instanceId, candidate: event.candidate });
            }
        };
        peerConnection.ondatachannel = (event) => this._setupDataChannel(event.channel, targetId);
        this.peers.set(targetId, peerConnection);
        return peerConnection;
    }

    /**
     * Sets up the event handlers for a new RTCDataChannel.
     * @private
     * @param {RTCDataChannel} dataChannel - The data channel to set up.
     * @param {string} peerId - The instance ID of the peer.
     */
    _setupDataChannel(dataChannel, peerId) {
        dataChannel.onopen = () => console.log(`Data channel with ${peerId} is open.`);
        dataChannel.onmessage = (event) => this._processIncomingMessage(JSON.parse(event.data));
        dataChannel.onclose = () => {
            console.log(`Data channel with ${peerId} closed.`);
            this.peers.delete(peerId);
            this.remoteInstances.delete(peerId);
        };
    }

    /**
     * Handles an incoming WebRTC offer from a peer.
     * @private
     * @param {object} payload - The offer payload.
     * @param {string} payload.sourceId - The sender's instance ID.
     * @param {RTCSessionDescriptionInit} payload.offer - The SDP offer.
     */
    async _handleOffer({ sourceId, offer }) {
        const peerConnection = await this._createPeerConnection(sourceId);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        this._sendSignalingMessage({ type: 'answer', targetId: sourceId, sourceId: this.instanceId, answer });
    }

    /**
     * Handles an incoming WebRTC answer from a peer.
     * @private
     * @param {object} payload - The answer payload.
     * @param {string} payload.sourceId - The sender's instance ID.
     * @param {RTCSessionDescriptionInit} payload.answer - The SDP answer.
     */
    async _handleAnswer({ sourceId, answer }) {
        const peerConnection = this.peers.get(sourceId);
        if (peerConnection) await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }

    /**
     * Handles an incoming ICE candidate from a peer.
     * @private
     * @param {object} payload - The candidate payload.
     * @param {string} payload.sourceId - The sender's instance ID.
     * @param {RTCIceCandidateInit} payload.candidate - The ICE candidate.
     */
    async _handleCandidate({ sourceId, candidate }) {
        const peerConnection = this.peers.get(sourceId);
        if (peerConnection?.remoteDescription && candidate) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('Error adding ICE candidate', e);
            }
        }
    }

    /**
     * Sends a message to a target instance, using BroadcastChannel, WebRTC, or WebSocket as appropriate.
     * @param {string} targetId - The recipient's instance ID.
     * @param {string} type - The message type (e.g., 'direct_message', 'ping').
     * @param {*} data - The message data.
     */
    async sendMessage(targetId, type, data) {
        const payload = { sourceId: this.instanceId, targetId, type, data, timestamp: Date.now() };

        this.channel.postMessage(payload);

        if (this.remoteInstances.has(targetId)) {
            let peerConnection = this.peers.get(targetId);
            if (!peerConnection || peerConnection.connectionState !== 'connected') {
                peerConnection = await this._createPeerConnection(targetId);
                const dataChannel = peerConnection.createDataChannel('oopisos-datachannel');
                this._setupDataChannel(dataChannel, targetId);

                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                this._sendSignalingMessage({ type: 'offer', targetId, sourceId: this.instanceId, offer });
            }

            const getDataChannel = () => {
                for (const [, pc] of this.peers) {
                    if (pc.sctp) {
                        const transport = pc.sctp.transport;
                        if (transport && transport.transport) {
                            const dataChannels = transport.transport.dataChannels;
                            if (dataChannels) {
                                const dc = Array.from(dataChannels).find(c => c.label === 'oopisos-datachannel');
                                if (dc) return dc;
                            }
                        }
                    }
                }
                return null;
            };

            const waitForDataChannel = new Promise((resolve, reject) => {
                const check = () => {
                    const dc = getDataChannel();
                    if (dc && dc.readyState === 'open') {
                        resolve(dc);
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
                setTimeout(() => reject(new Error('Data channel timeout')), 5000);
            });

            try {
                const dc = await waitForDataChannel;
                dc.send(JSON.stringify(payload));
            } catch (error) {
                console.error(`WebRTC send failed to ${targetId}:`, error);
                this._sendSignalingMessage(payload);
            }
        } else if (this.websocket.readyState === WebSocket.OPEN) {
            this._sendSignalingMessage(payload);
        }
    }

    /**
     * Processes an incoming message, handling ping/pong and routing to the listen callback or message queue.
     * @private
     * @param {object} payload - The message payload.
     */
    _processIncomingMessage(payload) {
        const { sourceId, targetId, type, data, timestamp } = payload;
        if (targetId !== this.instanceId && targetId !== 'broadcast') return;

        if (type === 'pong') {
            const callback = this.pingCallbacks.get(sourceId);
            if (callback) {
                callback(Date.now() - timestamp);
                this.pingCallbacks.delete(sourceId);
            }
            return;
        }

        if (type === 'ping') {
            this.sendMessage(sourceId, 'pong', 'PONG');
            return;
        }

        if (this.listenCallback) {
            this.listenCallback(payload);
        } else {
            this.messageQueue.push(payload);
        }
    }

    /**
     * Sends a ping to a target instance and returns a promise that resolves with the round-trip time.
     * @param {string} targetId - The instance ID to ping.
     * @returns {Promise<number>} A promise that resolves with the RTT in milliseconds.
     */
    sendPing(targetId) {
        return new Promise((resolve, reject) => {
            this.pingCallbacks.set(targetId, resolve);
            this.sendMessage(targetId, 'ping', 'PING');
            setTimeout(() => {
                if (this.pingCallbacks.has(targetId)) {
                    this.pingCallbacks.delete(targetId);
                    reject(new Error('Ping timed out'));
                }
            }, 5000);
        });
    }

    /**
     * Retrieves the next message from the message queue.
     * @returns {object|null} The next message payload, or null if the queue is empty.
     */
    getNextMessage() {
        return this.messageQueue.shift() || null;
    }
}