require("dotenv").config();

const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 8080;
const SESSION_SECRET = process.env.SESSION_SECRET || "CHANGE_THIS_SECRET_IN_PRODUCTION";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeMe123!";

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "bdtaskhub.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  balance REAL NOT NULL DEFAULT 0,
  referral_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reward REAL NOT NULL CHECK(reward >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS task_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  proof TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reviewer_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  UNIQUE(user_id, task_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  method TEXT NOT NULL,
  payment_info TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','rejected')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  reference_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

function makeReferral() {
  return "BD" + crypto.randomBytes(4).toString("hex").toUpperCase();
}
function uniqueReferral() {
  let code;
  do { code = makeReferral(); } while (db.prepare("SELECT 1 FROM users WHERE referral_code=?").get(code));
  return code;
}

if (!db.prepare("SELECT 1 FROM users WHERE email=?").get(ADMIN_EMAIL)) {
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  db.prepare("INSERT INTO users(name,email,password_hash,role,referral_code) VALUES(?,?,?,?,?)")
    .run("Administrator", ADMIN_EMAIL.toLowerCase(), hash, "admin", uniqueReferral());
}

if (db.prepare("SELECT COUNT(*) AS c FROM tasks").get().c === 0) {
  const add = db.prepare("INSERT INTO tasks(title,description,reward) VALUES(?,?,?)");
  add.run("Website review", "Open the assigned page, read the instructions and submit a short genuine review.", 5);
  add.run("Content quality check", "Review a sample page for spelling, clarity and broken information.", 8);
  add.run("Feedback task", "Submit constructive feedback about one feature of the platform.", 10);
}

const app = express();
app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));
app.use(express.static(path.join(__dirname, "public")));

function auth(req,res,next) {
  if (!req.session.userId) return res.status(401).json({error:"Login required"});
  next();
}
function admin(req,res,next) {
  if (!req.session.userId) return res.status(401).json({error:"Login required"});
  const u = db.prepare("SELECT id,name,email,role FROM users WHERE id=?").get(req.session.userId);
  if (!u || u.role !== "admin") return res.status(403).json({error:"Admin access required"});
  req.user = u; next();
}

app.post("/api/register", (req,res) => {
  const name = String(req.body.name||"").trim();
  const email = String(req.body.email||"").trim().toLowerCase();
  const password = String(req.body.password||"");
  if (name.length < 2 || !email.includes("@") || password.length < 8)
    return res.status(400).json({error:"Name, valid email and password of at least 8 characters are required."});
  try {
    const hash = bcrypt.hashSync(password, 12);
    const info = db.prepare("INSERT INTO users(name,email,password_hash,referral_code) VALUES(?,?,?,?)")
      .run(name,email,hash,uniqueReferral());
    req.session.userId = info.lastInsertRowid;
    res.json({ok:true});
  } catch(e) {
    if (String(e.message).includes("UNIQUE")) return res.status(409).json({error:"Email already registered."});
    res.status(500).json({error:"Registration failed."});
  }
});

app.post("/api/login", (req,res) => {
  const email = String(req.body.email||"").trim().toLowerCase();
  const password = String(req.body.password||"");
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user || !bcrypt.compareSync(password,user.password_hash))
    return res.status(401).json({error:"Invalid email or password."});
  req.session.userId = user.id;
  res.json({ok:true, role:user.role});
});

app.post("/api/logout", (req,res) => req.session.destroy(() => res.json({ok:true})));

app.get("/api/me", (req,res) => {
  if (!req.session.userId) return res.json({user:null});
  const user = db.prepare("SELECT id,name,email,role,balance,referral_code,created_at FROM users WHERE id=?").get(req.session.userId);
  if (!user) return res.json({user:null});
  res.json({user});
});

app.get("/api/tasks", auth, (req,res) => {
  const tasks = db.prepare(`
    SELECT t.id,t.title,t.description,t.reward,t.active,
           s.id AS submission_id,s.status,s.proof,s.reviewer_note
    FROM tasks t
    LEFT JOIN task_submissions s ON s.task_id=t.id AND s.user_id=?
    WHERE t.active=1 ORDER BY t.id DESC
  `).all(req.session.userId);
  res.json({tasks});
});

app.post("/api/tasks/:id/submit", auth, (req,res) => {
  const taskId = Number(req.params.id);
  const proof = String(req.body.proof||"").trim();
  const task = db.prepare("SELECT * FROM tasks WHERE id=? AND active=1").get(taskId);
  if (!task) return res.status(404).json({error:"Task not found."});
  if (proof.length < 3) return res.status(400).json({error:"Please provide a meaningful proof or answer."});
  try {
    db.prepare("INSERT INTO task_submissions(user_id,task_id,proof) VALUES(?,?,?)").run(req.session.userId,taskId,proof);
    res.json({ok:true});
  } catch(e) {
    res.status(409).json({error:"You already submitted this task."});
  }
});

app.get("/api/withdrawals", auth, (req,res) => {
  res.json({withdrawals:db.prepare("SELECT id,amount,method,status,note,created_at,reviewed_at FROM withdrawals WHERE user_id=? ORDER BY id DESC").all(req.session.userId)});
});

app.post("/api/withdrawals", auth, (req,res) => {
  const amount = Number(req.body.amount);
  const method = String(req.body.method||"");
  const paymentInfo = String(req.body.paymentInfo||"").trim();
  if (!Number.isFinite(amount) || amount < 50) return res.status(400).json({error:"Minimum withdrawal is ৳50."});
  if (!["bKash","Nagad","Bank Transfer"].includes(method)) return res.status(400).json({error:"Invalid payment method."});
  if (paymentInfo.length < 5) return res.status(400).json({error:"Payment information is required."});
  const tx = db.transaction(() => {
    const u = db.prepare("SELECT balance FROM users WHERE id=?").get(req.session.userId);
    if (!u || u.balance < amount) throw new Error("INSUFFICIENT");
    db.prepare("UPDATE users SET balance=balance-? WHERE id=?").run(amount,req.session.userId);
    const r = db.prepare("INSERT INTO withdrawals(user_id,amount,method,payment_info) VALUES(?,?,?,?)")
      .run(req.session.userId,amount,method,paymentInfo);
    db.prepare("INSERT INTO ledger(user_id,amount,type,reference_id,note) VALUES(?,?,?,?,?)")
      .run(req.session.userId,-amount,"withdrawal",r.lastInsertRowid,"Withdrawal requested");
  });
  try { tx(); res.json({ok:true}); }
  catch(e) { if(e.message==="INSUFFICIENT") return res.status(400).json({error:"Insufficient balance."}); res.status(500).json({error:"Withdrawal failed."}); }
});

/* Admin */
app.get("/api/admin/summary", admin, (req,res) => {
  res.json({
    users: db.prepare("SELECT COUNT(*) c FROM users WHERE role='user'").get().c,
    pendingTasks: db.prepare("SELECT COUNT(*) c FROM task_submissions WHERE status='pending'").get().c,
    pendingWithdrawals: db.prepare("SELECT COUNT(*) c FROM withdrawals WHERE status='pending'").get().c,
    totalBalance: db.prepare("SELECT COALESCE(SUM(balance),0) s FROM users WHERE role='user'").get().s
  });
});

app.get("/api/admin/submissions", admin, (req,res) => {
  res.json({items:db.prepare(`
    SELECT s.id,s.proof,s.status,s.reviewer_note,s.created_at,t.title,t.reward,u.name,u.email
    FROM task_submissions s
    JOIN tasks t ON t.id=s.task_id JOIN users u ON u.id=s.user_id
    ORDER BY s.id DESC
  `).all()});
});

app.post("/api/admin/submissions/:id/review", admin, (req,res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status||"");
  const note = String(req.body.note||"").trim();
  if (!["approved","rejected"].includes(status)) return res.status(400).json({error:"Invalid review status."});
  const tx = db.transaction(() => {
    const s = db.prepare(`
      SELECT s.*,t.reward FROM task_submissions s JOIN tasks t ON t.id=s.task_id WHERE s.id=?
    `).get(id);
    if (!s) throw new Error("NOT_FOUND");
    if (s.status !== "pending") throw new Error("ALREADY_REVIEWED");
    db.prepare("UPDATE task_submissions SET status=?,reviewer_note=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(status,note,id);
    if (status === "approved") {
      db.prepare("UPDATE users SET balance=balance+? WHERE id=?").run(s.reward,s.user_id);
      db.prepare("INSERT INTO ledger(user_id,amount,type,reference_id,note) VALUES(?,?,?,?,?)")
        .run(s.user_id,s.reward,"task_reward",id,"Approved task reward");
    }
  });
  try { tx(); res.json({ok:true}); }
  catch(e) {
    if(e.message==="NOT_FOUND") return res.status(404).json({error:"Submission not found."});
    if(e.message==="ALREADY_REVIEWED") return res.status(409).json({error:"Already reviewed."});
    res.status(500).json({error:"Review failed."});
  }
});

app.get("/api/admin/withdrawals", admin, (req,res) => {
  res.json({items:db.prepare(`
    SELECT w.id,w.amount,w.method,w.payment_info,w.status,w.note,w.created_at,w.reviewed_at,u.name,u.email
    FROM withdrawals w JOIN users u ON u.id=w.user_id ORDER BY w.id DESC
  `).all()});
});

app.post("/api/admin/withdrawals/:id/review", admin, (req,res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status||"");
  const note = String(req.body.note||"").trim();
  if (!["paid","rejected"].includes(status)) return res.status(400).json({error:"Invalid status."});
  const tx = db.transaction(() => {
    const w = db.prepare("SELECT * FROM withdrawals WHERE id=?").get(id);
    if (!w) throw new Error("NOT_FOUND");
    if (w.status !== "pending") throw new Error("ALREADY");
    db.prepare("UPDATE withdrawals SET status=?,note=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").run(status,note,id);
    if (status === "rejected") {
      db.prepare("UPDATE users SET balance=balance+? WHERE id=?").run(w.amount,w.user_id);
      db.prepare("INSERT INTO ledger(user_id,amount,type,reference_id,note) VALUES(?,?,?,?,?)")
        .run(w.user_id,w.amount,"withdrawal_refund",id,"Rejected withdrawal refunded");
    }
  });
  try { tx(); res.json({ok:true}); }
  catch(e) {
    if(e.message==="NOT_FOUND") return res.status(404).json({error:"Withdrawal not found."});
    if(e.message==="ALREADY") return res.status(409).json({error:"Already reviewed."});
    res.status(500).json({error:"Review failed."});
  }
});

app.post("/api/admin/tasks", admin, (req,res) => {
  const title=String(req.body.title||"").trim(), description=String(req.body.description||"").trim(), reward=Number(req.body.reward);
  if(title.length<3 || description.length<3 || !Number.isFinite(reward) || reward<0) return res.status(400).json({error:"Invalid task data."});
  const r=db.prepare("INSERT INTO tasks(title,description,reward) VALUES(?,?,?)").run(title,description,reward);
  res.json({ok:true,id:r.lastInsertRowid});
});

app.patch("/api/admin/tasks/:id", admin, (req,res) => {
  const id=Number(req.params.id);
  const active=req.body.active ? 1 : 0;
  const r=db.prepare("UPDATE tasks SET active=? WHERE id=?").run(active,id);
  if(!r.changes) return res.status(404).json({error:"Task not found."});
  res.json({ok:true});
});

app.get("/api/admin/tasks", admin, (req,res) => {
  res.json({tasks:db.prepare("SELECT * FROM tasks ORDER BY id DESC").all()});
});

app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`BD Task Hub running on port ${PORT}`);
});

