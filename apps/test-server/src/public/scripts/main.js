const CHATFORM = document.getElementById("chat-form");
const CHATHISTORY = document.getElementById("chat-history");
const CHATLOADING = document.getElementById("chat-loading");
const CHATINFO = document.getElementById("chat-info");
const CHATMESSAGE = document.getElementById("message-input");

CHATMESSAGE.focus();

const getRandomID = () => {
  return Math.random().toString(36).substr(2, 9);
};

window.conversation_id =
  sessionStorage.getItem("conversation_id") || getRandomID();

sessionStorage.setItem("conversation_id", window.conversation_id);

const renderChatInfo = () => {
  CHATINFO.innerText = `Conversation ID: ${window.conversation_id}`;
};

renderChatInfo();

const chatHistory = [];

const renderChatHistory = () => {
  CHATHISTORY.innerHTML = "";
  chatHistory.forEach((chat) => {
    const chatItem = document.createElement("li");
    chatItem.classList.add("chat-item");
    if (chat.type) {
      chatItem.classList.add(chat.type);
    }
    chatItem.classList.add(chat.role);
    chatItem.innerText = chat.content;
    CHATHISTORY.appendChild(chatItem);
  });
  CHATHISTORY.scrollTop = CHATHISTORY.scrollHeight;
};

renderChatHistory();

const renderChatLoading = (state) => {
  if (state) {
    CHATLOADING.style.display = "block";
  } else {
    CHATLOADING.style.display = "none";
  }
};

CHATFORM.addEventListener("submit", (e) => {
  e.preventDefault();
  const MESSAGE = e.target.elements.message.value;
  chatHistory.push({
    role: "user",
    content: MESSAGE,
  });
  renderChatHistory();
  renderChatLoading(true);
  e.target.elements.message.value = "";
  let agentId = "";
  if (MESSAGE.startsWith("#")) {
    // match agent id in #agent_id
    agentId = MESSAGE.match(/#(\w+)/)[1];
  }

  const body = JSON.stringify({
    message: MESSAGE,
    conversationId: window.conversation_id,
    agent: agentId,
  });

  console.log("Sending body: ", body);

  fetch("/assistant/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
});

window.socket.on("assistant-message", (message) => {
  chatHistory.push({
    role: "assistant",
    content: message.content,
    ...message,
  });
  renderChatHistory();
  renderChatLoading(false);
});

// * FETCH CONVERSATION HISTORY
(async () => {
  const response = await fetch(
    `/assistant/history?conversation_id=${window.conversation_id}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  const data = await response.json();
  chatHistory.push(...data.data);
  renderChatHistory();
})();
