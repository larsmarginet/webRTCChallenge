import * as THREE from './three.module.js';
{
    // Init Three scene
    const canvas = document.querySelector('#c');
    const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
    const fov = 2;
    const aspect = 2;
    const near = 0.5;
    const far = 500;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.z = 500;
    const scene = new THREE.Scene();
    const light = new THREE.DirectionalLight( 0xffffff );
	light.position.set( 0.5, 1, 1 ).normalize();
    scene.add( light );
    const geometry = new THREE.PlaneGeometry( 25, 15, 1 );

    const $myVideo = document.getElementById('myVideo');
    const $otherVideo = document.getElementById('otherVideo');
    const $myName = document.querySelector('.videoView__videos__myName');
    const $otherName = document.querySelector('.videoView__videos__otherName');
    const $peerSelect = document.querySelector('.videoView__aside__clients');
    const $controls = document.querySelector('.videoView__videos__controls');
    const $endCall = document.querySelector('.videoView__videos__controls__end');
    const $login = document.querySelector('.loginView');
    const $form = document.querySelector('.loginView__innerWrapper__form');
    const $noiseButton = document.querySelector('.videoView__videos__controls__noise');

    let socket;
    let myStream;
    let peer;
    let clientList = {};
    let isLoggedIn = false;
    let name;
    let interval;

    const init = async () => {
        $form.addEventListener('submit', async e => {
            e.preventDefault();
            name = e.target.querySelector('.loginView__innerWrapper__form__input').value;
            isLoggedIn = true;
            if (isLoggedIn) {
                initSocket();
                const constraints = { audio: true, video: { width: 1280, height: 720 } };
                myStream = await navigator.mediaDevices.getUserMedia(constraints);
                $myVideo.srcObject = myStream;
                $myVideo.onloadedmetadata = () => $myVideo.play();
                $login.style.display = "none";
            }
        });
        requestAnimationFrame(render);
    };

    const randomBoolean = () => Math.random() >= 0.5;

    const audioRandomIntervals = noise => {
        if( noise === false ) {
            $otherVideo.muted = false;
            clearInterval(interval);
        } else {
            interval = setInterval(() => {
                $otherVideo.muted = randomBoolean();
            }, 100);
        }
    }

    const initSocket = () => {
        socket = io.connect('/');
        socket.on('connect', () => {
            console.log(socket);
        });
        socket.emit('name', name);
        socket.on('name', name => {
            $myName.textContent = name;
        });
        socket.on('noise', noise => {
            audioRandomIntervals(noise);
            uniforms.playTexture.value = noise;
        })
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
            $noiseButton.addEventListener('click', handleClickNoise)
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

    const fragmentShader = `
        #include <common>
        varying vec2 vUv;
        uniform vec3 iResolution;
        uniform float iTime;
        uniform sampler2D iChannel0;  
        uniform sampler2D iChannel1;  
        uniform bool playTexture; 

        //Based on donmilham's shader on Shadertoy: https://www.shadertoy.com/view/MlBGRh

        //Checks which version because it otherwise doenst work on apple devices...
        #if __VERSION__ < 130
        #define TEXTURE2D texture2D
        #else
        #define TEXTURE2D texture
        #endif
        
        void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
            vec2 uv = fragCoord.xy / iResolution.xy;
            vec4 c = TEXTURE2D(iChannel0, (.5 + -.5 * 1.0 +  uv * 1.0), 1.0);
            fragColor = c;
            vec2 offset = TEXTURE2D(iChannel1, vec2(fract(iTime * 2.0), fract(iTime)), 1.0).xy;
            (playTexture == true) ? fragColor += TEXTURE2D(iChannel1, offset + uv, .1) : fragColor = c;
        }
        void main() {
            mainImage(gl_FragColor, vUv * iResolution.xy);
        }
    `;

    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `;

    const videoTexture = new THREE.VideoTexture( $otherVideo );
    const imageTexture = new THREE.TextureLoader().load( "../assets/noise.jpg" );

    const uniforms = {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector3(1, 1, 1) },
        iChannel0: { value: videoTexture },
        iChannel1: { value: imageTexture },
        playTexture: { value: false }
    };

    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
    });

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
            const cube = new THREE.Mesh(geometry, material);
            scene.add(cube);
        });
        peer.on('noise', noise => {
            console.log(noise);
            uniforms.playTexture.value = noise;
        })
        peer.on('close', () => {
            console.log('closed');
            peer.destroy();
            peer = null;
            $controls.classList.remove('videoView__videos__controls--visible');
            $otherName.textContent = '';
            $otherVideo.srcObject.getVideoTracks().forEach(track => {
                track.stop()
                $otherVideo.srcObject.removeTrack(track);
            });
            while(scene.children.length > 0){ 
                scene.remove(scene.children[0]); 
            }
        });
        peer.on('error', () => {
            console.log('error');
        });
    };

    const handleEndCall = () => {
        peer.destroy();
    }

    const handleClickNoise = () => {
        if (uniforms.playTexture.value === false) {
            uniforms.playTexture.value = true;
        } else {
            uniforms.playTexture.value = false;
        }
        socket.emit('noise', uniforms.playTexture.value);
    }

    const render = (time) => {
        time *= 0.001;
        if (resizeRendererToDisplaySize(renderer)) {
            const canvas = renderer.domElement;
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }
        uniforms.iTime.value = time;
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    };

    const resizeRendererToDisplaySize = (renderer) => {
        const canvas = renderer.domElement;
        const pixelRatio = window.devicePixelRatio;
        const width  = canvas.clientWidth  * pixelRatio | 0;
        const height = canvas.clientHeight * pixelRatio | 0;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
          renderer.setSize(width, height, false);
        }
        return needResize;
    }
  
    init();
}