# WebRTC challenge

In this project I learned to work with WebRTC by creating a video conferencing app that prevents boring conversation to go on. 

## Concept
The concept of this video conferencing tool is that when you find the conversation boring or awkward you can fake a bad signal, which makes the video feed glitch and the audio stutter. I got the idea from funny scenes in movies in series where people fake a bad phone reception.

## ThreeJS
For the glitch effect I used ThreeJS. I put the video stream as a texture in a ThreeJS scene and added a fragmentshader which activates on the click of a button. This signal is also sent to the other user via the server, so their screen does the same thing. 
