const container = document.querySelector("#public-models");
document.querySelector("#year").textContent = new Date().getFullYear();

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function detail(label, value) {
  return value ? `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>` : "";
}

function pilotAvatar(model, linked = false) {
  if (!model.ownerAvatarUrl) {
    return `<div class="owner-avatar"><span>${escapeHtml((model.ownerName || "K").slice(0, 1).toUpperCase())}</span></div>`;
  }
  const image = `<img src="${escapeHtml(model.ownerAvatarUrl)}" alt="Pilot ${escapeHtml(model.ownerName || "Klubowicz")}" loading="lazy" referrerpolicy="no-referrer">`;
  return linked
    ? `<a class="owner-avatar pilot-photo-link" href="${escapeHtml(model.ownerAvatarUrl)}" data-lightbox title="Powiększ zdjęcie pilota">${image}</a>`
    : `<div class="owner-avatar">${image}</div>`;
}

function modelGallery(model) {
  const photos = model.photos?.length
    ? model.photos
    : model.coverUrl ? [{ id: "cover", url: model.coverUrl, position: 0 }] : [];
  if (!photos.length) return '<div class="model-cover model-placeholder" aria-hidden="true">✈</div>';
  return `<div class="model-photo-gallery photo-count-${photos.length}">${photos.map((photo, index) => `
    <a class="model-photo-link" href="${escapeHtml(photo.url)}" data-lightbox title="Powiększ zdjęcie modelu${index ? ` (${index + 1})` : ""}">
      <img class="model-cover" src="${escapeHtml(photo.url)}" alt="Model ${escapeHtml(model.name)}, zdjęcie ${index + 1}" loading="lazy">
    </a>`).join("")}</div>`;
}

function card(model, showOwner = true) {
  const cover = modelGallery(model);
  const owner = showOwner
    ? `<div class="model-owner">${pilotAvatar(model, true)}<span>Pilot: <strong>${escapeHtml(model.ownerName || "Klubowicz")}</strong></span></div>`
    : "";
  return `<article class="model-card">
    <div class="model-image">${cover}</div>
    <div class="model-card-body">
      ${owner}
      <h3><span class="model-name-label">Model</span>${escapeHtml(model.name)}</h3>
      ${model.description ? `<p class="model-description">${escapeHtml(model.description)}</p>` : ""}
      <dl class="model-specs">
        ${detail("Kategoria", model.category)}${detail("Pochodzenie", model.buildType)}${detail("Producent", model.manufacturer)}
        ${detail("Projekt / plany", model.designSource)}${detail("Materiały", model.constructionMaterials)}${detail("Skala", model.scale)}
        ${detail("Rozpiętość", model.wingspan)}${detail("Masa", model.weight)}${detail("Napęd", model.propulsion)}
        ${detail("Silnik / turbina", model.motorEngine)}${detail("Śmigło", model.propeller)}${detail("ESC", model.esc)}
        ${detail("BEC / UBEC", model.bec)}${detail("Akumulator", model.battery)}${detail("Złącza", model.batteryConnector)}
        ${detail("Aparatura", model.radio)}${detail("Odbiornik", model.receiver)}${detail("Zasilanie RX / serw", model.receiverPower)}
        ${detail("Serwa", model.servos)}${detail("Zapłon / ECU", model.ignition)}${detail("Układ paliwowy", model.fuelSystem)}
        ${detail("Wydech", model.exhaustSystem)}${detail("Stabilizacja", model.stabilization)}${detail("Telemetria", model.telemetry)}
        ${detail("Podwozie", model.landingGear)}${detail("Hamulce", model.brakes)}${detail("Oświetlenie", model.lighting)}
        ${detail("System dymu", model.smokeSystem)}${detail("FPV / kamera", model.fpvSystem)}
        ${detail("Inne systemy", model.auxiliarySystems)}${detail("Pozostałe wyposażenie", model.equipment)}
      </dl>
    </div>
  </article>`;
}

function modelCountLabel(count) {
  if (count === 1) return "1 model";
  const lastTwo = count % 100;
  const last = count % 10;
  return `${count} ${last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "modele" : "modeli"}`;
}

function pilotGroups(models) {
  const groups = new Map();
  for (const model of models) {
    const key = model.memberId || model.ownerName || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(model);
  }
  return [...groups.values()].sort((left, right) =>
    (left[0].ownerName || "").localeCompare(right[0].ownerName || "", "pl")
  );
}

function pilotTab(models, index) {
  const pilot = models[0];
  return `<button class="pilot-tab" id="public-pilot-tab-${index}" type="button" role="tab" aria-selected="${index === 0}" aria-controls="public-pilot-panel-${index}" tabindex="${index === 0 ? "0" : "-1"}" data-pilot-tab="${index}">
    ${pilotAvatar(pilot)}
    <span class="pilot-summary-copy">
      <strong>${escapeHtml(pilot.ownerName || "Klubowicz")}</strong>
      <small>${modelCountLabel(models.length)}</small>
    </span>
  </button>`;
}

function pilotPanel(models, index) {
  return `<section class="pilot-panel" id="public-pilot-panel-${index}" role="tabpanel" aria-labelledby="public-pilot-tab-${index}" ${index === 0 ? "" : "hidden"}>
    <div class="model-grid public-grid pilot-models">${models.map((model) => card(model, false)).join("")}</div>
  </section>`;
}

function activatePilot(index, focus = false) {
  container.querySelectorAll("[data-pilot-tab]").forEach((tab) => {
    const selected = tab.dataset.pilotTab === String(index);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  container.querySelectorAll(".pilot-panel").forEach((panel, panelIndex) => {
    panel.hidden = panelIndex !== index;
  });
}

function renderModels(models) {
  if (!models.length) {
    container.innerHTML = '<p class="empty-state">Klubowicze nie udostępnili jeszcze żadnych modeli publicznie.</p>';
    return;
  }
  const groups = pilotGroups(models);
  container.innerHTML = `
    <div class="pilot-tabs" role="tablist" aria-label="Wybierz pilota">
      ${groups.map((pilotModels, index) => pilotTab(pilotModels, index)).join("")}
    </div>
    <div class="pilot-panels">${groups.map((pilotModels, index) => pilotPanel(pilotModels, index)).join("")}</div>`;
  const tabs = [...container.querySelectorAll("[data-pilot-tab]")];
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activatePilot(index));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0
        : event.key === "End" ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      activatePilot(next, true);
    });
  });
}

fetch("/api/public/models")
  .then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Nie udało się pobrać modeli.");
    renderModels(data.models);
  })
  .catch((error) => { container.innerHTML = `<p class="empty-state error">${escapeHtml(error.message)}</p>`; });
