import express from "express";

const app = express();
const PORT = 3001;

app.use(express.json());

const GREEN_API_URL = "https://api.green-api.com";

function getCredentials(body) {
  const idInstance = String(body?.idInstance || "").trim();
  const apiTokenInstance = String(body?.apiTokenInstance || "").trim();

  if (!idInstance || !apiTokenInstance) {
    throw new Error("Введите idInstance и apiTokenInstance");
  }

  return { idInstance, apiTokenInstance };
}

function greenUrl(idInstance, apiTokenInstance, method) {
  return `${GREEN_API_URL}/waInstance${idInstance}/${method}/${apiTokenInstance}`;
}

async function greenRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      data?.description ||
      `GREEN-API HTTP ${response.status}`
    );
  }

  return data;
}

app.post("/api/connect", async (req, res) => {
  try {
    const { idInstance, apiTokenInstance } = getCredentials(req.body);

    const settings = await greenRequest(
      greenUrl(idInstance, apiTokenInstance, "setSettings"),
      {
        method: "POST",
        body: JSON.stringify({
          webhookUrl: "",
          incomingWebhook: "yes",
          outgoingWebhook: "yes",
          outgoingAPIMessageWebhook: "yes",
          outgoingMessageWebhook: "yes",
          stateWebhook: "yes"
        })
      }
    );

    const state = await greenRequest(
      greenUrl(idInstance, apiTokenInstance, "getStateInstance"),
      {
        method: "GET"
      }
    );

    res.json({
      success: true,
      settings,
      state
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

app.post("/api/send", async (req, res) => {
  try {
    const { idInstance, apiTokenInstance } = getCredentials(req.body);

    const chatId = String(req.body?.chatId || "").trim();
    const message = String(req.body?.message || "");

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: "chatId обязателен"
      });
    }

    if (!message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Сообщение не может быть пустым"
      });
    }

    const result = await greenRequest(
      greenUrl(idInstance, apiTokenInstance, "sendMessage"),
      {
        method: "POST",
        body: JSON.stringify({
          chatId,
          message
        })
      }
    );

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

app.post("/api/receive", async (req, res) => {
  try {
    const { idInstance, apiTokenInstance } = getCredentials(req.body);

    const url =
      greenUrl(
        idInstance,
        apiTokenInstance,
        "receiveNotification"
      ) + "?receiveTimeout=5";

    const notification = await greenRequest(url, {
      method: "GET"
    });

    res.json({
      success: true,
      notification:
        notification && Object.keys(notification).length > 0
          ? notification
          : null
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

app.post("/api/delete-notification", async (req, res) => {
  try {
    const { idInstance, apiTokenInstance } = getCredentials(req.body);
    const receiptId = req.body?.receiptId;

    if (receiptId === undefined || receiptId === null) {
      return res.status(400).json({
        success: false,
        message: "receiptId обязателен"
      });
    }

    const result = await greenRequest(
      greenUrl(
        idInstance,
        apiTokenInstance,
        "deleteNotification"
      ) + `/${encodeURIComponent(receiptId)}`,
      {
        method: "DELETE"
      }
    );

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`GREEN-API backend running: http://localhost:${PORT}`);
});
