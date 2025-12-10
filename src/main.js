import "./style.css";

/**
 * v4: 학년/이름 드롭다운, 자산 10종*5대, 상태별 필터링,
 *     히스토리 필터 + 지연 표시, AI 기반 지연 안내 문자 생성
 */

// ===== 0. AI 세팅 =====
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";

// ===== 1. 더미 학생 데이터 생성 =====
function makeSeedStudents() {
  // 19명 + 1명(김유경) = 20명
  const baseNames = [
    "김가람",
    "이도윤",
    "박서연",
    "최민준",
    "정하린",
    "한지우",
    "윤서준",
    "장예린",
    "조하준",
    "서다인",
    "임준호",
    "권수아",
    "백시우",
    "문채원",
    "신도영",
    "오지호",
    "양서윤",
    "홍예준",
    "하나래",
  ];

  const students = [];
  for (let grade = 1; grade <= 3; grade++) {
    const classNo = 1; // 각 학년 1반
    for (let i = 0; i < 20; i++) {
      let name;

      if (grade === 1 && i === 0) {
        // 1학년 1반 1번은 김유경 (교수님)
        name = "김유경";
      } else {
        const idx = (grade * 20 + i) % baseNames.length;
        name = baseNames[idx];
      }

      const num = String(i + 1).padStart(2, "0");
      const studentId = `${grade}${num}`; // 예: 101, 102 ...

      students.push({ studentId, name, grade, classNo });
    }
  }
  return students;
}

// ===== 2. 자산 데이터 생성 =====
const ASSET_TYPES = [
  { code: "E001", name: "오실로스코프" },
  { code: "E002", name: "멀티미터" },
  { code: "E003", name: "파워서플라이" },
  { code: "A101", name: "토크렌치" },
  { code: "A102", name: "OBD-II 스캐너" },
  { code: "S001", name: "인두기" },
  { code: "S002", name: "노트북" },
  { code: "S003", name: "리플로우장비" },
  { code: "S004", name: "브레드보드" },
  { code: "S005", name: "디지털캘리퍼스" },
];

function makeSeedItems() {
  const items = [];
  ASSET_TYPES.forEach((t) => {
    for (let i = 0; i < 5; i++) {
      const suffix = String(i + 1).padStart(2, "0");
      const itemId = `${t.code}-${suffix}`;
      items.push({
        itemId,
        group: t.name,
        status: "available",
      });
    }
  });
  return items;
}

// ===== 3. 상태 관리 / 저장 =====
const STORAGE_KEY = "smart-lab-manager-data-v4";

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
  state = {
    students: makeSeedStudents(),
    items: makeSeedItems(),
    tx: [],
  };
  saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function nowString() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function addTx({ studentId = "", itemId, action, note = "" }) {
  state.tx.unshift({
    id: Date.now() + "-" + Math.random().toString(16).slice(2),
    ts: nowString(),
    studentId,
    itemId,
    action,
    note,
  });
  if (state.tx.length > 400) state.tx = state.tx.slice(0, 400);
}

// ===== 4. 비즈니스 로직 =====
function borrowItem(studentId, itemId) {
  studentId = (studentId || "").trim();
  itemId = (itemId || "").trim();

  if (!studentId || !itemId) {
    alert("학생과 자산을 모두 선택하세요.");
    return;
  }

  const student = state.students.find((s) => s.studentId === studentId);
  if (!student) {
    alert("선택한 학생이 존재하지 않습니다.");
    return;
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
  rerenderAll();
  alert(
    `대여 완료: ${student.grade}학년 ${student.classNo}반 ${student.name} ← ${itemId}`
  );
}

function returnItem(itemId, note) {
  itemId = (itemId || "").trim();
  note = (note || "").trim();

  if (!itemId) {
    alert("반납할 자산을 선택하세요.");
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
  rerenderAll();
  alert(`반납 완료: ${itemId}`);
}

function reportIssue(itemId, issueType, note) {
  itemId = (itemId || "").trim();
  note = (note || "").trim();

  if (!itemId) {
    alert("자산을 선택하세요.");
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
  rerenderAll();
  alert(
    `${issueType === "loss" ? "분실" : "고장"} 처리 완료: ${itemId}`
  );
}

function restoreItem(itemId, note, restoreType = "restore") {
  itemId = (itemId || "").trim();
  note = (note || "").trim();

  if (!itemId) {
    alert("복구할 자산을 선택하세요.");
    return;
  }

  const item = state.items.find((i) => i.itemId === itemId);
  if (!item) {
    alert(`자산 ${itemId} 가 존재하지 않습니다.`);
    return;
  }

  if (!["lost", "damaged"].includes(item.status)) {
    alert(`자산 ${itemId} 는 복구 대상 상태가 아닙니다. (현재 ${item.status})`);
    return;
  }

  item.status = "available";
  addTx({ itemId, action: restoreType, note });
  saveState();
  rerenderAll();
  alert(`복구 완료: ${itemId}`);
}

function addItem(itemId, name) {
  itemId = (itemId || "").trim();
  name = (name || "").trim();

  if (!itemId || !name) {
    alert("자산ID와 자산명을 모두 입력하세요.");
    return;
  }

  const exists = state.items.find((i) => i.itemId === itemId);
  if (exists) {
    alert("이미 존재하는 자산ID입니다.");
    return;
  }

  state.items.push({ itemId, group: name, status: "available" });
  saveState();
  rerenderAll();
  alert(`자산 등록 완료: ${itemId} - ${name}`);
}

// ===== 5. 지연 대여 계산 =====
function getOverdueList(minDays = 3) {
  const result = [];
  const now = Date.now();

  // status가 borrowed인 것만 대상으로
  const borrowedItems = state.items.filter((i) => i.status === "borrowed");

  borrowedItems.forEach((item) => {
    // 해당 자산의 가장 최근 borrow 기록
    const borrowTx = state.tx.find(
      (t) => t.itemId === item.itemId && t.action === "borrow"
    );
    if (!borrowTx) return;

    const d = new Date(borrowTx.ts.replace(" ", "T"));
    const diffDays = Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < minDays) return;

    const student = state.students.find((s) => s.studentId === borrowTx.studentId);

    result.push({
      item,
      tx: borrowTx,
      student,
      days: diffDays,
    });
  });

  return result;
}

// ===== 6. 통계 / 상위 고장 =====
function renderStats() {
  const total = state.items.length;
  const borrowed = state.items.filter((i) => i.status === "borrowed").length;
  const damaged = state.items.filter((i) => i.status === "damaged").length;
  const lost = state.items.filter((i) => i.status === "lost").length;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-borrowed").textContent = borrowed;
  document.getElementById("stat-damaged").textContent = damaged;
  document.getElementById("stat-lost").textContent = lost;

  // 고장/분실 상위 자산 top3
  const lossMap = {};
  state.tx
    .filter((t) => t.action === "loss" || t.action === "damage")
    .forEach((t) => {
      lossMap[t.itemId] = (lossMap[t.itemId] || 0) + 1;
    });

  const top = Object.entries(lossMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const list = document.getElementById("top-issue-list");
  if (!list) return;

  list.innerHTML = "";
  if (top.length === 0) {
    list.innerHTML =
      '<li class="small-tip">아직 고장/분실 기록이 없습니다.</li>';
    return;
  }

  top.forEach(([itemId, count]) => {
    const li = document.createElement("li");
    li.className = "small-tip";
    const item = state.items.find((i) => i.itemId === itemId);
    li.textContent = `${itemId} (${item ? item.group : "Unknown"}) - ${count}회`;
    list.appendChild(li);
  });
}

// ===== 7. 히스토리 렌더링 =====
function getHistoryFilters() {
  const sSel = document.getElementById("history-student-select");
  const iSel = document.getElementById("history-item-select");
  return {
    studentFilter: sSel ? sSel.value : "",
    itemFilter: iSel ? iSel.value : "",
  };
}

function renderHistory() {
  const ul = document.getElementById("history-list");
  if (!ul) return;

  ul.innerHTML = "";

  const { studentFilter, itemFilter } = getHistoryFilters();

  let entries = state.tx.slice(); // 전체
  if (studentFilter) {
    entries = entries.filter((t) => t.studentId === studentFilter);
  }
  if (itemFilter) {
    entries = entries.filter((t) => t.itemId === itemFilter);
  }

  entries = entries.slice(0, 80); // 화면용

  if (entries.length === 0) {
    ul.innerHTML =
      '<li class="history-item">조건에 맞는 기록이 없습니다.</li>';
    return;
  }

  entries.forEach((row) => {
    const li = document.createElement("li");
    li.className = "history-item";

    const tagSpan = document.createElement("span");
    tagSpan.classList.add("tag");
    if (row.action === "borrow") tagSpan.classList.add("tag-borrow");
    else if (row.action === "return" || row.action === "restore")
      tagSpan.classList.add("tag-return");
    else tagSpan.classList.add("tag-damage");
    tagSpan.textContent = row.action;
    li.appendChild(tagSpan);

    const student = state.students.find((s) => s.studentId === row.studentId);

    const studentText = student
      ? `${student.grade}학년 ${student.classNo}반 ${student.name}`
      : row.studentId || "-";

    const baseText = ` ${row.ts} | 학생: ${studentText} | 자산: ${
      row.itemId
    }${row.note ? " | " + row.note : ""}`;

    // 지연 대여 표시: borrow 이후 3일 이상 + 아직 borrowed 상태이면
    let overdueText = "";
    if (row.action === "borrow") {
      const item = state.items.find((i) => i.itemId === row.itemId);
      if (item && item.status === "borrowed") {
        const d = new Date(row.ts.replace(" ", "T"));
        const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 3) {
          li.classList.add("overdue");
          overdueText = ` (지연 ${diffDays}일)`;
        }
      }
    }

    li.appendChild(document.createTextNode(baseText + overdueText));
    ul.appendChild(li);
  });
}

// ===== 8. 자산 테이블 =====
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
          <td>${item.group}</td>
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

// ===== 9. AI 지연 문자 생성 =====
async function generateOverdueSms(overdue, extraNote) {
  const student = overdue.student;
  const item = overdue.item;
  const days = overdue.days;

  const studentText = student
    ? `${student.grade}학년 ${student.classNo}반 ${student.name} 학생`
    : "해당 학생";

  const baseInfo = `학생: ${studentText}, 기자재: ${item.group} (${item.itemId}), 지연일수: ${days}일`;

  // API 키가 없으면 샘플 문구 생성
  if (!OPENAI_API_KEY) {
    return (
      `${studentText}, 안녕하세요.\n` +
      `실습 기자재 "${item.group} (${item.itemId})"가 현재 ${days}일째 미반납 상태입니다.\n` +
      `오늘 중으로 실습실로 반납해 주세요. (${extraNote || "궁금한 사항이 있으면 담당 교사에게 문의하세요."})`
    );
  }

  const systemPrompt =
    "당신은 한국 특성화고 교사입니다. " +
    "실습 기자재를 제때 반납하지 않은 학생에게 보내는 짧은 문자 메시지를 만들어 주세요. " +
    "톤은 정중하지만 부담스럽지 않게, 2~3문장 이내, 존댓말, 이모티콘은 사용하지 않습니다.";

  const userPrompt =
    `상황: ${baseInfo}\n` +
    `추가 안내: ${extraNote || "오늘 중으로 반납 요청"}\n\n` +
    "학생에게 바로 보낼 수 있는 문자 내용을 만들어 주세요.";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
      }),
    });

    const data = await res.json();
    const content =
      data.choices?.[0]?.message?.content?.trim() ||
      "문자 생성에 실패했습니다. 나중에 다시 시도해 주세요.";
    return content;
  } catch (err) {
    console.error(err);
    return (
      "문자 생성 중 오류가 발생했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.\n\n" +
      `임시 문구 예시:\n${studentText}, 안녕하세요. 실습 기자재 "${item.group} (${item.itemId})"가 ${days}일째 미반납 상태입니다. 오늘 중으로 반납해 주세요.`
    );
  }
}

// ===== 10. 렌더 =====
function rerenderAll() {
  render(); // 전체를 다시 그림 (단순하지만 과제용으론 충분)
}

function render() {
  const app = document.querySelector("#app");

  // 학년 옵션
  const gradeOptions = [1, 2, 3]
    .map((g) => `<option value="${g}">${g}학년</option>`)
    .join("");

  // 학생 전체 옵션 (히스토리 필터용)
  const studentOptionsAll = state.students
    .map(
      (s) =>
        `<option value="${s.studentId}">${s.grade}학년 ${s.classNo}반 ${s.name} (${s.studentId})</option>`
    )
    .join("");

  const allItems = state.items;

  // 상태별 자산 드롭다운
  const borrowItemOptions = allItems
    .filter((i) => i.status === "available")
    .map(
      (i) =>
        `<option value="${i.itemId}">${i.itemId} - ${i.group}</option>`
    )
    .join("");

  const returnItemOptions = allItems
    .filter((i) => i.status === "borrowed")
    .map(
      (i) =>
        `<option value="${i.itemId}">${i.itemId} - ${i.group}</option>`
    )
    .join("");

  const issueItemOptions = allItems
    .filter((i) => i.status === "available" || i.status === "borrowed")
    .map(
      (i) =>
        `<option value="${i.itemId}">${i.itemId} - ${i.group} [${i.status}]</option>`
    )
    .join("");

  const restoreItemOptions = allItems
    .filter((i) => i.status === "lost" || i.status === "damaged")
    .map(
      (i) =>
        `<option value="${i.itemId}">${i.itemId} - ${i.group} [${i.status}]</option>`
    )
    .join("");

  const historyItemOptions = allItems
    .map(
      (i) =>
        `<option value="${i.itemId}">${i.itemId} - ${i.group}</option>`
    )
    .join("");

  // 지연 리스트
  const overdueList = getOverdueList(3);
  // 전역 캐시처럼 쓸 수 있게 window에 잠깐 넣음
  window.__overdueCache = overdueList;

  const overdueOptions =
    overdueList.length === 0
      ? '<option value="">지연된 대여가 없습니다</option>'
      : overdueList
          .map((o, idx) => {
            const stu = o.student;
            const stuText = stu
              ? `${stu.grade}학년 ${stu.classNo}반 ${stu.name}`
              : "학생정보 없음";
            return `<option value="${idx}">${stuText} / ${o.item.group} (${o.item.itemId}) / ${o.days}일</option>`;
          })
          .join("");

  app.innerHTML = `
    <header class="app-header">
      <div class="app-header-left">
        <div class="app-logo-wrap">
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
        <div>※ 실제 운영 시 서버·DB 연동 및 AI/QR 기능 확장 가능</div>
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
                <label class="label">학년</label>
                <select id="borrow-grade-select" class="select">
                  <option value="">학년 선택</option>
                  ${gradeOptions}
                </select>
              </div>
              <div class="form-field">
                <label class="label">학생 이름</label>
                <select id="borrow-student-select" class="select">
                  <option value="">먼저 학년을 선택하세요</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label class="label">자산 선택</label>
                <select id="borrow-item-select" class="select">
                  <option value="">대여 가능한 자산</option>
                  ${borrowItemOptions}
                </select>
              </div>
            </div>
            <button id="btn-borrow" class="btn btn-primary">
              대여하기
            </button>
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
                <label class="label">반납할 자산</label>
                <select id="return-item-select" class="select">
                  <option value="">현재 대여중인 자산</option>
                  ${returnItemOptions}
                </select>
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
                <label class="label">자산 선택</label>
                <select id="issue-item-select" class="select">
                  <option value="">자산 선택</option>
                  ${issueItemOptions}
                </select>
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
            <span>복구 처리</span>
            <span class="badge">Restore</span>
          </div>
          <div>
            <div class="form-row">
              <div class="form-field">
                <label class="label">복구 대상 자산</label>
                <select id="restore-item-select" class="select">
                  <option value="">고장/분실 자산</option>
                  ${restoreItemOptions}
                </select>
              </div>
              <div class="form-field">
                <label class="label">메모 (선택)</label>
                <input id="restore-note" class="input" placeholder="예: 수리 완료, 분실품 회수 등" />
              </div>
            </div>
            <button id="btn-restore" class="btn btn-success">
              복구 완료 처리
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
                <input id="new-item-id" class="input" placeholder="예: X001-01" />
              </div>
              <div class="form-field">
                <label class="label">자산명</label>
                <input id="new-item-name" class="input" placeholder="예: 신형 장비" />
              </div>
            </div>
            <button id="btn-add-item" class="btn btn-secondary">
              자산 추가
            </button>
            <p class="small-tip">
              실제 운영 시에는 관리자 전용 화면으로 분리하고, CSV/QR 연동으로 일괄 등록할 수 있습니다.
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
          <div>
            <div class="label" style="margin-top:4px;">고장/분실 상위 자산</div>
            <ul id="top-issue-list" style="padding-left:16px; margin-top:2px;"></ul>
          </div>
          <div id="item-table"></div>
        </div>

        <div class="card" style="margin-top:14px;">
          <div class="card-header">
            <span>지연 대여 안내 문자 (AI)</span>
            <span class="badge-soft">Overdue SMS</span>
          </div>
          <div>
            <div class="form-row">
              <div class="form-field">
                <label class="label">지연 항목 선택 (3일 이상)</label>
                <select id="overdue-select" class="select">
                  ${overdueOptions}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label class="label">추가 안내 사항 (선택)</label>
                <input id="overdue-extra" class="input" placeholder="예: 내일 5교시까지 반납, 미반납 시 생활기록부 반영 등" />
              </div>
            </div>
            <button id="btn-generate-sms" class="btn btn-primary" type="button">
              AI로 문자 생성
            </button>
            <button id="btn-copy-sms" class="btn btn-outline" type="button" style="margin-left:6px;">
              내용 복사
            </button>
            <p class="small-tip" style="margin-top:6px;">
              실제 발송은 문자/알림 시스템에서 직접 하며, 이 화면에서는 <b>문구만 자동 작성</b>합니다.
            </p>
            <textarea id="sms-output" class="sms-output" placeholder="여기에 생성된 문자가 표시됩니다."></textarea>
          </div>
        </div>

        <div class="card" style="margin-top:14px;">
          <div class="card-header">
            <span>최근 이력 (최대 80개)</span>
          </div>
          <div class="form-row" style="margin-bottom:8px;">
            <div class="form-field">
              <label class="label">학생 필터</label>
              <select id="history-student-select" class="select">
                <option value="">전체 학생</option>
                ${studentOptionsAll}
              </select>
            </div>
            <div class="form-field">
              <label class="label">자산 필터</label>
              <select id="history-item-select" class="select">
                <option value="">전체 자산</option>
                ${historyItemOptions}
              </select>
            </div>
          </div>
          <button id="btn-history-reset" class="btn btn-outline" type="button" style="margin-bottom:6px;">
            필터 초기화
          </button>
          <ul id="history-list" class="history-list"></ul>
        </div>
      </div>
    </div>
  `;

  // --- 이벤트 바인딩 ---

  // 학년 선택 → 학생 목록 갱신
  const borrowGradeSelect = document.getElementById("borrow-grade-select");
  const borrowStudentSelect = document.getElementById("borrow-student-select");

  function populateBorrowStudents(grade) {
    borrowStudentSelect.innerHTML = '<option value="">학생 선택</option>';
    if (!grade) return;
    state.students
      .filter((s) => String(s.grade) === String(grade))
      .forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.studentId;
        opt.textContent = `${s.grade}학년 ${s.classNo}반 ${s.name} (${s.studentId})`;
        borrowStudentSelect.appendChild(opt);
      });
  }

  borrowGradeSelect.addEventListener("change", (e) => {
    populateBorrowStudents(e.target.value);
  });

  document.getElementById("btn-borrow").addEventListener("click", () => {
    const sid = borrowStudentSelect.value;
    const iid = document.getElementById("borrow-item-select").value;
    borrowItem(sid, iid);
  });

  document.getElementById("btn-return").addEventListener("click", () => {
    const iid = document.getElementById("return-item-select").value;
    const note = document.getElementById("return-note").value;
    returnItem(iid, note);
  });

  document.getElementById("btn-issue").addEventListener("click", () => {
    const iid = document.getElementById("issue-item-select").value;
    const type = document.getElementById("issue-type").value;
    const note = document.getElementById("issue-note").value;
    reportIssue(iid, type, note);
  });

  document.getElementById("btn-add-item").addEventListener("click", () => {
    const iid = document.getElementById("new-item-id").value;
    const name = document.getElementById("new-item-name").value;
    addItem(iid, name);
  });

  document.getElementById("btn-restore").addEventListener("click", () => {
    const iid = document.getElementById("restore-item-select").value;
    const note = document.getElementById("restore-note").value;
    restoreItem(iid, note, "restore");
  });

  document.getElementById("btn-refresh").addEventListener("click", () => {
    renderStats();
    renderHistory();
    renderItemTable();
  });

  // 히스토리 필터
  const histStudentSel = document.getElementById("history-student-select");
  const histItemSel = document.getElementById("history-item-select");

  histStudentSel.addEventListener("change", renderHistory);
  histItemSel.addEventListener("change", renderHistory);

  document.getElementById("btn-history-reset").addEventListener("click", () => {
    histStudentSel.value = "";
    histItemSel.value = "";
    renderHistory();
  });

  // 지연 문자 생성
  const overdueSelect = document.getElementById("overdue-select");
  const overdueExtra = document.getElementById("overdue-extra");
  const smsOutput = document.getElementById("sms-output");

  document.getElementById("btn-generate-sms").addEventListener("click", async () => {
    const idx = overdueSelect.value;
    if (idx === "" || !window.__overdueCache || !window.__overdueCache[idx]) {
      alert("지연된 대여 항목을 먼저 선택하세요.");
      return;
    }
    const info = window.__overdueCache[idx];
    smsOutput.value = "문자를 생성하는 중입니다...";
    const text = await generateOverdueSms(info, overdueExtra.value);
    smsOutput.value = text;
  });

  document.getElementById("btn-copy-sms").addEventListener("click", () => {
    if (!smsOutput.value.trim()) {
      alert("복사할 문자가 없습니다.");
      return;
    }
    smsOutput.select();
    document.execCommand("copy");
    alert("문구가 복사되었습니다. 문자/알림 발송창에 붙여넣기 하세요.");
  });

  // 첫 렌더링 서브 파트
  renderStats();
  renderHistory();
  renderItemTable();
}

// ===== 11. 시작 =====
loadState();
render();
