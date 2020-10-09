{
    const $video = document.getElementById('myVideo');
    const $otherVideo = document.getElementById('otherVideo');
    const $otherSocketIds = document.getElementById('otherSocketIds');
    let socket;
    let peer;
    let connectedPeerId;
    let myStream;

    const init = async () => {
        myStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        $video.srcObject = myStream;

        $otherSocketIds.addEventListener('input', callSelectedPeer)

        socket = io();
        socket.on('connect', () => {
            console.log('connected');
        })
        socket.on('clients', clients => {
            console.log(clients);
            $otherSocketIds.innerHTML = '<option value="">---select another peer---</option>';
            for (const otherSocketId in clients) {
                if (clients.hasOwnProperty(otherSocketId)) {
                    const otherClient = clients[otherSocketId];
                    if (otherClient.id !== socket.id) {
                        const $option = document.createElement(`option`);
                        $option.value = otherClient.id;
                        $option.textContent = otherClient.id;
                        $otherSocketIds.appendChild($option);
                    }
                }
            }
        })
        socket.on('signal', async (myId, signal, peerId) => {
            if (signal.type === 'offer' && !peer) {
                await handlePeerOffer(myId, signal, peerId)
            }
            peer.signal(signal);
        });

        socket.on(('client-disconnect', socketId => {
            connectedPeerId == peerId;
            if (peer) {
                peer.destroy();
                peer = null;
            }
        }))
    }

    const callSelectedPeer = () => {
        if($otherSocketIds.value === "") {
            return
        }
        console.log(`call selected peer= ${$otherSocketIds.value}`)
        callPeer(otherSocketIds.value);
    }

    const callPeer = async peerId => {
        peer = new SimplePeer({ initiator: true, stream: myStream });
        connectedPeerId = peerId;
        peer.on('signal', signal => {
            socket.emit('signal', peerId, signal);
        });
        peer.on('stream', stream => {
            $otherVideo.srcObject = stream;
        });
    }

    const handlePeerAnswer = async (myId, answer, peerId) => {
        console.log(`Recieved anwser from ${peerId}`);
        console.log(answer);
        await peerConnection.setRemoteDescription(answer);
    }

    const handlePeerIce = async (myId, candidate, peerId) => {
        console.log(`Recieved candidate from ${peerId}`)
        console.log(candidate);
        if(!candidate) {
            return;
        }
        await peerConnection.addIceCandidate(candidate);
    }

    const handlePeerOffer = async (myId, offer, peerId) => {
        peer = new SimplePeer({ initiator: false, stream: myStream});
        connectedPeerId = peerId;
        peer.on('signal', signal => {
            socket.emit('signal', peerId, signal);
        });
        peer.on('stream', stream => {
            $otherVideo.srcObject = stream;
        });
    }

    init();
}