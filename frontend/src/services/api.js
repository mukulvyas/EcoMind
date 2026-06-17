const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// Session ID — persisted in localStorage, no login needed
export const getSessionId = () => {
  let id = localStorage.getItem("ecomind_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ecomind_session", id);
  }
  return id;
};

export const calculateFootprint = async (formData) => {
  const res = await fetch(`${BASE_URL}/api/footprint/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...formData, session_id: getSessionId() })
  });
  return res.json();
};

export const getHistory = async () => {
  const res = await fetch(
    `${BASE_URL}/api/footprint/history/${getSessionId()}`
  );
  return res.json();
};

export const sendChatMessage = async (messages) => {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: getSessionId(), messages })
  });
  return res.json();
};

export const getActionPlan = async (messages) => {
  const res = await fetch(`${BASE_URL}/api/chat/action-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: getSessionId(), messages })
  });
  return res.json();
};

export const fetchActiveActionPlan = async () => {
  const res = await fetch(`${BASE_URL}/api/chat/action-plan/${getSessionId()}`);
  return res.json();
};

export const toggleActionItem = async (planId, day, completed, claim) => {
  const res = await fetch(`${BASE_URL}/api/chat/action/${getSessionId()}/${planId}/${day}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed, user_claim: claim })
  });
  return res.json();
};

export const uploadBill = async (file, billType) => {
  const form = new FormData();
  form.append("file", file);
  form.append("bill_type", billType);
  form.append("session_id", getSessionId());
  const res = await fetch(`${BASE_URL}/api/bills/upload`, {
    method: "POST", body: form
  });
  return res.json();
};

export const getGovtData = async (city = "Bengaluru", state = "Karnataka") => {
  const res = await fetch(`${BASE_URL}/api/govt/live?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`);
  return res.json();
};
