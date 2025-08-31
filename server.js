const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Pairing logic (random chat)
  if (waitingUser) {
    socket.partner = waitingUser;
    waitingUser.partner = socket;

    socket.emit("connected", "You are now chatting with a stranger!");
    waitingUser.emit("connected", "You are now chatting with a stranger!");

    waitingUser = null;
  } else {
    waitingUser = socket;
    socket.emit("waiting", "Waiting for a stranger to join...");
  }

  // Text message (server adds timestamp and forwards)
  socket.on("message", (msg) => {
    if (socket.partner) {
      const data = {
        text: msg,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      socket.partner.emit("message", data);
    }
  });

  // Typing indicator
  socket.on("typing", () => {
    if (socket.partner) socket.partner.emit("typing");
  });
  socket.on("stopTyping", () => {
    if (socket.partner) socket.partner.emit("stopTyping");
  });

  // New Chat: put both back into waiting queue appropriately
  socket.on("newChat", () => {
    if (socket.partner) {
      // Tell partner that stranger left and put them back to waiting
      socket.partner.emit("message", { text: "Stranger left. Searching new...", time: "" });
      socket.partner.partner = null;
      waitingUser = socket.partner;
    }
    // Make current socket waiting again
    socket.partner = null;
    waitingUser = socket;
    socket.emit("waiting", "Waiting for a stranger to join...");
  });

  // ------- WebRTC Signaling (video chat) -------
  socket.on("offer", (offer) => {
    if (socket.partner) {
      socket.partner.emit("offer", offer);
    }
  });

  socket.on("answer", (answer) => {
    if (socket.partner) {
      socket.partner.emit("answer", answer);
    }
  });

  socket.on("ice-candidate", (candidate) => {
    if (socket.partner) {
      socket.partner.emit("ice-candidate", candidate);
    }
  });

  socket.on("stopVideo", () => {
    if (socket.partner) {
      socket.partner.emit("stopVideo");
    }
  });

  // Disconnect handling
  socket.on("disconnect", () => {
    if (socket.partner) {
      socket.partner.emit("message", { text: "Stranger disconnected.", time: "" });
      socket.partner.partner = null;
    } else if (waitingUser === socket) {
      waitingUser = null;
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
