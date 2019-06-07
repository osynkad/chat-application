import React, { useEffect } from 'react';
import Channels from './Channels';
import Users from './Users';
import Chat from './Chat';
import './Lobby.css';
import io from 'socket.io-client';
import { user$ } from '../Store';

function Lobby() {
  const socket = io.connect('http://localhost:8000');

  socket.emit('user-connect', ({
    user: user$.value
  }));

  //disconnect on unmount

  socket.on('chat', (data) => {
    console.log(data.message + " from lobby.js");
  })

  return (
    <div className="lobby">
      <Channels socket={socket}/>
      <Chat socket={socket}/>
      <Users socket={socket}/>
    </div>
  );
}

export default Lobby;
