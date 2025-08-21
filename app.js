// --- Хранилище --------------------------------------------------------------
const STORAGE_KEY = "friend_timer.friends";

function loadFriends() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Ошибка загрузки", e);
    return [];
  }
}
function saveFriends(friends) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(friends));
}
function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

// --- Русские формы слов -----------------------------------------------------
function plural(n, one, few, many) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

function formatDuration(ms) {
  if (ms < 60_000) return "менее минуты";
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes - days * 24 * 60) / 60);
  const mins = minutes % 60;

  if (days >= 1) {
    const d = `${days} ${plural(days, "день", "дня", "дней")}`;
    const h = `${hours} ${plural(hours, "час", "часа", "часов")}`;
    return `${d} ${h}`;
  }
  if (hours >= 1) {
    const h = `${hours} ${plural(hours, "час", "часа", "часов")}`;
    const m = `${mins} ${plural(mins, "минута", "минуты", "минут")}`;
    return `${h} ${m}`;
  }
  return `${mins} ${plural(mins, "минута", "минуты", "минут")}`;
}

// Преобразование ISO -> строка для <input type="datetime-local">
function toLocalInputValue(iso) {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}
// Преобразование значения из <input datetime-local> в ISO (UTC)
function fromLocalInputValue(val) {
  const d = new Date(val); // трактуется как local time
  return d.toISOString();
}

// --- Состояние --------------------------------------------------------------
let friends = loadFriends(); // [{id, name, metAtISO}]

// --- DOM --------------------------------------------------------------
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("emptyState");
const addForm = document.getElementById("addForm");
const nameInput = document.getElementById("nameInput");
const dateInput = document.getElementById("dateInput");
const seenNowBtn = document.getElementById("seenNowBtn");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");

// --- Рендер --------------------------------------------------------------
function render() {
  if (!friends.length) {
    emptyEl.classList.remove("hidden");
    listEl.innerHTML = "";
    return;
  }
  emptyEl.classList.add("hidden");

  // Сортировка: у кого встреча была давно, тот выше
  friends.sort((a, b) => new Date(a.metAtISO) - new Date(b.metAtISO));

  const now = Date.now();
  listEl.innerHTML = friends.map(f => {
    const last = new Date(f.metAtISO).getTime();
    const elapsed = Math.max(0, now - last);
    const elapsedText = formatDuration(elapsed);

    const lastFmt = new Date(f.metAtISO).toLocaleString("ru-RU", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });

    return `
      <li class="item" data-id="${f.id}">
        <div>
          <h3>${escapeHtml(f.name)}</h3>
          <div class="meta">
            <span class="badge" title="С момента последней встречи">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M12 1a11 11 0 1 0 11 11A11.013 11.013 0 0 0 12 1m1 11a1 1 0 0 1-1 1H7a1 1 0 0 1 0-2h4V6a1 1 0 0 1 2 0Z"/></svg>
              <strong class="elapsed">${elapsedText}</strong>
            </span>
            <span class="sub">встретились: <span class="last">${lastFmt}</span></span>
          </div>
          <div class="edit-panel hidden">
            <input class="input dt-input" type="datetime-local" value="${toLocalInputValue(f.metAtISO)}" />
            <button class="btn primary save-date">Сохранить</button>
            <button class="btn cancel-edit">Отмена</button>
          </div>
        </div>
        <div class="actions">
          <button class="btn ghost seen-now">Виделись сейчас</button>
          <button class="btn edit-date">Изменить дату</button>
          <button class="btn" style="border-color:#f0d5d5; color:#b42318; background:#fff5f5" data-role="delete">Удалить</button>
        </div>
      </li>
    `;
  }).join("");
}

function tickElapsed() {
  const now = Date.now();
  document.querySelectorAll("#list .item").forEach(item => {
    const id = item.getAttribute("data-id");
    const friend = friends.find(f => f.id === id);
    if (!friend) return;
    const last = new Date(friend.metAtISO).getTime();
    const elapsed = Math.max(0, now - last);
    const el = item.querySelector(".elapsed");
    if (el) el.textContent = formatDuration(elapsed);
  });
}

// --- Верхняя форма ----------------------------------------------------------
seenNowBtn.addEventListener("click", () => {
  dateInput.value = toLocalInputValue(new Date().toISOString());
});

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;

  let iso = dateInput.value ? fromLocalInputValue(dateInput.value) : new Date().toISOString();
  if (new Date(iso).getTime() > Date.now()) {
    alert("Дата встречи не может быть в будущем.");
    return;
  }
  friends.push({ id: uid(), name, metAtISO: iso });
  saveFriends(friends);
  addForm.reset();
  render();
});

// --- Список: делегирование --------------------------------------------------
listEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const li = e.target.closest(".item");
  if (!li) return;
  const id = li.getAttribute("data-id");
  const idx = friends.findIndex(f => f.id === id);
  if (idx === -1) return;

  if (btn.classList.contains("seen-now")) {
    friends[idx].metAtISO = new Date().toISOString();
    saveFriends(friends);
    render();
    return;
  }

  if (btn.classList.contains("edit-date")) {
    li.querySelector(".edit-panel").classList.remove("hidden");
    return;
  }

  if (btn.classList.contains("cancel-edit")) {
    li.querySelector(".edit-panel").classList.add("hidden");
    return;
  }

  if (btn.classList.contains("save-date")) {
    const input = li.querySelector(".dt-input");
    const iso = fromLocalInputValue(input.value);
    if (new Date(iso).getTime() > Date.now()) {
      alert("Дата встречи не может быть в будущем.");
      return;
    }
    friends[idx].metAtISO = iso;
    saveFriends(friends);
    render();
    return;
  }

  if (btn.dataset.role === "delete") {
    if (confirm("Удалить друга из списка?")) {
      friends.splice(idx, 1);
      saveFriends(friends);
      render();
    }
    return;
  }
});

// --- Экспорт / Импорт -------------------------------------------------------
exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(friends, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "friends_backup.json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("Неверный формат");
    const normalized = data.map(x => ({
      id: x.id || uid(),
      name: String(x.name || "").trim(),
      metAtISO: new Date(x.metAtISO || Date.now()).toISOString()
    })).filter(x => x.name);
    friends = normalized;
    saveFriends(friends);
    render();
  } catch (err) {
    alert("Ошибка импорта: " + err.message);
  } finally {
    importInput.value = "";
  }
});

// --- Безопасный текст -------------------------------------------------------
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

// --- Инициализация ----------------------------------------------------------
render();
const interval = setInterval(tickElapsed, 60_000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
