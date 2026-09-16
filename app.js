// ---- 관리자 목록 ----
const ADMIN_NAMES = ["윙윙", "절미", "하루", "떵구"];
const SECOND_ROUND_INTERVIEWER = "떵구"; // 2차 면접은 항상 떵구가 담당
const SESSION_KEY = "song-team-current-admin";
const THEME_KEY = "song-team-theme";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const candidatesRef = db.collection("candidates");
const adminsRef = db.collection("admins");

// Firestore 보안 규칙이 "로그인(익명 포함)한 사용자만 read/write 가능"으로 되어 있으므로,
// 페이지에 들어오면 바로 익명 로그인을 해서 그 조건을 만족시켜 둡니다.
// (실제 비밀번호 검증은 Firebase Auth가 아니라 Firestore의 admins 컬렉션으로 직접 합니다.)
auth.signInAnonymously().catch((err) => {
  console.error("anonymous sign-in failed", err);
});

// ---- DOM ----
const loginScreen = document.getElementById("login-screen");
const mainScreen = document.getElementById("main-screen");
const loginNameSelect = document.getElementById("login-name");
const loginPasswordInput = document.getElementById("login-password");
const loginPasswordConfirmWrap = document.getElementById("login-password-confirm-wrap");
const loginPasswordConfirmInput = document.getElementById("login-password-confirm");
const firstLoginNotice = document.getElementById("first-login-notice");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const themeToggle = document.getElementById("theme-toggle");
const themeToggleLogin = document.getElementById("theme-toggle-login");
const currentUserLabel = document.getElementById("current-user");

const accountManageBtn = document.getElementById("account-manage-btn");
const accountModal = document.getElementById("account-modal");
const accountModalClose = document.getElementById("account-modal-close");
const accountList = document.getElementById("account-list");

const searchBox = document.getElementById("search-box");
const addBtn = document.getElementById("add-btn");
const emptyMsg = document.getElementById("empty-msg");
const tbodyPending = document.getElementById("tbody-pending");
const tbodyPass = document.getElementById("tbody-pass");
const tbodyFail = document.getElementById("tbody-fail");
const emptyPending = document.getElementById("empty-pending");
const emptyPass = document.getElementById("empty-pass");
const emptyFail = document.getElementById("empty-fail");
const countPending = document.getElementById("count-pending");
const countPass = document.getElementById("count-pass");
const countFail = document.getElementById("count-fail");

const editModal = document.getElementById("edit-modal");
const modalTitle = document.getElementById("modal-title");
const modalClose = document.getElementById("modal-close");
const cancelBtn = document.getElementById("cancel-btn");
const saveBtn = document.getElementById("save-btn");
const deleteBtn = document.getElementById("delete-btn");
const modalMeta = document.getElementById("modal-meta");
const record2LockNote = document.getElementById("record2-lock-note");
const toast = document.getElementById("toast");

const fields = {
  nickname: document.getElementById("f-nickname"),
  id: document.getElementById("f-id"),
  schedule: document.getElementById("f-schedule"),
  interviewer: document.getElementById("f-interviewer"),
  interviewer2: document.getElementById("f-interviewer2"),
  age: document.getElementById("f-age"),
  gender: document.getElementById("f-gender"),
  newnickname: document.getElementById("f-newnickname"),
  record1: document.getElementById("f-record1"),
  record2: document.getElementById("f-record2"),
  result1: document.getElementById("f-result1"),
  result2: document.getElementById("f-result2"),
};

let allCandidates = [];
let editingId = null;
let currentAdmin = null;
let isFirstLoginMode = false;

// ---- 로그인 화면 초기화 ----
ADMIN_NAMES.forEach((name) => {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  loginNameSelect.appendChild(opt);
});

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add("hidden"), 2200);
}

// ---- 비밀번호 눈표시 토글 (공통) ----
document.querySelectorAll(".pw-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = document.getElementById(btn.dataset.target);
    if (!target) return;
    target.type = target.type === "password" ? "text" : "password";
    btn.classList.toggle("active");
  });
});

// ---- 다크모드 / 밝은모드 토글 ----
function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  const icon = isDark ? "☀️" : "🌙";
  if (themeToggle) themeToggle.textContent = icon;
  if (themeToggleLogin) themeToggleLogin.textContent = icon;
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

[themeToggle, themeToggleLogin].forEach((btn) => {
  if (btn) btn.addEventListener("click", toggleTheme);
});

applyTheme(localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light");

// ---- 이름 선택 시: 최초 로그인인지 확인해서 UI 전환 ----
loginNameSelect.addEventListener("change", async () => {
  loginError.textContent = "";
  loginPasswordInput.value = "";
  loginPasswordConfirmInput.value = "";
  const name = loginNameSelect.value;
  if (!name) {
    firstLoginNotice.classList.add("hidden");
    loginPasswordConfirmWrap.classList.add("hidden");
    isFirstLoginMode = false;
    return;
  }
  try {
    const doc = await adminsRef.doc(name).get();
    const hasPassword = doc.exists && doc.data().password;
    isFirstLoginMode = !hasPassword;
    firstLoginNotice.classList.toggle("hidden", !isFirstLoginMode);
    loginPasswordConfirmWrap.classList.toggle("hidden", !isFirstLoginMode);
    loginBtn.textContent = isFirstLoginMode ? "비밀번호 설정하고 로그인" : "로그인";
  } catch (err) {
    console.error(err);
    loginError.textContent = "계정 정보를 불러오지 못했습니다.";
  }
});

// ---- 로그인 / 최초 비밀번호 설정 ----
loginBtn.addEventListener("click", async () => {
  const name = loginNameSelect.value;
  const password = loginPasswordInput.value;
  loginError.textContent = "";

  if (!name) {
    loginError.textContent = "이름을 선택하세요.";
    return;
  }
  if (!password) {
    loginError.textContent = "비밀번호를 입력하세요.";
    return;
  }
  if (password.length < 4) {
    loginError.textContent = "비밀번호는 4자 이상으로 입력하세요.";
    return;
  }

  loginBtn.disabled = true;

  try {
    if (isFirstLoginMode) {
      const confirm = loginPasswordConfirmInput.value;
      if (password !== confirm) {
        loginError.textContent = "비밀번호 확인이 일치하지 않습니다.";
        loginBtn.disabled = false;
        return;
      }
      await adminsRef.doc(name).set({
        password,
        updatedAt: new Date().toISOString(),
      });
      loginSuccess(name);
    } else {
      const doc = await adminsRef.doc(name).get();
      if (!doc.exists || doc.data().password !== password) {
        loginError.textContent = "비밀번호가 올바르지 않습니다.";
        loginBtn.disabled = false;
        return;
      }
      loginSuccess(name);
    }
  } catch (err) {
    console.error(err);
    loginError.textContent = "로그인 처리 중 오류가 발생했습니다: " + err.message;
  } finally {
    loginBtn.disabled = false;
  }
});

[loginPasswordInput, loginPasswordConfirmInput].forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loginBtn.click();
  });
});

function loginSuccess(name) {
  currentAdmin = name;
  localStorage.setItem(SESSION_KEY, name);
  enterMainScreen();
}

function enterMainScreen() {
  currentUserLabel.textContent = `${currentAdmin}님`;
  loginScreen.classList.add("hidden");
  mainScreen.classList.remove("hidden");
  loginPasswordInput.value = "";
  loginPasswordConfirmInput.value = "";
  subscribeCandidates();
}

logoutBtn.addEventListener("click", () => {
  currentAdmin = null;
  localStorage.removeItem(SESSION_KEY);
  loginNameSelect.value = "";
  firstLoginNotice.classList.add("hidden");
  loginPasswordConfirmWrap.classList.add("hidden");
  loginBtn.textContent = "로그인";
  mainScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  if (unsubscribe) unsubscribe();
});

// ---- 계정 관리 모달 (비밀번호 확인 / 초기화) ----
accountManageBtn.addEventListener("click", async () => {
  await renderAccountList();
  accountModal.classList.remove("hidden");
});
accountModalClose.addEventListener("click", () => accountModal.classList.add("hidden"));
accountModal.addEventListener("click", (e) => {
  if (e.target === accountModal) accountModal.classList.add("hidden");
});

async function renderAccountList() {
  accountList.innerHTML = "<p class='hint'>불러오는 중...</p>";
  const snap = await adminsRef.get();
  const data = {};
  snap.forEach((d) => (data[d.id] = d.data()));

  accountList.innerHTML = "";
  ADMIN_NAMES.forEach((name) => {
    const info = data[name];
    const row = document.createElement("div");
    row.className = "account-row";

    const nameEl = document.createElement("div");
    nameEl.className = "acc-name";
    nameEl.textContent = name;

    const statusEl = document.createElement("div");
    if (info && info.password) {
      statusEl.className = "acc-status";
      statusEl.dataset.password = info.password;
      statusEl.dataset.masked = "true";
      statusEl.textContent = "••••••••";
    } else {
      statusEl.className = "acc-status not-set";
      statusEl.textContent = "아직 비밀번호를 설정하지 않음";
    }

    row.appendChild(nameEl);
    row.appendChild(statusEl);

    if (info && info.password) {
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "ghost";
      toggleBtn.textContent = "👁 보기";
      toggleBtn.addEventListener("click", () => {
        const masked = statusEl.dataset.masked === "true";
        statusEl.textContent = masked ? statusEl.dataset.password : "••••••••";
        statusEl.dataset.masked = masked ? "false" : "true";
        toggleBtn.textContent = masked ? "🙈 숨기기" : "👁 보기";
      });
      row.appendChild(toggleBtn);

      const resetBtn = document.createElement("button");
      resetBtn.className = "ghost";
      resetBtn.textContent = "초기화";
      resetBtn.addEventListener("click", async () => {
        if (!confirm(`${name}님의 비밀번호를 초기화할까요? 다음 로그인 때 새로 설정하게 됩니다.`)) return;
        await adminsRef.doc(name).delete();
        showToast(`${name}님의 비밀번호가 초기화되었습니다.`);
        renderAccountList();
      });
      row.appendChild(resetBtn);
    }

    accountList.appendChild(row);
  });
}

// ---- 목록 실시간 구독 ----
let unsubscribe = null;
function subscribeCandidates() {
  if (unsubscribe) unsubscribe();
  unsubscribe = candidatesRef.orderBy("createdAt", "desc").onSnapshot(
    (snap) => {
      allCandidates = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTable();
    },
    (err) => {
      console.error(err);
      showToast("데이터를 불러오지 못했습니다: " + err.message);
    }
  );
}

function classifyCandidate(c) {
  if (c.result1 === "탈락" || c.result2 === "탈락") return "fail";
  if (c.result1 === "합격" && c.result2 === "합격") return "pass";
  return "pending";
}

function renderRow(c) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td data-label="닉네임">${escapeHtml(c.nickname)}</td>
    <td data-label="ID">${escapeHtml(c.candidateId)}</td>
    <td data-label="면접일정">${formatSchedule(c.schedule)}</td>
    <td data-label="나이">${escapeHtml(c.age)}</td>
    <td data-label="성별">${genderBadge(c.gender)}</td>
    <td data-label="1차 담당 면접관">${c.interviewer ? escapeHtml(c.interviewer) : '<span class="badge pending">미정</span>'}</td>
    <td data-label="1차 결과">${resultBadge(c.result1)}</td>
    <td data-label="2차 결과">${resultBadge(c.result2)}</td>
    <td data-label="변경 후 닉네임">${escapeHtml(c.newnickname)}</td>
  `;
  tr.addEventListener("click", () => openModal(c));
  return tr;
}

function renderTable() {
  const query = searchBox.value.trim().toLowerCase();
  const filtered = allCandidates.filter((c) => {
    if (!query) return true;
    return (
      (c.nickname || "").toLowerCase().includes(query) ||
      (c.candidateId || "").toLowerCase().includes(query)
    );
  });

  emptyMsg.classList.toggle("hidden", filtered.length !== 0);

  const groups = { pending: [], pass: [], fail: [] };
  filtered.forEach((c) => groups[classifyCandidate(c)].push(c));

  const sections = [
    { key: "pending", tbody: tbodyPending, emptyEl: emptyPending, countEl: countPending },
    { key: "pass", tbody: tbodyPass, emptyEl: emptyPass, countEl: countPass },
    { key: "fail", tbody: tbodyFail, emptyEl: emptyFail, countEl: countFail },
  ];

  sections.forEach(({ key, tbody: body, emptyEl, countEl }) => {
    const items = groups[key];
    body.innerHTML = "";
    items.forEach((c) => body.appendChild(renderRow(c)));
    emptyEl.classList.toggle("hidden", items.length !== 0);
    countEl.textContent = items.length;
  });
}

function genderBadge(gender) {
  if (gender === "남성") return `<span class="badge male">남성</span>`;
  if (gender === "여성") return `<span class="badge female">여성</span>`;
  return "";
}

function resultBadge(result) {
  if (result === "합격") return `<span class="badge pass">합격</span>`;
  if (result === "탈락") return `<span class="badge fail">탈락</span>`;
  return `<span class="badge pending">미정</span>`;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function scheduleParts(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hour24 = d.getHours();
  const ampm = hour24 < 12 ? "오전" : "오후";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const min = pad(d.getMinutes());
  return { date: `${yyyy}년 ${mm}월 ${dd}일`, time: `${ampm} ${hour12}시 ${min}분` };
}

function formatDateTimeText(iso) {
  if (!iso) return "";
  const parts = scheduleParts(iso);
  if (!parts) return iso;
  return `${parts.date} ${parts.time}`;
}

function formatSchedule(iso) {
  if (!iso) return "";
  const parts = scheduleParts(iso);
  if (!parts) return escapeHtml(iso);
  return `<div class="schedule-date">${parts.date}</div><div class="schedule-time">${parts.time}</div>`;
}

searchBox.addEventListener("input", renderTable);

// ---- 면접자 상세/편집 모달 ----
function resetFields() {
  Object.values(fields).forEach((el) => (el.value = ""));
}

function openModal(candidate) {
  resetFields();
  modalMeta.textContent = "";
  if (candidate) {
    editingId = candidate.id;
    modalTitle.textContent = "면접자 정보";
    fields.nickname.value = candidate.nickname || "";
    fields.id.value = candidate.candidateId || "";
    fields.schedule.value = candidate.schedule || "";
    fields.interviewer.value = candidate.interviewer || "";
    fields.interviewer2.value = candidate.interviewer2 || SECOND_ROUND_INTERVIEWER;
    fields.age.value = candidate.age || "";
    fields.gender.value = candidate.gender || "";
    fields.newnickname.value = candidate.newnickname || "";
    fields.record1.value = candidate.record1 || "";
    fields.record2.value = candidate.record2 || "";
    fields.result1.value = candidate.result1 || "";
    fields.result2.value = candidate.result2 || "";
    deleteBtn.classList.remove("hidden");
    const created = candidate.createdAt ? formatDateTimeText(candidate.createdAt) : "";
    const updated = candidate.updatedAt ? formatDateTimeText(candidate.updatedAt) : "";
    modalMeta.textContent = `등록: ${candidate.createdBy || "-"} (${created}) / 최근 수정: ${candidate.updatedBy || "-"} (${updated})`;
  } else {
    editingId = null;
    modalTitle.textContent = "면접자 추가";
    deleteBtn.classList.add("hidden");
    // 1차 담당 면접관은 현재 로그인한 사람으로 자동 지정, 2차는 항상 떵구
    fields.interviewer.value = currentAdmin || "";
    fields.interviewer2.value = SECOND_ROUND_INTERVIEWER;
  }

  // 2차 면접 기록/결과는 떵구만 수정 가능, 나머지는 열람만
  const canEditSecondRound = currentAdmin === SECOND_ROUND_INTERVIEWER;
  fields.record2.disabled = !canEditSecondRound;
  fields.result2.disabled = !canEditSecondRound;
  record2LockNote.classList.toggle("hidden", canEditSecondRound);

  editModal.classList.remove("hidden");
}

function closeModal() {
  editModal.classList.add("hidden");
  editingId = null;
}

addBtn.addEventListener("click", () => openModal(null));
modalClose.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeModal();
});

saveBtn.addEventListener("click", async () => {
  const nickname = fields.nickname.value.trim();
  if (!nickname) {
    showToast("닉네임을 입력하세요.");
    return;
  }

  const actorName = currentAdmin || "알수없음";
  const now = new Date().toISOString();

  const data = {
    nickname,
    candidateId: fields.id.value.trim(),
    schedule: fields.schedule.value,
    interviewer: fields.interviewer.value,
    interviewer2: fields.interviewer2.value,
    age: fields.age.value ? Number(fields.age.value) : "",
    gender: fields.gender.value,
    newnickname: fields.newnickname.value.trim(),
    record1: fields.record1.value,
    record2: fields.record2.value,
    result1: fields.result1.value,
    result2: fields.result2.value,
    updatedAt: now,
    updatedBy: actorName,
  };

  saveBtn.disabled = true;
  try {
    if (editingId) {
      await candidatesRef.doc(editingId).update(data);
      showToast("저장되었습니다.");
    } else {
      data.createdAt = now;
      data.createdBy = actorName;
      await candidatesRef.add(data);
      showToast("추가되었습니다.");
    }
    closeModal();
  } catch (err) {
    console.error(err);
    showToast("저장 실패: " + err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

deleteBtn.addEventListener("click", async () => {
  if (!editingId) return;
  if (!confirm("이 면접자 정보를 삭제할까요? 되돌릴 수 없습니다.")) return;
  try {
    await candidatesRef.doc(editingId).delete();
    showToast("삭제되었습니다.");
    closeModal();
  } catch (err) {
    console.error(err);
    showToast("삭제 실패: " + err.message);
  }
});

// 이전에 로그인한 적 있으면 자동 로그인 유지 (모든 초기화가 끝난 뒤 마지막에 실행)
(function restoreSession() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved && ADMIN_NAMES.includes(saved)) {
    currentAdmin = saved;
    enterMainScreen();
  }
})();
