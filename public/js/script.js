{
    let isLoggedIn = false;
    let name;


    const $myVideo = document.getElementById('myVideo');
    const $otherVideo = document.getElementById('otherVideo');
    const $myName = document.querySelector('.videoView__videos__myName');
    const $otherName = document.querySelector('.videoView__videos__otherName');
    const $peerSelect = document.querySelector('.videoView__aside__clients');
    const $controls = document.querySelector('.videoView__videos__controls');
    const $endCall = document.querySelector('.videoView__videos__controls__end');
    const $login = document.querySelector('.loginView');
    const $form = document.querySelector('.loginView__innerWrapper__form');

    let socket;
    let myStream;
    let peer;
    let clientList = {};

    const init = async () => {
        $form.addEventListener('submit', async e => {
            e.preventDefault();
            name = e.target.querySelector('.loginView__innerWrapper__form__input').value;
            isLoggedIn = true;
            if (isLoggedIn) {
                initSocket();
                console.log("submitted form")
                const constraints = { audio: true, video: { width: 1280, height: 720 } };
                myStream = await navigator.mediaDevices.getUserMedia(constraints);
                $myVideo.srcObject = myStream;
                $myVideo.onloadedmetadata = () => $myVideo.play();
                $login.style.display = "none";
            }
        });
    };


    const initSocket = () => {
        socket = io.connect('/');
        socket.on('connect', () => {
            console.log(socket);
        });
        socket.emit('name', name);
        socket.on('name', name => {
            $myName.textContent = name;
            
        });
        socket.on('clients', updatePeerList);
        socket.on('client-disconnect', (client) => {
            if (peer && peer.data.id === client.id) {
                peer.destroy();
            }
        });
        socket.on('signal', async (myId, signal, peerId) => {
            $otherName.textContent = clientList[peerId].name;
            $controls.classList.add("videoView__videos__controls--visible");
            $endCall.addEventListener('click', handleEndCall)
            console.log(`Received signal from ${peerId}`);
            console.log(signal);
            if (peer) {
                peer.signal(signal);
            } else if (signal.type === 'offer') {
                createPeer(false, peerId);
                peer.signal(signal);
            }
        });
    };

    const updatePeerList = (clients) => {
        clientList = clients;
        $peerSelect.innerHTML = '';
        for (const clientId in clients) {
            const isMyOwnId = (clientId === socket.id);
            if (clients.hasOwnProperty(clientId) && !isMyOwnId) {  
                const client = clients[clientId];
                const $li = document.createElement('li');
                $li.setAttribute('data-id', clientId);
                $li.classList.add('videoView__aside__clients__client');
                $li.innerHTML = `
                        <p>${client.name}</p>
                        <button data-id="${clientId}" class="videoView__aside__clients__client__callbtn">
                            <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12.5" cy="12.5" r="12.5" fill="#6FCF97"/>
                                <path d="M8.42886 8.42857H14.1426C14.9311 8.42857 15.5714 9.068 15.5714 9.85743V15.5711C15.5714 16.3597 14.932 17 14.1426 17H8.42886C7.64029 17 7 16.3606 7 15.5711V9.85743C7 9.06886 7.63943 8.42857 8.42886 8.42857Z" fill="white"/>
                                <path d="M12.4892 13.3117L17.9432 16.4763C18.4061 16.7446 19.0001 16.4197 19.0001 15.8789V9.54971C19.0001 9.00971 18.4061 8.684 17.9432 8.95314L12.4892 12.1177C12.3839 12.1778 12.2964 12.2647 12.2355 12.3695C12.1746 12.4744 12.1426 12.5935 12.1426 12.7147C12.1426 12.8359 12.1746 12.955 12.2355 13.0599C12.2964 13.1647 12.3839 13.2516 12.4892 13.3117V13.3117Z" fill="white"/>
                            </svg>
                        </button>
                    `;
                $li.querySelector('.videoView__aside__clients__client__callbtn').addEventListener('click', callSelectedPeer);
                $peerSelect.appendChild($li);
            }
        }
    };

    const callSelectedPeer = async e => {
        const $client = e.currentTarget.dataset.id;
        if (!$client) {
            if (peer) {
            peer.destroy();
            return;
            }
        }
        console.log('call selected peer', $client);
        createPeer(true, $client);
    };

    const createPeer = (initiator, peerId) => {
        peer = new SimplePeer({ initiator, stream: myStream });
            peer.data = {
            id: peerId
        };
        peer.on('signal', data => {
            socket.emit('signal', peerId, data);
        });
        peer.on('stream', stream => {
            $otherVideo.srcObject = stream;
        });
        peer.on('close', () => {
            console.log('closed');
            peer.destroy();
            peer = null;
            $controls.classList.remove('videoView__videos__controls--visible');
            $otherName.textContent = '';
            $otherVideo.srcObject.getVideoTracks().forEach(track => {
                track.stop()
                video.srcObject.removeTrack(track);
            });
        });
        peer.on('error', () => {
            console.log('error');
        });
    };

    const handleEndCall = () => {
        peer.destroy();
    }

    init();
}