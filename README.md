# Entropy_peace
**week01:**

Choose a technical framework:

- Node.js as backend and three.js as frontend.
- [sokcet.io](http://sokcet.io) for communication of client and sever
- ejs template for dynamic render page
- ~~redis handle the game logic running(~~Deprecated)

week02-week03:

backend buildup

- ~~battle sever and main sever communicate each other(~~Deprecated)
- Class 'room' store the battle message
- [socket.io](http://socket.io) event listener the request
- middle ware for handing the web post object
- use ejs transform information to next page to init the game
- auto destroy the ending room and release memory

week04-week05:

- init the game scene at client.
- add a BGM
- add the interaction and control panel(using the CSS2DOBJECT from three.js) for the game
- [socket.io](http://socket.io) communicate with sever(Update the GUI and Message from sever)
- add a GLTF model as a scene
- add a small animation

A known BUG list:

- BGM sometime can not auto play as the media policy from chrome
- Asynchronous loading of the model caused the game to start but the scene has not been initialized
- The inconsistency between the game player amount interface and the actual  player amount
- GUI display dislocation
- There is a very small delay in updating game information
- Player ranking need to be updated
- Optimization of some user experience details