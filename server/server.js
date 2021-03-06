const fs = require('fs');
const logs = require('./logs.json');
const users = require('./users.json');
const cfg = require('./config.json');
const express = require('express');
const crypto = require('crypto');
const app = express();
const uuid = require('uuid/v4');

const socket = require('socket.io');
const port = cfg.website.port;
const server = app.listen(port, () => console.log(`Listening on ${port}`));
const io = socket(server);


io.on('connection', (socket) => {
  console.log('Connection established: ' + socket.id, "- Sockets connected: " + Object.keys(io.sockets.sockets).length);
  
  socket.on('chat', (data, cb) => {
    let a = {id: uuid(), ...data};
    cb(a);
    socket.in(data.room).emit('chat', a);
  })

  socket.on('join', room => {
    socket.join(room);
  });

  socket.on('leave', room => {
    socket.leave(room);
  })

  socket.on('channel', (data) => {
    io.sockets.emit('channel', logs);
  })
})

function writeFile (file) {
  return new Promise((resolve, reject) => {
    let a = (file.includes("logs")) ? logs : users;

    fs.writeFile(file, JSON.stringify(a), (err) => {
      if (err) throw err;
      resolve();
    })
  })
}

app.use(express.json());

app.get("/validate/:username", (req, res) => {
  const exists = users.users.some(user => user.username === req.params.username);
  if (!exists) {
    res.status(200).end();
  } else {
    res.send("user already exists");
  }
})

app.post("/login", (req, res) => {
  crypto.pbkdf2(req.body.password, 'emilsfetaserver', 100000, 64, 'sha512', (err, derivedKey) => {
    if (err) throw err;
    let user = {username: req.body.username, password: derivedKey.toString('hex')};
    if (users.users.length < 1) {
      users.users.push(user);
      writeFile('./server/users.json')
        .then(() => {
          res.status(201).send("registered!");
        })
    } else {
      const exists = users.users.some(user => user.username === req.body.username);
      if (exists) {
        for (let u of users.users) {
          if (u.username === req.body.username) {
            if (u.password === derivedKey.toString('hex')) {
              res.status(200).send("logged in");
            } else {
              res.status(401).send("invalid username or password...");
            }
          }
        }
      } else { //username doesn't exist, therefore we added the user
        users.users.push(user);
        writeFile('./server/users.json')
          .then(() => {
            res.status(201).send("registered!");
          })
      }
    }
  });
})

app.get("/channels", (req, res) => {
  res.status(200).send(logs);
})

app.post("/channels", (req, res) => {
  if (!req.body.name) {
    res.status(400).send("a channel name must be provided");
    return;
  }

  for (let x of logs.logs) {
    if (x.name === req.body.name) {
      res.status(409).send("room already exists")
      return;
    }
  }

  const room = {
    id: uuid(),
    name: req.body.name,
    users: [],
    messages: []
  }

  logs.logs.push(room);

  writeFile('./server/logs.json')
    .then(() => {
      res.status(200).send(room);
    })
})

app.delete("/channels/:id", (req, res) => {
  if (!req.params.id) {
    res.status(400).send("a room id must be provided");
    return;
  }

  for (let chan of logs.logs) {
    if (chan.id === req.params.id) {
      logs.logs.splice(logs.logs.indexOf(chan), 1);
      writeFile('./server/logs.json')
        .then(() => {
          res.status(204).end();
          io.sockets.emit('channel', logs);
        })
      return;
    }
  }

  res.status(404).send("id provided does not match any of the rooms");
})

app.get("/messages/:id", (req, res) => {
  for(let x of logs.logs) {
    if (x.id === req.params.id) {
      res.status(200).send(x.messages);
      return;
    }
  }

  res.status(404).send("id provided does not match any of the rooms");
})

app.post("/messages/:id", (req, res) => {
  //how can i validate that a the person making requests is the person that has logged in
  if(!req.body.user) {
    res.status(400).send("you must be logged in to send messages!");
    return;
  }

  if (req.body.message && req.body.user && req.params.id) {
    const msg = {
      timestamp: new Date(),
      id: uuid(),
      user: req.body.user,
      message: req.body.message
    }

    for (let channel of logs.logs) {
      if(channel.id === req.params.id) {
        if (!channel.users.includes(req.body.user)) {
          channel.users.push(req.body.user);
        }
        channel.messages.push(msg);
        writeFile('./server/logs.json')
          .then(() => {
            res.status(200).send(msg);
          })
      }
    }
  } else {
    res.status(400).send("a message and room id must be provided");
  }
});