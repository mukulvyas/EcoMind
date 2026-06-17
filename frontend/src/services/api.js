const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

/**
 * Gets or creates a UUID session identifier.
 * @returns {string} UUID session identifier
 */
export const getSessionId = () => {
  let id = localStorage.getItem("ecomind_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ecomind_session", id);
  }
  return id;
};

/**
 * Calculates the carbon footprint based on user inputs.
 * @param {Object} formData - Calculator form values
 * @returns {Promise<Object>} Footprint result with CO2 values
 */
export const calculateFootprint = async (formData) => {
  const res = await fetch(`${BASE_URL}/api/footprint/calculate`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Session-ID": getSessionId()
    },
    body: JSON.stringify({ ...formData, session_id: getSessionId() })
  });
  return res.json();
};

/**
 * Fetches the user's footprint history.
 * @returns {Promise<Object>} History entries
 */
export const getHistory = async () => {
  const res = await fetch(
    `${BASE_URL}/api/footprint/history/${getSessionId()}`, {
      headers: { "X-Session-ID": getSessionId() }
    }
  );
  return res.json();
};

/**
 * Sends a chat message to the AI coach.
 * @param {Array} messages - Chat history array
 * @returns {Promise<Object>} AI response
 */
export const sendChatMessage = async (messages) => {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Session-ID": getSessionId()
    },
    body: JSON.stringify({ session_id: getSessionId(), messages })
  });
  return res.json();
};

/**
 * Generates an action plan from the AI coach.
 * @param {Array} messages - Chat history array
 * @returns {Promise<Object>} Action plan data
 */
export const getActionPlan = async (messages) => {
  const res = await fetch(`${BASE_URL}/api/chat/action-plan`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Session-ID": getSessionId()
    },
    body: JSON.stringify({ session_id: getSessionId(), messages })
  });
  return res.json();
};

/**
 * Fetches the currently active action plan.
 * @returns {Promise<Object>} Action plan data
 */
export const fetchActiveActionPlan = async () => {
  const res = await fetch(`${BASE_URL}/api/chat/action-plan/${getSessionId()}`, {
    headers: { "X-Session-ID": getSessionId() }
  });
  return res.json();
};

/**
 * Toggles completion status of an action item.
 * @param {string} planId - The action plan ID
 * @param {number} day - The day number
 * @param {boolean} completed - New completion status
 * @param {string} claim - User claim/notes
 * @returns {Promise<Object>} Update result
 */
export const toggleActionItem = async (planId, day, completed, claim) => {
  const res = await fetch(`${BASE_URL}/api/chat/action/${getSessionId()}/${planId}/${day}`, {
    method: "PATCH",
    headers: { 
      "Content-Type": "application/json",
      "X-Session-ID": getSessionId()
    },
    body: JSON.stringify({ completed, user_claim: claim })
  });
  return res.json();
};

/**
 * Uploads a bill image for analysis.
 * @param {File} file - The image file
 * @param {string} billType - Type of bill (e.g. electricity, food)
 * @returns {Promise<Object>} Extracted bill data
 */
export const uploadBill = async (file, billType) => {
  const form = new FormData();
  form.append("file", file);
  form.append("bill_type", billType);
  form.append("session_id", getSessionId());
  const res = await fetch(`${BASE_URL}/api/bills/upload`, {
    method: "POST", 
    headers: { "X-Session-ID": getSessionId() },
    body: form
  });
  return res.json();
};

/**
 * Fetches live government climate data for a city/state.
 * @param {string} city - The city name
 * @param {string} state - The state name
 * @returns {Promise<Object>} Live government data
 */
export const getGovtData = async (city = "Bengaluru", state = "Karnataka") => {
  const res = await fetch(`${BASE_URL}/api/govt/live?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`, {
    headers: { "X-Session-ID": getSessionId() }
  });
  return res.json();
};
