import { io } from "socket.io-client";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const SOCKET_URL = BACKEND.replace(/\/+$/, "");

const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});

export default socket;
