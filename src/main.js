import "./style.css";

// ----- 초기 더미 데이터 -----
const SEED_STUDENTS = [
  { studentId: "S2301", name: "김철수" },
  { studentId: "S2302", name: "이영희" },
  { studentId: "S2303", name: "박민수" },
];

const SEED_ITEMS = [
  { itemId: "E001", name: "오실로스코프", status: "available" },
  { itemId: "E002", name: "멀티미터", status: "available" },
  { itemId: "E003", name: "파워서플라이", status: "available" },
  { itemId: "A101", name: "토크렌치", status: "available" },
  { itemId: "A102", name: "OBD-II 스캐너", status: "available" },
];

// localStorage key
const STORAGE_KEY = "smart-lab-manager-data-v1";

// ----- 상태 관리 -----
let state = {
  students: [],
  items: [],
  tx: [], // {id, ts, studentId, itemId, action, note}
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      state = JSON.parse(saved);
      return;
    } catch (e) {
      console.error("Failed to parse saved data, resetting", e);
    }
  }
  // 처음 실행 시 seed
  state = {
    students: SEED_STUDENTS,
    items: SEED_ITEMS,
    tx: [],
  };
  saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function addTx({ studentId = "", itemId, action, note = "" }) {
  state.tx.unshift({
    id: Date.now() + "-" + Math.random().toString(16).slice(2),
    ts: new Date().toISOString().slice(0, 19).replace("T", " "),
    studentId,
    itemId,
    action,
    note,
  });
  if (state.tx.length > 200) state.tx = state.tx.slice(0, 200);
}

// ----- 비즈니스 로직 -----
function borrowItem(studentId, itemId) {
  studentId = studentId.trim();
  itemId = itemId.trim();

  if (!studentId || !itemId) {
    alert("학생ID와 자산ID를 모두 입력하세요.");
    return;
  }

  const student = state.students.find((s) => s.studentId === studentId);
  if (!student) {
    if (!confirm("등록되지 않은 학생입니다. 그래도 진행할까요?")) return;
  }

  const item = state.items.find((i) => i.itemId === itemId);
  if (!item) {
    alert(`자산 ${itemId} 가 존재하지 않습니다.`);
    return;
  }

  if (item.status !== "available") {
    alert(`자산 ${itemId} 는 현재 대여 불가 상태 (${item.status}) 입니다.`);
    return;
  }

  item.status = "borrowed";
  addTx({ studentId, itemId, action: "borrow" });
  saveState();
  renderStats();
  renderHistory();
  renderItemTable();
  alert(`대여 완료: 학생 ${studentId} ← ${itemId}`);
}

function returnItem(itemId, note) {
  itemId = itemId.trim();
  note = note.trim();

  if (!itemId) {
    alert("자산ID를 입력하세요.");
    return;
  }

  const item = state.items.find((i) => i.itemId === itemId);
  if (!item) {
    alert(`자산 ${itemId} 가 존재하지 않습니다.`);
    return;
  }

  if (item.status !== "borrowed") {
    alert(`자산 ${itemId} 는 대여 상태가 아닙니다. (현재 ${item.status})`);
    return;
  }

  item.status = "available";
  addTx({ itemId, action: "return", note });
  saveState();
  renderStats();
  renderHistory();
  renderItemTable();
  alert(`반납 완료: ${itemId}`);
}

function reportIssue(itemId, issueType, note) {
  itemId = itemId.trim();
  note = note.trim();

  if (!itemId) {
    alert("자산ID를 입력하세요.");
    return;
  }
  if (!["loss", "damage"].includes(issueType)) {
    alert("유형은 loss 또는 damage만 가능합니다.");
    return;
  }

  const item = state.items.find((i) => i.itemId === itemId);
  if (!item) {
    alert(`자산 ${itemId} 가 존재하지 않습니다.`);
    return;
  }

  item.status = issueType === "loss" ? "lost" : "damaged";
  addTx({ itemId, action: issueType, note });
  saveState();
  renderStats();
  renderHistory();
  renderItemTable();
  alert(
    `${issueType === "loss" ? "분실" : "고장"} 처리 완료: ${itemId}`
  );
}

function addItem(itemId, name) {
  itemId = itemId.trim();
  name = name.trim();

  if (!itemId || !name) {
    alert("자산ID와 자산명을 모두 입력하세요.");
    return;
  }

  const exists = state.items.find((i) => i.itemId === itemId);
  if (exists) {
    alert("이미 존재하는 자산ID입니다.");
    return;
  }

  state.items.push({ itemId, name, status: "available" });
  saveState();
  renderStats();
  renderItemTable();
  alert(`자산 등록 완료: ${itemId} - ${name}`);
}

// ----- UI 렌더링 -----
function renderStats() {
  const total = state.items.length;
  const borrowed = state.items.filter((i) => i.status === "borrowed").length;
  const damaged = state.items.filter((i) => i.status === "damaged").length;
  const lost = state.items.filter((i) => i.status === "lost").length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-borrowed").textContent = borrowed;
  document.getElementById("stat-damaged").textContent = damaged;
  document.getElementById("stat-lost").textContent = lost;
}

function renderHistory() {
  const ul = document.getElementById("history-list");
  ul.innerHTML = "";

  const entries = state.tx.slice(0, 40);
  if (entries.length === 0) {
    ul.innerHTML =
      '<li class="history-item">아직 기록이 없습니다. 첫 대여를 진행해 보세요.</li>';
    return;
  }

  for (const row of entries) {
    const li = document.createElement("li");
    li.className = "history-item";

    const tagSpan = document.createElement("span");
    tagSpan.classList.add("tag");
    if (row.action === "borrow") tagSpan.classList.add("tag-borrow");
    else if (row.action === "return") tagSpan.classList.add("tag-return");
    else tagSpan.classList.add("tag-damage");

    tagSpan.textContent = row.action;
    li.appendChild(tagSpan);
    li.appendChild(
      document.createTextNode(
        ` ${row.ts} | 학생: ${row.studentId || "-"} | 자산: ${
          row.itemId
        } ${row.note ? " | " + row.note : ""}`
      )
    );
    ul.appendChild(li);
  }
}

function renderItemTable() {
  const container = document.getElementById("item-table");
  if (!container) return;

  if (state.items.length === 0) {
    container.innerHTML =
      '<p class="small-tip">등록된 자산이 없습니다. 아래 폼에서 먼저 추가해 주세요.</p>';
    return;
  }

  const rows = state.items
    .map((item) => {
      return `
        <tr>
          <td>${item.itemId}</td>
          <td>${item.name}</td>
          <td>
            <span class="badge-status ${item.status}">
              ● ${item.status}
            </span>
          </td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:6px;">
      <thead>
        <tr style="text-align:left; border-bottom:1px solid #1f2937;">
          <th style="padding:4px 0;">자산ID</th>
          <th style="padding:4px 0;">자산명</th>
          <th style="padding:4px 0;">상태</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function render() {
  const app = document.querySelector("#app");
  app.innerHTML = `
    <header class="app-header">
      <div class="app-header-left">
        <div class="app-logo-wrap">
          <!-- public/ysrail-logo.png -->
          <img src="/ysrail-logo.png" alt="용산철도고 로고" />
        </div>
        <div class="app-title-block">
          <div class="school-name">용산철도고등학교 · 철도전자통신과</div>
          <div class="app-title">Smart Lab Manager</div>
          <div class="app-subtitle">
            실습 기자재 대여 · 반납 · 고장 · 분실 관리 웹 프로토타입
          </div>
        </div>
      </div>
      <div class="app-header-right">
        <div>PYTHON 응용 프로젝트 · 최동수 · 이상훈</div>
        <div>※ 실제 운영 시 서버·DB 연동 및 QR 스캐너 확장 가능</div>
      </div>
    </header>

    <div class="grid">
      <div>
        <div class="card">
          <div class="card-header">
            <span>대여</span>
            <span class="badge">Borrow</span>
          </div>
          <div>
            <div class="form-row">
              <div class="form-field">
                <label class="label">학생ID</label>
                <input id="borrow-student" class="input" placeholder="예: S2301" />
              </div>
              <div class="form-field">
                <label class="label">자산ID</label>
                <input id="borrow-item" class="input" placeholder="예: E001" />
              </div>
            </div>

            <!-- QR 코드 값 입력 영역 -->
            <div class="form-row">
              <div class="form-field">
                <label class="label">QR 코드 값</label>
                <input
                  id="qr-input"
                  class="input"
                  placeholder="스캐너 / 휴대폰 앱에서 읽은 코드 붙여넣기"
                />
              </div>
              <div class="form-field" style="max-width: 150px; align-self: flex-end;">
                <button id="btn-apply-qr" class="btn btn-outline" type="button">
                  QR값 → 자산ID
                </button>
              </div>
            </div>

            <button id="btn-borrow" class="btn btn-primary">
              대여하기
            </button>
            <p class="small-tip">
              현장에서는 QR 스캐너로 자산 코드를 읽어 이 영역에 자동 입력하고,
              지금 프로토타입에서는 스캔 결과 텍스트를 직접 붙여넣어 시연합니다.
            </p>
          </div>
        </div>

        <div class="card" style="margin-top:14px;">
          <div class="card-header">
            <span>반납</span>
            <span class="badge">Return</span>
          </div>
          <div>
            <div class="form-row">
              <div class="form-field">
                <label class="label">자산ID</label>
                <input id="return-item" class="input" placeholder="예: E001" />
              </div>
              <div class="form-field">
                <label class="label">메모 (선택)</label>
                <input id="return-note" class="input" placeholder="상태, 비고 등" />
              </div>
            </div>
            <button id="btn-return" class="btn btn-success">
              반납 처리
            </button>
          </div>
        </div>

        <div class="card" style="margin-top:14px;">
          <div class="card-header">
            <span>고장 / 분실 신고</span>
            <span class="badge">Damage / Loss</span>
          </div>
          <div>
            <div class="form-row">
              <div class="form-field">
                <label class="label">자산ID</label>
                <input id="issue-item" class="input" placeholder="예: A101" />
              </div>
              <div class="form-field">
                <label class="label">유형</label>
                <select id="issue-type" class="select">
                  <option value="damage">damage (고장)</option>
                  <option value="loss">loss (분실)</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label class="label">메모</label>
                <textarea id="issue-note" class="textarea" placeholder="고장/분실 상황 간단 기록"></textarea>
              </div>
            </div>
            <button id="btn-issue" class="btn btn-warning">
              신고 저장
            </button>
          </div>
        </div>

        <div class="card" style="margin-top:14px;">
          <div class="card-header">
            <span>자산 등록 (데모용)</span>
            <span class="badge">Admin</span>
          </div>
          <div>
            <div class="form-row">
              <div class="form-field">
                <label class="label">자산ID</label>
                <input id="new-item-id" class="input" placeholder="예: E004" />
              </div>
              <div class="form-field">
                <label class="label">자산명</label>
                <input id="new-item-name" class="input" placeholder="예: 납땜 인두기" />
              </div>
            </div>
            <button id="btn-add-item" class="btn btn-secondary">
              자산 추가
            </button>
            <p class="small-tip">
              실제 운영 시에는 관리자 전용 화면으로 분리하고, QR/바코드와 연동하여 자산을 일괄 등록할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-header">
            <span>실습 기자재 현황</span>
            <button id="btn-refresh" class="btn btn-outline" type="button">
              새로고침
            </button>
          </div>
          <div class="stats">
            <div class="stat-box">
              <div class="stat-label">총 자산</div>
              <div class="stat-value" id="stat-total">-</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">대여중</div>
              <div class="stat-value" id="stat-borrowed">-</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">고장</div>
              <div class="stat-value" id="stat-damaged">-</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">분실</div>
              <div class="stat-value" id="stat-lost">-</div>
            </div>
          </div>
          <div id="item-table"></div>
        </div>

        <div class="card" style="margin-top:14px;">
          <div class="card-header">
            <span>최근 이력 (최대 40개)</span>
          </div>
          <ul id="history-list" class="history-list"></ul>
        </div>
      </div>
    </div>
  `;

  // 이벤트 바인딩
  document
    .getElementById("btn-borrow")
    .addEventListener("click", () => {
      const sid = document.getElementById("borrow-student").value;
      const iid = document.getElementById("borrow-item").value;
      borrowItem(sid, iid);
    });

  document
    .getElementById("btn-return")
    .addEventListener("click", () => {
      const iid = document.getElementById("return-item").value;
      const note = document.getElementById("return-note").value;
      returnItem(iid, note);
    });

  document
    .getElementById("btn-issue")
    .addEventListener("click", () => {
      const iid = document.getElementById("issue-item").value;
      const type = document.getElementById("issue-type").value;
      const note = document.getElementById("issue-note").value;
      reportIssue(iid, type, note);
    });

  document
    .getElementById("btn-add-item")
    .addEventListener("click", () => {
      const iid = document.getElementById("new-item-id").value;
      const name = document.getElementById("new-item-name").value;
      addItem(iid, name);
    });

  document
    .getElementById("btn-refresh")
    .addEventListener("click", () => {
      renderStats();
      renderHistory();
      renderItemTable();
    });

  // QR → 자산ID 적용
  document
    .getElementById("btn-apply-qr")
    .addEventListener("click", () => {
      const qrVal = document.getElementById("qr-input").value.trim();
      if (!qrVal) {
        alert("QR 코드 값을 먼저 입력하세요.");
        return;
      }
      document.getElementById("borrow-item").value = qrVal;
    });

  // 통계/이력/자산 테이블 첫 렌더
  renderStats();
  renderHistory();
  renderItemTable();
}

// ----- 시작 -----
loadState();
render();
