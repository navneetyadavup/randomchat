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

  if (waitingUser) {
    // Connect two users
    socket.partner = waitingUser;
    waitingUser.partner = socket;

    socket.emit("connected", "You are now chatting with a stranger!");
    waitingUser.emit("connected", "You are now chatting with a stranger!");

    waitingUser = null;
  } else {
    waitingUser = socket;
    socket.emit("waiting", "Waiting for a stranger to join...");
  }

  // ✅ Message with timestamp
  socket.on("message", (msg) => {
    if (socket.partner) {
      const data = {
        text: msg,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      socket.partner.emit("message", data);
    }
  });

  // ✅ Typing indicator
  socket.on("typing", () => {
    if (socket.partner) {
      socket.partner.emit("typing");
    }
  });

  socket.on("stopTyping", () => {
    if (socket.partner) {
      socket.partner.emit("stopTyping");
    }
  });

  // ✅ New Chat feature
  socket.on("newChat", () => {
    if (socket.partner) {
      socket.partner.emit("message", { text: "Stranger left. Searching new...", time: "" });
      socket.partner.partner = null;
      waitingUser = socket.partner;
    }
    socket.partner = null;
    waitingUser = socket;
    socket.emit("waiting", "Waiting for a stranger to join...");
  });

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

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
