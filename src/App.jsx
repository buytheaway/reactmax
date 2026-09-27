import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  MessageCircle,
  Plus,
  Send,
  Settings,
  UserRound,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import "./style.css";

const STORAGE_KEY = "max-green-api-chat";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizePhone(value) {
  return value.replace(/[^\d]/g, "");
}

function formatTime(timestamp) {
  const date = timestamp
    ? new Date(timestamp * 1000)
    : new Date();

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function App() {
  const saved = loadState();

  const [idInstance, setIdInstance] = useState(
    saved.idInstance || ""
  );

  const [apiTokenInstance, setApiTokenInstance] = useState(
    saved.apiTokenInstance || ""
  );

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const [chats, setChats] = useState(saved.chats || []);
  const [activeChatId, setActiveChatId] = useState(
    saved.activeChatId || null
  );

  const [message, setMessage] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);

  const pollingRef = useRef(false);
  const messagesEndRef = useRef(null);

  const activeChat = chats.find(
    (chat) => chat.id === activeChatId
  );

  useEffect(() => {
    saveState({
      idInstance,
      apiTokenInstance,
      chats,
      activeChatId
    });
  }, [
    idInstance,
    apiTokenInstance,
    chats,
    activeChatId
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [activeChat?.messages]);

  async function connect() {
    setError("");

    if (!idInstance.trim() || !apiTokenInstance.trim()) {
      setError("Введите idInstance и apiTokenInstance");
      return;
    }

    setConnecting(true);

    try {
      const response = await fetch("/api/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idInstance,
          apiTokenInstance
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Ошибка подключения"
        );
      }

      setConnected(true);
      setShowSettings(false);
    } catch (e) {
      setConnected(false);
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  }

  function createChat(e) {
    e.preventDefault();

    const phone = normalizePhone(newPhone);

    if (!phone) {
      setError("Введите номер телефона");
      return;
    }

    const existing = chats.find(
      (chat) => chat.id === phone
    );

    if (existing) {
      setActiveChatId(existing.id);
    } else {
      const chat = {
        id: phone,
        phone,
        name: phone,
        messages: []
      };

      setChats((current) => [chat, ...current]);
      setActiveChatId(phone);
    }

    setNewPhone("");
    setShowNewChat(false);
    setMobileChat(true);
    setError("");
  }

  async function sendMessage(e) {
    e?.preventDefault();

    if (!connected || !activeChat) return;

    const text = message.trim();

    if (!text) return;

    const localId = `local-${Date.now()}`;

    setChats((current) =>
      current.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              messages: [
                ...chat.messages,
                {
                  id: localId,
                  text,
                  outgoing: true,
                  timestamp: Math.floor(
                    Date.now() / 1000
                  ),
                  status: "sending"
                }
              ]
            }
          : chat
      )
    );

    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idInstance,
          apiTokenInstance,
          chatId: activeChat.id,
          message: text
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Ошибка отправки"
        );
      }

      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                messages: chat.messages.map((item) =>
                  item.id === localId
                    ? {
                        ...item,
                        id:
                          data.result?.idMessage ||
                          localId,
                        status: "sent"
                      }
                    : item
                )
              }
            : chat
        )
      );
    } catch (e) {
      setError(e.message);

      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                messages: chat.messages.map((item) =>
                  item.id === localId
                    ? {
                        ...item,
                        status: "error"
                      }
                    : item
                )
              }
            : chat
        )
      );
    }
  }

  async function deleteNotification(receiptId) {
    try {
      await fetch("/api/delete-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idInstance,
          apiTokenInstance,
          receiptId
        })
      });
    } catch {}
  }

  async function receiveOnce() {
    if (!connected || pollingRef.current) {
      return;
    }

    pollingRef.current = true;

    try {
      const response = await fetch("/api/receive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idInstance,
          apiTokenInstance
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Ошибка получения"
        );
      }

      const notification = data.notification;

      if (!notification) return;

      const body = notification.body;

      if (
        body?.typeWebhook !==
        "incomingMessageReceived"
      ) {
        await deleteNotification(
          notification.receiptId
        );
        return;
      }

      if (
        body?.messageData?.typeMessage !==
        "textMessage"
      ) {
        await deleteNotification(
          notification.receiptId
        );
        return;
      }

      const text =
        body?.messageData?.textMessageData?.textMessage;

      const chatId = body?.senderData?.chatId;

      if (!text || !chatId) {
        await deleteNotification(
          notification.receiptId
        );
        return;
      }

      const senderName =
        body?.senderData?.senderName || chatId;

      const timestamp =
        body?.timestamp ||
        Math.floor(Date.now() / 1000);

      setChats((current) => {
        const exists = current.some(
          (chat) => chat.id === chatId
        );

        const incomingMessage = {
          id:
            body?.idMessage ||
            `incoming-${Date.now()}`,
          text,
          outgoing: false,
          timestamp,
          status: "received"
        };

        if (!exists) {
          return [
            {
              id: chatId,
              phone: chatId,
              name: senderName,
              messages: [incomingMessage]
            },
            ...current
          ];
        }

        return current.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                name:
                  chat.name === chat.phone
                    ? senderName
                    : chat.name,
                messages: [
                  ...chat.messages,
                  incomingMessage
                ]
              }
            : chat
        );
      });

      if (!activeChatId) {
        setActiveChatId(chatId);
      }

      await deleteNotification(
        notification.receiptId
      );
    } catch (e) {
      setError(e.message);
    } finally {
      pollingRef.current = false;
    }
  }

  useEffect(() => {
    if (!connected) return;

    let stopped = false;

    async function poll() {
      while (!stopped) {
        await receiveOnce();
      }
    }

    poll();

    return () => {
      stopped = true;
    };
  }, [connected, idInstance, apiTokenInstance]);

  if (!connected) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <div className="brand">
            <div className="brand-logo">
              <MessageCircle size={27} />
            </div>

            <div>
              <h1>MAX Chat</h1>
              <p>GREEN-API</p>
            </div>
          </div>

          <div className="setup-description">
            <h2>Подключение к MAX</h2>

            <p>
              Введите учетные данные GREEN-API,
              чтобы работать с текстовыми сообщениями.
            </p>
          </div>

          <form
            className="setup-form"
            onSubmit={(e) => {
              e.preventDefault();
              connect();
            }}
          >
            <label>
              <span>idInstance</span>
              <input
                value={idInstance}
                onChange={(e) =>
                  setIdInstance(e.target.value)
                }
                placeholder="idInstance"
              />
            </label>

            <label>
              <span>apiTokenInstance</span>
              <input
                type="password"
                value={apiTokenInstance}
                onChange={(e) =>
                  setApiTokenInstance(
                    e.target.value
                  )
                }
                placeholder="apiTokenInstance"
              />
            </label>

            {error && (
              <div className="error-box">
                {error}
              </div>
            )}

            <button
              className="primary-button"
              disabled={connecting}
            >
              {connecting
                ? "Подключение..."
                : "Подключиться"}
            </button>
          </form>

          <div className="setup-note">
            <Wifi size={16} />
            <span>
              Соединение работает через локальный
              backend проекта.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-app">
      <aside
        className={`sidebar ${
          mobileChat ? "mobile-hidden" : ""
        }`}
      >
        <div className="sidebar-header">
          <div className="profile">
            <div className="avatar self-avatar">
              <UserRound size={19} />
            </div>

            <div>
              <strong>Мой MAX</strong>

              <span className="online">
                <i />
                подключено
              </span>
            </div>
          </div>

          <button
            className="icon-button"
            onClick={() => {
              setShowSettings(true);
              setError("");
            }}
          >
            <Settings size={18} />
          </button>
        </div>

        <div className="chat-list-header">
          <span>Чаты</span>

          <button
            className="new-chat-button"
            onClick={() => {
              setShowNewChat(true);
              setError("");
            }}
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="chat-list">
          {chats.length === 0 ? (
            <div className="empty-chats">
              <MessageCircle size={28} />
              <span>Чатов пока нет</span>
              <small>
                Создайте новый чат по номеру телефона
              </small>
            </div>
          ) : (
            chats.map((chat) => {
              const last =
                chat.messages[chat.messages.length - 1];

              return (
                <button
                  key={chat.id}
                  className={`chat-item ${
                    chat.id === activeChatId
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setMobileChat(true);
                  }}
                >
                  <div className="avatar">
                    {(chat.name || chat.phone)
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>

                  <div className="chat-preview">
                    <div className="chat-title">
                      <strong>
                        {chat.name}
                      </strong>

                      {last && (
                        <time>
                          {formatTime(
                            last.timestamp
                          )}
                        </time>
                      )}
                    </div>

                    <p>
                      {last?.text || chat.phone}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main
        className={`conversation ${
          !mobileChat && !activeChat
            ? ""
            : mobileChat
            ? ""
            : "mobile-hidden"
        }`}
      >
        {!activeChat ? (
          <div className="welcome">
            <div className="welcome-icon">
              <MessageCircle size={41} />
            </div>

            <h2>Выберите чат</h2>

            <p>
              Создайте новый чат и начните
              переписку.
            </p>

            <button
              className="primary-button compact"
              onClick={() => setShowNewChat(true)}
            >
              <Plus size={18} />
              Новый чат
            </button>
          </div>
        ) : (
          <>
            <header className="conversation-header">
              <button
                className="back-button"
                onClick={() =>
                  setMobileChat(false)
                }
              >
                <ArrowLeft size={20} />
              </button>

              <div className="avatar">
                {activeChat.name
                  .slice(0, 1)
                  .toUpperCase()}
              </div>

              <div className="conversation-info">
                <strong>{activeChat.name}</strong>
                <span>
                  {activeChat.phone}
                </span>
              </div>

              <div className="connection-status">
                <Wifi size={16} />
              </div>
            </header>

            <section className="messages">
              {activeChat.messages.length === 0 && (
                <div className="chat-empty">
                  <div className="chat-empty-icon">
                    <MessageCircle size={24} />
                  </div>

                  <strong>
                    Начните переписку
                  </strong>

                  <span>
                    Здесь появятся сообщения.
                  </span>
                </div>
              )}

              {activeChat.messages.map((item) => (
                <div
                  key={item.id}
                  className={`message-row ${
                    item.outgoing
                      ? "outgoing"
                      : "incoming"
                  }`}
                >
                  <div className="message-bubble">
                    <div className="message-text">
                      {item.text}
                    </div>

                    <div className="message-meta">
                      <time>
                        {formatTime(
                          item.timestamp
                        )}
                      </time>

                      {item.outgoing &&
                        (item.status ===
                        "error" ? (
                          <X size={14} />
                        ) : item.status ===
                          "sending" ? (
                          <Check size={14} />
                        ) : (
                          <CheckCheck size={14} />
                        ))}
                    </div>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </section>

            {error && (
              <div className="inline-error">
                <span>{error}</span>

                <button
                  onClick={() => setError("")}
                >
                  <X size={15} />
                </button>
              </div>
            )}

            <form
              className="composer"
              onSubmit={sendMessage}
            >
              <textarea
                rows={1}
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey
                  ) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
                placeholder="Напишите сообщение..."
              />

              <button
                className="send-button"
                disabled={!message.trim()}
              >
                <Send size={19} />
              </button>
            </form>
          </>
        )}
      </main>

      {showNewChat && (
        <div
          className="modal-overlay"
          onClick={() =>
            setShowNewChat(false)
          }
        >
          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>Новый чат</h2>
                <p>
                  Номер телефона получателя
                </p>
              </div>

              <button
                className="icon-button"
                onClick={() =>
                  setShowNewChat(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="new-chat-form"
              onSubmit={createChat}
            >
              <label>
                <span>Телефон</span>

                <input
                  autoFocus
                  value={newPhone}
                  onChange={(e) =>
                    setNewPhone(e.target.value)
                  }
                  placeholder="+7 777 123 45 67"
                />
              </label>

              <button className="primary-button">
                Создать чат
              </button>
            </form>
          </div>
        </div>
      )}

      {showSettings && (
        <div
          className="modal-overlay"
          onClick={() =>
            setShowSettings(false)
          }
        >
          <div
            className="modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <h2>Настройки</h2>
                <p>GREEN-API</p>
              </div>

              <button
                className="icon-button"
                onClick={() =>
                  setShowSettings(false)
                }
              >
                <X size={20} />
              </button>
            </div>

            <div className="settings-form">
              <label>
                <span>idInstance</span>

                <input
                  value={idInstance}
                  onChange={(e) =>
                    setIdInstance(e.target.value)
                  }
                />
              </label>

              <label>
                <span>apiTokenInstance</span>

                <input
                  type="password"
                  value={apiTokenInstance}
                  onChange={(e) =>
                    setApiTokenInstance(
                      e.target.value
                    )
                  }
                />
              </label>

              {error && (
                <div className="error-box">
                  {error}
                </div>
              )}

              <button
                className="primary-button"
                onClick={connect}
                disabled={connecting}
              >
                {connecting
                  ? "Подключение..."
                  : "Сохранить"}
              </button>

              <div className="settings-status">
                {connected ? (
                  <>
                    <Wifi size={15} />
                    Подключено
                  </>
                ) : (
                  <>
                    <WifiOff size={15} />
                    Не подключено
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
