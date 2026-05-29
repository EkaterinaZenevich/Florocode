const data = window.FLOROCODE_DATA;
const meanings = window.FLOROCODE_MEANINGS ?? {};

const els = {
  workSelect: document.querySelector("#workSelect"),
  searchInput: document.querySelector("#searchInput"),
  lemmaSelect: document.querySelector("#lemmaSelect"),
  stats: document.querySelector("#stats"),
  workTitle: document.querySelector("#workTitle"),
  workMeta: document.querySelector("#workMeta"),
  resetButton: document.querySelector("#resetButton"),
  lemmaChips: document.querySelector("#lemmaChips"),
  noteTitle: document.querySelector("#noteTitle"),
  noteSubtitle: document.querySelector("#noteSubtitle"),
  noteText: document.querySelector("#noteText"),
  resultCount: document.querySelector("#resultCount"),
  results: document.querySelector("#results"),
};

const collator = new Intl.Collator("ru");

function currentWork() {
  return data.works.find((work) => work.file === els.workSelect.value) ?? data.works[0];
}

function occurrencesForWork(work) {
  return data.occurrences.filter((item) => item.file === work.file);
}

function countByLemma(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item.lemma, (counts.get(item.lemma) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([lemma, count]) => ({ lemma, count }))
    .sort((a, b) => b.count - a.count || collator.compare(a.lemma, b.lemma));
}

function filteredItems(work) {
  const query = els.searchInput.value.trim().toLowerCase();
  const lemma = els.lemmaSelect.value;

  return occurrencesForWork(work).filter((item) => {
    const lemmaOk = lemma === "all" || item.lemma === lemma;
    const queryOk =
      !query ||
      item.lemma.toLowerCase().includes(query) ||
      item.match.toLowerCase().includes(query) ||
      item.context.toLowerCase().includes(query);
    return lemmaOk && queryOk;
  });
}

function populateWorks() {
  els.workSelect.innerHTML = data.works
    .map((work) => `<option value="${escapeAttr(work.file)}">${escapeHtml(work.author)} — ${escapeHtml(work.work)}</option>`)
    .join("");
}

function populateLemmas(work) {
  const selected = els.lemmaSelect.value || "all";
  const lemmas = countByLemma(occurrencesForWork(work));
  els.lemmaSelect.innerHTML = [
    `<option value="all">Все флоронимы</option>`,
    ...lemmas.map((item) => `<option value="${escapeAttr(item.lemma)}">${escapeHtml(item.lemma)} (${item.count})</option>`),
  ].join("");

  els.lemmaSelect.value = lemmas.some((item) => item.lemma === selected) ? selected : "all";
}

function render() {
  const work = currentWork();
  populateLemmas(work);

  const allItems = occurrencesForWork(work);
  const items = filteredItems(work);
  const counts = countByLemma(allItems);
  const selectedLemma = els.lemmaSelect.value;

  els.workTitle.textContent = work.work;
  els.workMeta.textContent = `${work.author}. ${formatNumber(work.characters)} знаков, ${formatNumber(work.paragraphs)} фрагментов.`;
  els.stats.innerHTML = [
    stat("Произведений", data.works.length),
    stat("Флороупотреблений", data.occurrences.length),
    stat("В этом тексте", allItems.length),
    stat("Уникальных", counts.length),
  ].join("");

  els.lemmaChips.innerHTML = counts
    .map((item) => {
      const active = selectedLemma === item.lemma ? " is-active" : "";
      return `<button class="chip${active}" type="button" data-lemma="${escapeAttr(item.lemma)}">${escapeHtml(item.lemma)} · ${item.count}</button>`;
    })
    .join("");

  renderNote(selectedLemma, items, counts);
  renderResults(items);
}

function renderNote(selectedLemma, items, counts) {
  const top = counts[0];
  const lemma = selectedLemma === "all" ? top?.lemma : selectedLemma;

  els.noteTitle.textContent = selectedLemma === "all" ? "Главный мотив" : lemma;
  els.noteSubtitle.textContent =
    selectedLemma === "all" && top
      ? `Самый частотный флороним: ${top.lemma} (${top.count})`
      : `${items.length} контекстов в выбранной выборке`;

  if (!lemma) {
    els.noteText.textContent = "В этом произведении не найдено флоронимов из текущего словаря.";
    return;
  }

  const cards = meanings[lemma];
  if (!cards?.length) {
    els.noteText.innerHTML =
      "Для этого флоронима пока нет готовой карточки. Его стоит проверить по словарю языка цветов и затем сопоставить с конкретной сценой: подарок, интерьер, портрет, письмо, воспоминание или природный пейзаж.";
    return;
  }

  els.noteText.innerHTML = cards.map(renderMeaningCard).join("");
}

function renderMeaningCard(card) {
  return `
    <section class="meaning-card">
      <div class="meaning-source">${escapeHtml(card.source)}</div>
      <div class="meaning-status">${escapeHtml(card.status)}</div>
      <p>${escapeHtml(card.text)}</p>
    </section>
  `;
}

function renderResults(items) {
  els.resultCount.textContent = `${items.length} совпадений`;

  if (!items.length) {
    els.results.innerHTML = `<div class="empty">Нет контекстов для выбранного фильтра.</div>`;
    return;
  }

  els.results.innerHTML = items
    .map((item) => {
      const context = highlight(item.context, item.match);
      return `
        <div class="result">
          <div class="result-meta">
            <span class="lemma">${escapeHtml(item.lemma)}</span>
            <span>строка ${item.line}</span>
            <span>${escapeHtml(item.match)}</span>
          </div>
          <div>${context}</div>
        </div>
      `;
    })
    .join("");
}

function stat(label, value) {
  return `<div class="stat-row"><span>${label}</span><strong>${formatNumber(value)}</strong></div>`;
}

function highlight(text, match) {
  const safe = escapeHtml(text);
  const safeMatch = escapeRegExp(escapeHtml(match));
  return safe.replace(new RegExp(safeMatch, "i"), (found) => `<span class="match">${found}</span>`);
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

els.workSelect.addEventListener("change", () => {
  els.lemmaSelect.value = "all";
  render();
});
els.searchInput.addEventListener("input", render);
els.lemmaSelect.addEventListener("change", render);
els.resetButton.addEventListener("click", () => {
  els.searchInput.value = "";
  els.lemmaSelect.value = "all";
  render();
});
els.lemmaChips.addEventListener("click", (event) => {
  const button = event.target.closest("[data-lemma]");
  if (!button) return;
  els.lemmaSelect.value = button.dataset.lemma;
  render();
});

populateWorks();
render();
