// Socket
const socket = io();

// Elements
const statusDiv = document.getElementById("status");
const messagesDiv = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const newChatBtn = document.getElementById("newChatBtn");
const darkModeBtn = document.getElementById("darkModeBtn");

// Video elements
const startVideoBtn = document.getElementById("startVideoBtn");
const stopVideoBtn = document.getElementById("stopVideoBtn");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let typingTimeout;
let peerConnection = null;
let localStream = null;

const pcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

// ---------------- UI helpers ----------------
function appendMessage(text, time, self = false) {
  const el = document.createElement("div");
  el.className = "message " + (self ? "self" : "other");
  el.innerHTML = `<div>${escapeHtml(text)}</div><span class="meta">${time || ""}</span>`;
  messagesDiv.appendChild(el);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe.replace(/[&<"'>]/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[m]);
}

// ---------------- Socket events ----------------
socket.on("waiting", (msg) => {
  statusDiv.innerText = msg;
});

socket.on("connected", (msg) => {
  statusDiv.innerText = msg;
});

socket.on("message", (data) => {
  // data: { text, time }
  appendMessage(data.text, data.time, false);
  typingDiv.innerText = "";
});

socket.on("typing", () => {
  typingDiv.innerText = "Stranger is typing...";
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => { typingDiv.innerText = ""; }, 2000);
});

socket.on("stopTyping", () => {
  typingDiv.innerText = "";
});

// ------- WebRTC signaling handlers -------
socket.on("offer", async (offer) => {
  // If a peerConnection exists, close it first
  if (peerConnection) {
    try { peerConnection.close(); } catch(e){}
    peerConnection = null;
  }
  await prepareLocalStream(); // ensures localStream exists and video shown
  createPeerConnection();

  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", answer);
    console.log("Sent answer");
    startVideoBtn.disabled = true;
    stopVideoBtn.disabled = false;
  } catch (err) {
    console.error("Error handling offer", err);
  }
});

socket.on("answer", async (answer) => {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log("Received answer, connection should establish");
  } catch (err) {
    console.error("Error setting remote description (answer)", err);
  }
});

socket.on("ice-candidate", async (candidate) => {
  try {
    if (peerConnection && candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (e) {
    console.warn("Failed to add ICE candidate", e);
  }
});

socket.on("stopVideo", () => {
  stopLocalVideo();
});

// ---------------- Chat send & typing ----------------
sendBtn.addEventListener("click", () => {
  sendMessage();
});
input.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") sendMessage();
});
input.addEventListener("input", () => {
  if (input.value.length > 0) socket.emit("typing");
  else socket.emit("stopTyping");
});

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
  // show locally
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  appendMessage(text, time, true);
  socket.emit("message", text);
  input.value = "";
  socket.emit("stopTyping");
}

// ---------------- New Chat / Dark Mode ----------------
newChatBtn.addEventListener("click", () => {
  // Reset UI
  messagesDiv.innerHTML = "";
  typingDiv.innerText = "";
  socket.emit("newChat");
  // stop any video calls
  stopLocalVideo();
});

darkModeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});

// ---------------- WebRTC functions ----------------
async function prepareLocalStream() {
  if (localStream) return;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (e) {
    console.error("Could not get user media", e);
    alert("Camera/microphone access is required for video chat.");
    throw e;
  }
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(pcConfig);

  // Add local tracks
  if (localStream) {
    for (const track of localStream.getTracks()) {
      peerConnection.addTrack(track, localStream);
    }
  }

  // Remote track
  peerConnection.ontrack = (ev) => {
    // Attach remote stream
    remoteVideo.srcObject = ev.streams[0];
  };

  // ICE candidate
  peerConnection.onicecandidate = (ev) => {
    if (ev.candidate) {
      socket.emit("ice-candidate", ev.candidate);
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log("PC state:", peerConnection.connectionState);
    if (peerConnection.connectionState === "disconnected" || peerConnection.connectionState === "failed") {
      stopLocalVideo();
    }
  };
}

startVideoBtn.addEventListener("click", async () => {
  try {
    await prepareLocalStream();
    createPeerConnection();

    // Create offer (initiator)
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", offer);

    startVideoBtn.disabled = true;
    stopVideoBtn.disabled = false;
  } catch (e) {
    console.error("Start video failed", e);
  }
});

stopVideoBtn.addEventListener("click", () => {
  socket.emit("stopVideo");
  stopLocalVideo();
});

function stopLocalVideo() {
  // close peer connection
  try {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
  } catch (e) {}
  // stop local tracks
  try {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
  } catch (e) {}
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  startVideoBtn.disabled = false;
  stopVideoBtn.disabled = true;
}
