import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, Timestamp, limit
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCW8R3vHcAxld6X4fAU7wYPJbxeYvbpAi8",
  authDomain: "healtharchive-a07ca.firebaseapp.com",
  projectId: "healtharchive-a07ca",
  storageBucket: "healtharchive-a07ca.firebasestorage.app",
  messagingSenderId: "433356772083",
  appId: "1:433356772083:web:bd350d43b03da328e45d86"
};

const RETENTION_DAYS = 10;
const ADMIN_PASSCODE = "7835";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messagesCol = collection(db, "feedback_messages");

function getVisitorId() {
  let id = localStorage.getItem("ha_fb_visitor_id");
  if (!id) {
    id = Math.random().toString(36).slice(2, 8);
    localStorage.setItem("ha_fb_visitor_id", id);
  }
  return id;
}

function visitorLabel(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `손님${(hash % 9000) + 1000}`;
}

function visitorColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const palette = ["#6c5ce7", "#0984e3", "#00b894", "#e17055", "#d63031", "#0fb9b1", "#fd79a8", "#636e72"];
  return palette[hash % palette.length];
}

function isAdmin() {
  return sessionStorage.getItem("ha_fb_admin") === "1";
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatTime(ts) {
  if (!ts || !ts.toDate) return "";
  const d = ts.toDate();
  return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderMessages(docs) {
  const wrap = document.getElementById("fb-messages");
  const empty = document.getElementById("fb-empty");
  if (!wrap) return;

  if (!docs.length) {
    wrap.innerHTML = "";
    wrap.appendChild(empty || document.createElement("div"));
    if (empty) empty.hidden = false;
    return;
  }

  const myId = getVisitorId();
  wrap.innerHTML = docs.map(d => {
    const m = d.data();
    const isMine = m.sender === "visitor" && m.visitorId === myId;
    const isAdminMsg = m.sender === "admin";
    const bubbleClass = isAdminMsg ? "fb-bubble fb-bubble-admin" : (isMine ? "fb-bubble fb-bubble-me" : "fb-bubble fb-bubble-other");
    const rowClass = isAdminMsg ? "fb-row fb-row-admin" : (isMine ? "fb-row fb-row-me" : "fb-row fb-row-other");
    const label = isAdminMsg ? "관리자" : visitorLabel(m.visitorId || "");
    const color = isAdminMsg ? "#3a3a3a" : visitorColor(m.visitorId || "");
    const showLabel = !isMine;
    return `
      <div class="${rowClass}">
        ${showLabel ? `<div class="fb-sender" style="color:${color}">${escapeHtml(label)}</div>` : ""}
        <div class="${bubbleClass}">${escapeHtml(m.text)}</div>
        <div class="fb-time">${formatTime(m.createdAt)}</div>
      </div>`;
  }).join("");
  wrap.scrollTop = wrap.scrollHeight;
}

function subscribeMessages() {
  const cutoff = Timestamp.fromMillis(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const q = query(
    messagesCol,
    where("createdAt", ">=", cutoff),
    orderBy("createdAt", "asc"),
    limit(500)
  );
  onSnapshot(q, snap => {
    renderMessages(snap.docs);
  }, err => {
    const wrap = document.getElementById("fb-messages");
    if (wrap) wrap.innerHTML = `<div class="fb-empty">메시지를 불러오지 못했습니다. (${escapeHtml(err.message)})</div>`;
  });
}

async function sendMessage(text) {
  const trimmed = text.trim().slice(0, 200);
  if (!trimmed) return;
  await addDoc(messagesCol, {
    text: trimmed,
    sender: isAdmin() ? "admin" : "visitor",
    visitorId: getVisitorId(),
    createdAt: serverTimestamp()
  });
}

function setupComposer() {
  const input = document.getElementById("fb-input");
  const sendBtn = document.getElementById("fb-send");
  const count = document.getElementById("fb-count");
  if (!input || !sendBtn) return;

  input.addEventListener("input", () => {
    count.textContent = String(input.value.length);
  });

  async function doSend() {
    const text = input.value;
    if (!text.trim()) return;
    sendBtn.disabled = true;
    try {
      await sendMessage(text);
      input.value = "";
      count.textContent = "0";
    } catch (e) {
      alert("전송에 실패했습니다: " + e.message);
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener("click", doSend);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });
}

function setupAdminToggle() {
  const titleEl = document.getElementById("fb-admin-toggle");
  const banner = document.getElementById("fb-admin-banner");
  const exitBtn = document.getElementById("fb-admin-exit");
  if (!titleEl) return;

  function reflect() {
    if (banner) banner.hidden = !isAdmin();
  }

  titleEl.addEventListener("click", () => {
    if (isAdmin()) return;
    const pw = prompt("관리자 비밀번호를 입력하세요");
    if (pw === null) return;
    if (pw === ADMIN_PASSCODE) {
      sessionStorage.setItem("ha_fb_admin", "1");
      reflect();
    } else {
      alert("비밀번호가 올바르지 않습니다.");
    }
  });

  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      sessionStorage.removeItem("ha_fb_admin");
      reflect();
    });
  }

  reflect();
}

document.addEventListener("DOMContentLoaded", () => {
  setupComposer();
  setupAdminToggle();
  subscribeMessages();
});
