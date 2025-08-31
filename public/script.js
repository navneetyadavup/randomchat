const socket = io();

const messagesDiv = document.getElementById("messages");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const typingDiv = document.getElementById("typing");
const newChatBtn = document.getElementById("newChatBtn");
const darkModeBtn = document.getElementById("darkModeBtn");

function appendMessage(text, time, self = false) {
  const msgDiv = document.createElement("div");
  msgDiv.className = self ? "message self" : "message";
  msgDiv.innerHTML = `<p>${text}</p> <span class="time">${time || ""}</span>`;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ✅ Server events
socket.on("waiting", (msg) => appendMessage(msg, ""));
socket.on("connected", (msg) => appendMessage(msg, ""));
socket.on("message", (data) => appendMessage(data.text, data.time));

// ✅ Typing indicator
socket.on("typing", () => {
  typingDiv.innerText = "Stranger is typing...";
});
socket.on("stopTyping", () => {
  typingDiv.innerText = "";
});

// ✅ Send message
sendBtn.addEventListener("click", () => {
  if (input.value.trim() !== "") {
    const msg = input.value;
    appendMessage(msg, new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), true);
    socket.emit("message", msg);
    input.value = "";
    socket.emit("stopTyping");
  }
});

// ✅ Typing detect
input.addEventListener("input", () => {
  if (input.value.length > 0) {
    socket.emit("typing");
  } else {
    socket.emit("stopTyping");
  }
});

// ✅ New Chat
newChatBtn.addEventListener("click", () => {
  messagesDiv.innerHTML = "";
  typingDiv.innerHTML = "";
  socket.emit("newChat");
});

// ✅ Dark Mode toggle
darkModeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});
