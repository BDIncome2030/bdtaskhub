const state = {
  user: null,
  tasks: [],
  withdrawals: []
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = {};

  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function showMessage(elementId, message, success = false) {
  const element = document.getElementById(elementId);

  if (!element) return;

  element.textContent = message;
  element.style.color = success ? "#087443" : "#b42318";
}

function money(value) {
  return "৳" + Number(value || 0).toFixed(2);
}


/* =========================
   AUTH TABS
========================= */

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

loginTab.addEventListener("click", () => {
  loginTab.classList.add("active");
  registerTab.classList.remove("active");

  loginForm.hidden = false;
  registerForm.hidden = true;
});

registerTab.addEventListener("click", () => {
  registerTab.classList.add("active");
  loginTab.classList.remove("active");

  registerForm.hidden = false;
  loginForm.hidden = true;
});


/* =========================
   LOGIN
========================= */

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  showMessage("loginMsg", "Login হচ্ছে...");

  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password
      })
    });

    loginForm.reset();
    await loadApp();

  } catch (error) {
    showMessage("loginMsg", error.message);
  }
});


/* =========================
   REGISTER
========================= */

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;

  showMessage("registerMsg", "Account তৈরি হচ্ছে...");

  try {
    await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password
      })
    });

    registerForm.reset();

    await loadApp();

  } catch (error) {
    showMessage("registerMsg", error.message);
  }
});


/* =========================
   LOAD USER
========================= */

async function loadApp() {
  try {
    const data = await api("/api/me");

    if (!data.user) {
      showAuth();
      return;
    }

    state.user = data.user;

    showDashboard();

    await Promise.all([
      loadTasks(),
      loadWithdrawals()
    ]);

  } catch (error) {
    console.error(error);
    showAuth();
  }
}


/* =========================
   SHOW AUTH
========================= */

function showAuth() {
  state.user = null;

  document.getElementById("authSection").hidden = false;
  document.getElementById("appSection").hidden = true;
  document.getElementById("logoutBtn").hidden = true;
}


/* =========================
   SHOW DASHBOARD
========================= */

function showDashboard() {
  const user = state.user;

  document.getElementById("authSection").hidden = true;
  document.getElementById("appSection").hidden = false;
  document.getElementById("logoutBtn").hidden = false;

  document.getElementById("userName").textContent =
    user.name || "—";

  document.getElementById("userEmail").textContent =
    user.email || "—";

  document.getElementById("userRole").textContent =
    user.role === "admin" ? "Administrator" : "User";

  document.getElementById("balance").textContent =
    money(user.balance);

  document.getElementById("refCode").textContent =
    user.referral_code || "—";

  document.getElementById("refCode2").textContent =
    user.referral_code || "—";
}


/* =========================
   TASKS
========================= */

async function loadTasks() {
  const list = document.getElementById("taskList");

  list.innerHTML =
    '<p class="muted">Tasks loading...</p>';

  try {
    const data = await api("/api/tasks");

    state.tasks = data.tasks || [];

    renderTasks();

  } catch (error) {
    list.innerHTML =
      `<p class="message">${escapeHtml(error.message)}</p>`;
  }
}


function renderTasks() {
  const list = document.getElementById("taskList");

  list.innerHTML = "";

  if (!state.tasks.length) {
    list.innerHTML =
      '<p class="muted">এই মুহূর্তে কোনো task নেই।</p>';

    updateCompletedCount();
    return;
  }

  state.tasks.forEach(task => {
    const article = document.createElement("article");

    article.className = "task";

    const title = document.createElement("h3");
    title.textContent = task.title;

    const description = document.createElement("p");
    description.textContent = task.description;

    const reward = document.createElement("div");
    reward.className = "reward";
    reward.textContent =
      `Reward: ${money(task.reward)}`;

    article.appendChild(title);
    article.appendChild(description);
    article.appendChild(reward);

    const status = task.status || null;

    if (!status) {
      const proofLabel = document.createElement("label");
      proofLabel.textContent = "Task proof / answer";

      const proof = document.createElement("textarea");

      proof.rows = 4;
      proof.maxLength = 2000;
      proof.placeholder =
        "কাজটি কীভাবে সম্পন্ন করেছেন তা সংক্ষেপে লিখুন...";

      proof.style.width = "100%";
      proof.style.padding = "12px";
      proof.style.border = "1px solid #cfd6df";
      proof.style.borderRadius = "12px";
      proof.style.font = "inherit";
      proof.style.marginTop = "7px";

      const button = document.createElement("button");

      button.type = "button";
      button.className = "btn";
      button.textContent = "Submit Task";

      button.style.marginTop = "12px";

      button.addEventListener("click", async () => {
        const value = proof.value.trim();

        if (value.length < 3) {
          alert("দয়া করে task proof বা answer লিখুন।");
          return;
        }

        button.disabled = true;
        button.textContent = "Submitting...";

        try {
          await api(`/api/tasks/${task.id}/submit`, {
            method: "POST",
            body: JSON.stringify({
              proof: value
            })
          });

          await loadTasks();

          alert(
            "Task submission গ্রহণ করা হয়েছে। Admin verification-এর পর reward যোগ হবে।"
          );

        } catch (error) {
          alert(error.message);

          button.disabled = false;
          button.textContent = "Submit Task";
        }
      });

      article.appendChild(proofLabel);
      article.appendChild(proof);
      article.appendChild(button);

    } else {

      const statusBox = document.createElement("div");

      statusBox.style.marginTop = "14px";
      statusBox.style.fontWeight = "700";

      if (status === "pending") {

        statusBox.textContent =
          "⏳ Pending — Admin verification-এর অপেক্ষায়";

        statusBox.style.color = "#b54708";

      } else if (status === "approved") {

        statusBox.textContent =
          "✅ Approved — Reward account balance-এ যোগ হয়েছে";

        statusBox.style.color = "#087443";

      } else if (status === "rejected") {

        statusBox.textContent =
          "❌ Rejected";

        statusBox.style.color = "#b42318";

        if (task.reviewer_note) {
          const note = document.createElement("p");

          note.className = "muted";
          note.textContent =
            "Admin note: " + task.reviewer_note;

          article.appendChild(note);
        }
      }

      article.appendChild(statusBox);
    }

    list.appendChild(article);
  });

  updateCompletedCount();
}


function updateCompletedCount() {
  const count = state.tasks.filter(task =>
    ["pending", "approved"].includes(task.status)
  ).length;

  document.getElementById("completed").textContent = count;
}


/* =========================
   WITHDRAWALS
========================= */

async function loadWithdrawals() {
  try {
    const data = await api("/api/withdrawals");

    state.withdrawals = data.withdrawals || [];

    renderWithdrawals();

  } catch (error) {
    console.error(error);
  }
}


function renderWithdrawals() {
  const list = document.getElementById("withdrawalList");

  list.innerHTML = "";

  if (!state.withdrawals.length) {
    list.innerHTML =
      '<p class="muted">কোনো withdrawal request নেই।</p>';

    return;
  }

  state.withdrawals.forEach(item => {

    const row = document.createElement("div");

    row.className = "task";

    const statusText = {
      pending: "⏳ Pending",
      paid: "✅ Paid",
      rejected: "❌ Rejected"
    };

    row.innerHTML = `
      <strong>${money(item.amount)}</strong>
      <p>Method: ${escapeHtml(item.method)}</p>
      <p>Status: ${escapeHtml(
        statusText[item.status] || item.status
      )}</p>
      <p class="muted small">
        ${escapeHtml(item.created_at || "")}
      </p>
    `;

    if (item.note) {
      const note = document.createElement("p");

      note.className = "muted";
      note.textContent = "Note: " + item.note;

      row.appendChild(note);
    }

    list.appendChild(row);
  });
}


/* =========================
   WITHDRAW FORM
========================= */

document
  .getElementById("withdrawForm")
  .addEventListener("submit", async event => {

    event.preventDefault();

    const amount = Number(
      document.getElementById("amount").value
    );

    const method =
      document.getElementById("method").value;

    const paymentInfo =
      document.getElementById("payment").value.trim();

    showMessage(
      "withdrawMsg",
      "Withdrawal request পাঠানো হচ্ছে..."
    );

    try {

      await api("/api/withdrawals", {
        method: "POST",
        body: JSON.stringify({
          amount,
          method,
          paymentInfo
        })
      });

      event.target.reset();

      showMessage(
        "withdrawMsg",
        "Withdrawal request সফলভাবে জমা হয়েছে।",
        true
      );

      await loadApp();

    } catch (error) {

      showMessage(
        "withdrawMsg",
        error.message
      );
    }
  });


/* =========================
   COPY REFERRAL
========================= */

document
  .getElementById("copyRef")
  .addEventListener("click", async () => {

    const code =
      state.user?.referral_code || "";

    if (!code) return;

    try {

      await navigator.clipboard.writeText(code);

      alert("Referral code কপি হয়েছে।");

    } catch (_) {

      alert("Referral code: " + code);
    }
  });


/* =========================
   LOGOUT
========================= */

document
  .getElementById("logoutBtn")
  .addEventListener("click", async () => {

    try {

      await api("/api/logout", {
        method: "POST"
      });

      showAuth();

      loginForm.reset();
      registerForm.reset();

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

    } catch (error) {

      alert(error.message);
    }
  });


/* =========================
   HTML ESCAPE
========================= */

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================
   INITIAL LOAD
========================= */

loadApp();
