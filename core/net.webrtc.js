import {NostrSignalingProvider} from './net/net.signaling';

export class WebRTCService {
    constructor(app, signalingStrategy, nostrRelays, nostrPrivateKey, yDoc) {
        this.app = app;
        this.signalingStrategy = signalingStrategy;
        this.nostrRelays = nostrRelays;
        this.nostrPrivateKey = nostrPrivateKey;
        this.yDoc = yDoc;
    }

    /**
     * Establishes a direct peer-to-peer connection using WebRTC.
     * @param {string} peerId - The ID of the peer to connect to.
     */
    async connectWebRTC(peerId, isInitiator) {
        let signalingProvider;
        try {
            let relays = this.nostrRelays;
            if (this.signalingStrategy === "nostr") {
                relays = this.app.settings.webrtcNostrRelays || this.nostrRelays;
                signalingProvider = new NostrSignalingProvider(relays.split("\n").map(l => l.trim()).filter(Boolean), this.nostrPrivateKey, this.app);
            } else {
                console.error("WebRTC signaling server not implemented");
                this.app.showNotification("WebRTC signaling server not implemented", "error");
                return;
            }

            try {
                const peerConnection = new RTCPeerConnection();

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        signalingProvider.sendIceCandidate(peerId, event.candidate);
                    }
                };

                signalingProvider.onIceCandidateReceived((remotePeerId, candidate) => {
                    peerConnection.addIceCandidate(candidate);
                });

                if (isInitiator) {
                    // Initiator creates offer
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);

                    signalingProvider.initiateConnection(peerId, async (remoteAnswer) => {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
                    });

                    signalingProvider.sendOffer(peerId, offer.sdp);

                } else {
                    // Receiver accepts offer
                    signalingProvider.onOfferReceived(async (remotePeerId, remoteOffer) => {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteOffer));
                        const answer = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);

                        signalingProvider.acceptConnection(peerId, async (remoteAnswer) => {
                            await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
                        });

                        signalingProvider.sendAnswer(peerId, answer.sdp);
                    });
                }

                //Data Channel
                const dataChannel = peerConnection.createDataChannel("dataChannel");
                dataChannel.onopen = () => {
                }
                dataChannel.onmessage = (event) => {
                };

                // Yjs provider
                import('y-webrtc').then(({WebrtcProvider}) => {
                    const webrtcProvider = new WebrtcProvider(
                        'netention-demo',
                        this.yDoc,
                        peerConnection
                    );
                });

            } catch (error) {
                console.error("Error in connectWebRTC:", error);
                this.app.showNotification(`Error in connectWebRTC: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error("Error creating signaling provider:", error);
            this.app.showNotification(`Error creating signaling provider: ${error.message}`, 'error');
        }
    }

    /**
     * Handles incoming WebRTC data channel messages.
     * @param {MessageEvent} event - The message event.
     */
    handleWebRTCMessage(event) {
        // TODO: Process incoming WebRTC message
    }
}