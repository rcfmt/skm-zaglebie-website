const state = { member: null, models: [], pending: [], members: [], invitations: [] };

const $ = (selector) => document.querySelector(selector);
const loginView = $("#login-view");
const dashboardView = $("#dashboard-view");
const statusBanner = $("#status-banner");
const toast = $("#toast");
const modelForm = $("#model-form");
const modelEditor = $("#model-editor");
const modelSaveOverlay = $("#model-save-overlay");
const modelSaveStatus = $("#model-save-status");
const modelConfirmation = $("#model-confirmation");
const modelConfirmationPreview = $("#model-confirmation-preview");
const modelConfirmationTitle = $("#model-confirmation-title");
let modelSaveInProgress = false;
let confirmedModel = null;
const MODEL_FIELDS = [
  "name", "category", "buildType", "manufacturer", "designSource", "constructionMaterials",
  "scale", "wingspan", "weight", "propulsion", "motorEngine", "propeller", "esc", "bec",
  "battery", "batteryConnector", "radio", "receiver", "receiverPower", "servos", "ignition",
  "fuelSystem", "exhaustSystem", "stabilization", "telemetry", "landingGear", "brakes",
  "lighting", "smokeSystem", "fpvSystem", "auxiliarySystems", "equipment", "description"
];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

async function api(path, options = {}) {
  const request = { ...options, headers: { ...(options.headers || {}) } };
  if (request.body && !(request.body instanceof FormData)) {
    request.headers["content-type"] = "application/json";
    request.body = JSON.stringify(request.body);
  }
  const response = await fetch(path, request);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Nie udało się wykonać operacji.");
  return data;
}

function notify(message, error = false) {
  toast.textContent = message;
  toast.classList.toggle("is-error", error);
  toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.hidden = true; }, 4200);
}

function showLoginStatus() {
  const status = new URLSearchParams(location.search).get("status");
  const messages = {
    pending: "Twoje zgłoszenie czeka na akceptację klubu. Po zatwierdzeniu zaloguj się ponownie.",
    rejected: "Zgłoszenie nie zostało zatwierdzone. Skontaktuj się z klubem, aby wyjaśnić sytuację.",
    suspended: "To konto jest obecnie nieaktywne. Skontaktuj się z klubem.",
    "not-invited": "To konto nie ma aktywnego zaproszenia. Poproś administratora klubu o nowy link.",
    invited: "Zaproszenie zostało przyjęte. Twoje konto członkowskie jest aktywne.",
    "login-cancelled": "Logowanie zostało anulowane."
  };
  if (!messages[status]) return;
  statusBanner.textContent = messages[status];
  statusBanner.hidden = false;
}

function configureInvitationLogin() {
  const invite = new URLSearchParams(location.search).get("invite");
  if (!invite) return;
  $("#google-login").href = `/api/auth/google/start?invite=${encodeURIComponent(invite)}`;
  statusBanner.textContent = "Zaproszenie jest gotowe. Zaloguj się kontem Google, na które zostało wystawione.";
  statusBanner.hidden = false;
}

function detail(label, value) {
  return value ? `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>` : "";
}

async function validatePilotPortrait(file) {
  if (!(file instanceof File)) throw new Error("Wybierz zdjęcie pilota.");

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 320 || bitmap.height < 320) {
      throw new Error("Zdjęcie pilota musi mieć co najmniej 320 × 320 px.");
    }

    const ratio = bitmap.width / bitmap.height;
    if (ratio < 0.55 || ratio > 1.2) {
      throw new Error("Wybierz pionowe lub kwadratowe zdjęcie portretowe pilota.");
    }

    if ("FaceDetector" in window) {
      const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
      const faces = await detector.detect(bitmap);
      if (faces.length !== 1) {
        throw new Error("Na zdjęciu profilowym musi być wyraźnie widoczna jedna twarz pilota.");
      }

      const face = faces[0].boundingBox;
      if ((face.width * face.height) / (bitmap.width * bitmap.height) < 0.06) {
        throw new Error("Twarz pilota jest zbyt mała. Wybierz bliższe zdjęcie portretowe.");
      }
    }
  } finally {
    bitmap.close();
  }
}

async function optimizePilotPortrait(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const maxSide = 768;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!blob) throw new Error("Nie udało się przygotować zdjęcia profilowego.");
    const baseName = file.name.replace(/\.[^.]+$/, "") || "portret";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
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

function modelCard(model, { includeActions = false, showOwner = true } = {}) {
  const owner = showOwner
    ? `<div class="model-owner">${pilotAvatar(model, true)}<span>Pilot: <strong>${escapeHtml(model.ownerName || "Klubowicz")}</strong></span></div>`
    : "";
  const cover = model.coverUrl
    ? `<a class="model-photo-link" href="${escapeHtml(model.coverUrl)}" data-lightbox title="Powiększ zdjęcie modelu"><img class="model-cover" src="${escapeHtml(model.coverUrl)}" alt="Model ${escapeHtml(model.name)}" loading="lazy"></a>`
    : `<div class="model-cover model-placeholder" aria-hidden="true">✈</div>`;
  const actions = includeActions && model.editable
    ? `<div class="model-actions"><button type="button" data-edit="${model.id}">Edytuj</button><button class="danger" type="button" data-delete="${model.id}">Usuń</button></div>`
    : "";
  return `<article class="model-card">
    <div class="model-image">${cover}${model.publicVisible ? '<span class="visibility-badge">Publiczny</span>' : '<span class="visibility-badge private">Tylko klub</span>'}</div>
    <div class="model-card-body">
      ${owner}
      <h3><span class="model-name-label">Model</span>${escapeHtml(model.name)}</h3>
      ${model.description ? `<p class="model-description">${escapeHtml(model.description)}</p>` : ""}
      <dl class="model-specs">
        ${detail("Kategoria", model.category)}${detail("Pochodzenie", model.buildType)}${detail("Producent", model.manufacturer)}
        ${detail("Projekt / plany", model.designSource)}${detail("Materiały", model.constructionMaterials)}${detail("Skala", model.scale)}
        ${detail("Rozpiętość", model.wingspan)}${detail("Masa", model.weight)}${detail("Napęd", model.propulsion)}
        ${detail("Silnik / turbina", model.motorEngine)}${detail("ESC", model.esc)}${detail("BEC / UBEC", model.bec)}
        ${detail("Akumulator napędowy", model.battery)}${detail("Złącza", model.batteryConnector)}
        ${detail("Śmigło", model.propeller)}${detail("Aparatura", model.radio)}${detail("Odbiornik", model.receiver)}
        ${detail("Zasilanie RX / serw", model.receiverPower)}${detail("Serwa", model.servos)}
        ${detail("Zapłon / ECU", model.ignition)}${detail("Układ paliwowy", model.fuelSystem)}${detail("Wydech", model.exhaustSystem)}
        ${detail("Stabilizacja", model.stabilization)}${detail("Telemetria", model.telemetry)}
        ${detail("Podwozie", model.landingGear)}${detail("Hamulce", model.brakes)}${detail("Oświetlenie", model.lighting)}
        ${detail("System dymu", model.smokeSystem)}${detail("FPV / kamera", model.fpvSystem)}
        ${detail("Inne systemy", model.auxiliarySystems)}${detail("Pozostałe wyposażenie", model.equipment)}
      </dl>${actions}
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
  return [...groups.values()];
}

function pilotTab(models, index) {
  const pilot = models[0];
  return `<button class="pilot-tab" id="pilot-tab-${index}" type="button" role="tab" aria-selected="${index === 0}" aria-controls="pilot-panel-${index}" tabindex="${index === 0 ? "0" : "-1"}" data-pilot-tab="${index}">
    ${pilotAvatar(pilot)}
    <span class="pilot-summary-copy">
      <strong>${escapeHtml(pilot.ownerName || "Klubowicz")}</strong>
      <small>${modelCountLabel(models.length)}</small>
    </span>
  </button>`;
}

function pilotPanel(models, index) {
  return `<section class="pilot-panel" id="pilot-panel-${index}" role="tabpanel" aria-labelledby="pilot-tab-${index}" ${index === 0 ? "" : "hidden"}>
    <div class="model-grid pilot-models">${models.map((model) => modelCard(model, { showOwner: false })).join("")}</div>
  </section>`;
}

function activatePilot(index, focus = false) {
  document.querySelectorAll("#club-models [data-pilot-tab]").forEach((tab) => {
    const selected = tab.dataset.pilotTab === String(index);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  });
  document.querySelectorAll("#club-models .pilot-panel").forEach((panel, panelIndex) => {
    panel.hidden = panelIndex !== index;
  });
}

function renderModels() {
  const own = state.models.filter((model) => model.memberId === state.member.id);
  $("#my-model-count").textContent = own.length;
  $("#club-model-count").textContent = state.models.length;
  $("#my-models").innerHTML = own.length
    ? own.map((model) => modelCard(model, { includeActions: true })).join("")
    : '<p class="empty-state">Nie masz jeszcze żadnego modelu. Dodaj pierwszą konstrukcję do hangaru.</p>';
  if (!state.models.length) {
    $("#club-models").innerHTML = '<p class="empty-state">Klubowy hangar jest jeszcze pusty.</p>';
    return;
  }
  const groups = pilotGroups(state.models);
  $("#club-models").innerHTML = `
    <div class="pilot-tabs" role="tablist" aria-label="Wybierz pilota">
      ${groups.map((models, index) => pilotTab(models, index)).join("")}
    </div>
    <div class="pilot-panels">${groups.map((models, index) => pilotPanel(models, index)).join("")}</div>`;
  const tabs = [...document.querySelectorAll("#club-models [data-pilot-tab]")];
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

function fillProfile() {
  $("#welcome-name").textContent = state.member.displayName;
  $("#profile-name").textContent = state.member.displayName;
  $("#profile-avatar").src = state.member.avatarUrl || "assets/logo.png";
  modelForm.reset();
  const form = $("#profile-form");
  form.elements.displayName.value = state.member.displayName;
  form.elements.bio.value = state.member.bio;
  form.elements.profilePublic.checked = state.member.profilePublic;
}

async function loadModels() {
  const data = await api("/api/models");
  state.models = data.models;
  renderModels();
}

async function loadPending() {
  if (state.member.role !== "admin") return;
  $("#admin-panel").hidden = false;
  const data = await api("/api/admin/pending");
  state.pending = data.members;
  $("#pending-count").textContent = state.pending.length;
  $("#pending-section").hidden = state.pending.length === 0;
  $("#pending-list").innerHTML = state.pending.length ? state.pending.map((member) => `
    <article class="pending-member">
      ${member.avatarUrl ? `<img src="${escapeHtml(member.avatarUrl)}" alt="" referrerpolicy="no-referrer">` : '<div class="pending-placeholder">?</div>'}
      <div><strong>${escapeHtml(member.displayName)}</strong><span>${escapeHtml(member.email)}</span></div>
      <div class="pending-actions"><button type="button" data-approve="${member.id}">Zatwierdź</button><button type="button" class="danger" data-reject="${member.id}">Odrzuć</button></div>
    </article>`).join("") : '<p class="empty-state">Brak nowych zgłoszeń.</p>';
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(new Date(value));
}

function renderAdminOverview() {
  $("#member-count").textContent = state.members.length;
  $("#invitation-count").textContent = state.invitations.length;
  $("#member-list").innerHTML = state.members.map((member) => `
    <article class="pending-member">
      ${member.avatarUrl ? `<img src="${escapeHtml(member.avatarUrl)}" alt="" referrerpolicy="no-referrer">` : '<div class="pending-placeholder">?</div>'}
      <div><strong>${escapeHtml(member.displayName)}</strong><span>${escapeHtml(member.email)}</span></div>
      <div class="pending-actions">
        <span class="role-badge">${member.role === "admin" ? "Administrator" : "Członek"}</span>
        ${member.isCurrent ? "" : member.role === "admin"
          ? `<button type="button" data-role-member="${member.id}">Ustaw jako członka</button>`
          : `<button type="button" data-role-admin="${member.id}">Nadaj rolę administratora</button>`}
      </div>
    </article>`).join("");
  $("#invitation-list").innerHTML = state.invitations.length ? state.invitations.map((invitation) => `
    <article class="pending-member invitation-row">
      <div class="pending-placeholder">@</div>
      <div><strong>${escapeHtml(invitation.email)}</strong><span>Ważne do ${formatDate(invitation.expiresAt)}</span></div>
      <div class="pending-actions"><button class="danger" type="button" data-revoke-invite="${invitation.id}">Anuluj</button></div>
    </article>`).join("") : '<p class="empty-state">Brak aktywnych zaproszeń.</p>';
}

async function loadAdminOverview() {
  if (state.member.role !== "admin") return;
  $("#admin-panel").hidden = false;
  const data = await api("/api/admin/overview");
  state.members = data.members;
  state.invitations = data.invitations;
  renderAdminOverview();
}

function openEditor(model = null) {
  modelForm.reset();
  $("#editor-title").textContent = model ? "Edytuj model" : "Dodaj model";
  if (model) {
    for (const key of ["id", ...MODEL_FIELDS]) {
      if (modelForm.elements[key]) modelForm.elements[key].value = model[key] || "";
    }
    modelForm.elements.publicVisible.checked = model.publicVisible;
  }
  updateEquipmentVisibility();
  modelEditor.hidden = false;
  modelEditor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditor(force = false) {
  if (modelSaveInProgress && !force) return;
  modelEditor.hidden = true;
  modelForm.reset();
}

function setModelFormDisabled(disabled) {
  modelForm.querySelectorAll("input, select, textarea, button").forEach((control) => {
    control.disabled = disabled;
  });
  $("#close-editor").disabled = disabled;
}

function showSaveProgress(message) {
  modelSaveStatus.textContent = message;
  modelSaveOverlay.hidden = false;
  document.body.classList.add("modal-open");
}

function updateSaveProgress(message) {
  modelSaveStatus.textContent = message;
}

function hideSaveProgress() {
  modelSaveOverlay.hidden = true;
  document.body.classList.remove("modal-open");
}

function showModelConfirmation(model, wasCreated) {
  confirmedModel = model;
  modelConfirmationTitle.textContent = wasCreated ? "Sprawdź dodany model" : "Sprawdź zapisane zmiany";
  modelConfirmationPreview.innerHTML = modelCard(model, { showOwner: false });
  modelConfirmation.hidden = false;
  document.body.classList.add("modal-open");
  $("#model-confirmation-done").focus();
}

function hideModelConfirmation() {
  modelConfirmation.hidden = true;
  modelConfirmationPreview.innerHTML = "";
  confirmedModel = null;
  document.body.classList.remove("modal-open");
}

async function saveModel(event) {
  event.preventDefault();
  if (modelSaveInProgress) return;

  const form = new FormData(modelForm);
  modelSaveInProgress = true;
  setModelFormDisabled(true);
  showSaveProgress("Zapisywanie danych modelu…");

  try {
    const id = form.get("id");
    const wasCreated = !id;
    const body = {};
    for (const key of MODEL_FIELDS) body[key] = form.get(key);
    body.publicVisible = form.get("publicVisible") === "on";
    const saved = await api(id ? `/api/models/${id}` : "/api/models", { method: id ? "PUT" : "POST", body });
    const modelId = id || saved.id;

    // Retain the new ID immediately. If the photo upload fails, a retry updates
    // this record instead of creating a duplicate model.
    modelForm.elements.id.value = modelId;

    const image = form.get("image");
    if (image?.size) {
      updateSaveProgress("Przesyłanie zdjęcia modelu…");
      const upload = new FormData();
      upload.append("image", image);
      await api(`/api/models/${modelId}/photo`, { method: "POST", body: upload });
    }

    updateSaveProgress("Odświeżanie hangaru…");
    await loadModels();
    const savedModel = state.models.find((model) => model.id === modelId);
    closeEditor(true);
    hideSaveProgress();
    if (savedModel) showModelConfirmation(savedModel, wasCreated);
    else notify(saved.message || "Model został zapisany.");
  } catch (error) {
    hideSaveProgress();
    notify(error.message, true);
  } finally {
    modelSaveInProgress = false;
    setModelFormDisabled(false);
  }
}

function updateEquipmentVisibility() {
  const propulsion = modelForm.elements.propulsion.value.toLowerCase();
  const isElectric = propulsion.includes("elektryczny");
  const isCombustion = propulsion.includes("spalinowy") || propulsion.includes("turbina");
  const isUnpowered = propulsion.includes("bez napędu");
  document.querySelector('[data-power-group="powered"]').hidden = !propulsion || isUnpowered;
  document.querySelector('[data-power-group="electric"]').hidden = !isElectric;
  document.querySelector('[data-power-group="combustion"]').hidden = !isCombustion;
}

async function initialize() {
  showLoginStatus();
  configureInvitationLogin();
  try {
    const { member } = await api("/api/auth/me");
    if (!member) return;
    state.member = member;
    loginView.hidden = true;
    statusBanner.hidden = true;
    dashboardView.hidden = false;
    $("#logout-button").hidden = false;
    fillProfile();
    await Promise.all([loadModels(), loadPending(), loadAdminOverview()]);
  } catch (error) {
    statusBanner.textContent = error.message;
    statusBanner.hidden = false;
  }
}

$("#invite-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const result = await api("/api/admin/invitations", { method: "POST", body: { email: form.get("email") } });
    $("#invite-link").value = result.inviteUrl;
    $("#email-invite").href = `mailto:${encodeURIComponent(result.email)}?subject=${encodeURIComponent("Zaproszenie do strefy klubowicza SKM Zagłębie")}&body=${encodeURIComponent(`Otwórz ten link i zaloguj się swoim kontem Google:\n\n${result.inviteUrl}\n\nZaproszenie jest ważne przez 14 dni.`)}`;
    $("#invite-result").hidden = false;
    event.currentTarget.reset();
    await loadAdminOverview();
    notify(result.emailSent ? "Zaproszenie zostało wysłane e-mailem." : "Zaproszenie gotowe — skopiuj link i wyślij go członkowi.");
  } catch (error) { notify(error.message, true); }
});

$("#copy-invite").addEventListener("click", async () => {
  const input = $("#invite-link");
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    input.select();
    document.execCommand("copy");
  }
  notify("Link zaproszenia został skopiowany.");
});

$("#new-model-button").addEventListener("click", () => openEditor());
$("#propulsion-select").addEventListener("change", updateEquipmentVisibility);
$("#close-editor").addEventListener("click", closeEditor);
$("#cancel-editor").addEventListener("click", closeEditor);
modelForm.addEventListener("submit", saveModel);
$("#model-confirmation-done").addEventListener("click", hideModelConfirmation);
$("#model-confirmation-edit").addEventListener("click", () => {
  const model = confirmedModel;
  hideModelConfirmation();
  if (model) openEditor(model);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modelConfirmation.hidden) hideModelConfirmation();
});

$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api("/api/profile", { method: "PUT", body: {
      displayName: form.get("displayName"), bio: form.get("bio"), profilePublic: form.get("profilePublic") === "on"
    }});
    state.member.displayName = form.get("displayName");
    state.member.bio = form.get("bio");
    state.member.profilePublic = form.get("profilePublic") === "on";
    fillProfile();
    await loadModels();
    notify("Profil został zapisany.");
  } catch (error) { notify(error.message, true); }
});

$("#avatar-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formData = new FormData(event.currentTarget);
    const image = formData.get("image");
    await validatePilotPortrait(image);
    notify("Sprawdzamy i przygotowujemy zdjęcie…");
    const optimizedImage = await optimizePilotPortrait(image);
    formData.set("image", optimizedImage, optimizedImage.name);
    const data = await api("/api/profile/avatar", { method: "POST", body: formData });
    state.member.avatarUrl = data.avatarUrl;
    $("#profile-avatar").src = data.avatarUrl;
    event.currentTarget.reset();
    await loadModels();
    notify("Zdjęcie profilowe zostało zmienione.");
  } catch (error) { notify(error.message, true); }
});

$("#logout-button").addEventListener("click", async () => {
  try { await api("/api/auth/logout", { method: "POST" }); } finally { location.href = "/czlonkowie.html"; }
});

document.addEventListener("click", async (event) => {
  if (!(event.target instanceof Element)) return;

  const editButton = event.target.closest("[data-edit]");
  const editId = editButton?.dataset.edit;
  if (editId) openEditor(state.models.find((model) => model.id === editId));

  const deleteButton = event.target.closest("[data-delete]");
  const deleteId = deleteButton?.dataset.delete;
  if (deleteId && confirm("Czy na pewno usunąć ten model?")) {
    try { await api(`/api/models/${deleteId}`, { method: "DELETE" }); await loadModels(); notify("Model został usunięty."); }
    catch (error) { notify(error.message, true); }
  }

  const decisionButton = event.target.closest("[data-approve], [data-reject]");
  const memberId = decisionButton?.dataset.approve || decisionButton?.dataset.reject;
  if (memberId) {
    const decision = decisionButton.dataset.approve ? "approve" : "reject";
    if (decision === "reject" && !confirm("Czy odrzucić to zgłoszenie?")) return;
    try { await api(`/api/admin/members/${memberId}/${decision}`, { method: "POST" }); await loadPending(); notify(decision === "approve" ? "Konto zostało zatwierdzone." : "Zgłoszenie zostało odrzucone."); }
    catch (error) { notify(error.message, true); }
  }

  const roleButton = event.target.closest("[data-role-admin], [data-role-member]");
  const roleMemberId = roleButton?.dataset.roleAdmin || roleButton?.dataset.roleMember;
  if (roleMemberId) {
    const role = roleButton.dataset.roleAdmin ? "admin" : "member";
    const label = role === "admin" ? "nadać tej osobie uprawnienia administratora" : "odebrać tej osobie uprawnienia administratora";
    if (!confirm(`Czy na pewno ${label}?`)) return;
    try {
      await api(`/api/admin/members/${roleMemberId}/role`, { method: "PUT", body: { role } });
      await loadAdminOverview();
      notify("Uprawnienia zostały zmienione.");
    } catch (error) { notify(error.message, true); }
  }

  const revokeButton = event.target.closest("[data-revoke-invite]");
  const invitationId = revokeButton?.dataset.revokeInvite;
  if (invitationId && confirm("Czy anulować to zaproszenie?")) {
    try {
      await api(`/api/admin/invitations/${invitationId}`, { method: "DELETE" });
      await loadAdminOverview();
      notify("Zaproszenie zostało anulowane.");
    } catch (error) { notify(error.message, true); }
  }
});

initialize();
