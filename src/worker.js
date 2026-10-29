var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var PAGE_ID = "645371045317681";
var GRAPH_VERSION = "v26.0";
var MAX_FACEBOOK_PHOTOS = 150;
var ADMIN_EMAIL_DEFAULT = "";
var SESSION_COOKIE = "skm_session";
var SESSION_DAYS = 30;
var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
var MAX_PORTRAIT_CHECK_BYTES = 1024 * 1024;
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function json(data, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache,
      "x-content-type-options": "nosniff"
    }
  });
}
__name(json, "json");
function redirect(location, cookie) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}
__name(redirect, "redirect");
function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}
__name(clean, "clean");
function normalizeEmail(value) {
  return clean(value, 254).toLowerCase();
}
__name(normalizeEmail, "normalizeEmail");
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
__name(nowIso, "nowIso");
function futureIso({ minutes = 0, days = 0 }) {
  return new Date(Date.now() + minutes * 6e4 + days * 864e5).toISOString();
}
__name(futureIso, "futureIso");
function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(bytesToHex, "bytesToHex");
function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(base64Url, "base64Url");
function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}
__name(randomToken, "randomToken");
async function sha256Bytes(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
__name(sha256Bytes, "sha256Bytes");
async function sha256(value) {
  return bytesToHex(await sha256Bytes(value));
}
__name(sha256, "sha256");
function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.get("cookie") || "").split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value).map(([key, ...value]) => [key, decodeURIComponent(value.join("="))])
  );
}
__name(parseCookies, "parseCookies");
function sessionCookie(token, maxAge = SESSION_DAYS * 86400) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
__name(sessionCookie, "sessionCookie");
function requireSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, "Nieprawid\u0142owe \u017Ar\xF3d\u0142o \u017C\u0105dania.");
  }
}
__name(requireSameOrigin, "requireSameOrigin");
async function bodyJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Nieprawid\u0142owe dane formularza.");
  }
}
__name(bodyJson, "bodyJson");
function adminEmail(env) {
  return normalizeEmail(env.ADMIN_EMAIL || ADMIN_EMAIL_DEFAULT);
}
__name(adminEmail, "adminEmail");
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}
__name(escapeHtml, "escapeHtml");
async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.warn("Email skipped: configure RESEND_API_KEY and EMAIL_FROM");
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html })
  });
  if (!response.ok) console.error("Email failed", response.status, await response.text());
  return response.ok;
}
__name(sendEmail, "sendEmail");
async function getSession(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  return env.DB.prepare(`
    SELECT m.*, s.id AS session_id
    FROM sessions s JOIN members m ON m.id = s.member_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(await sha256(token), nowIso()).first();
}
__name(getSession, "getSession");
async function requireMember(request, env) {
  const member = await getSession(request, env);
  if (!member) throw new HttpError(401, "Zaloguj si\u0119, aby kontynuowa\u0107.");
  if (member.status !== "approved") throw new HttpError(403, "Konto nie jest aktywne.");
  return member;
}
__name(requireMember, "requireMember");
async function requireAdmin(request, env) {
  const member = await requireMember(request, env);
  if (member.role !== "admin") throw new HttpError(403, "Brak uprawnie\u0144 administratora.");
  return member;
}
__name(requireAdmin, "requireAdmin");
function safeReturnTo(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value.slice(0, 300) : "/czlonkowie.html";
}
__name(safeReturnTo, "safeReturnTo");
function invitationTokenFromReturnTo(returnTo) {
  try {
    return clean(new URL(returnTo, "https://local.invalid").searchParams.get("invite"), 200);
  } catch {
    return "";
  }
}
__name(invitationTokenFromReturnTo, "invitationTokenFromReturnTo");
function returnToWithoutInvitation(returnTo) {
  const url = new URL(returnTo, "https://local.invalid");
  url.searchParams.delete("invite");
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
__name(returnToWithoutInvitation, "returnToWithoutInvitation");
async function googleStart(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new HttpError(503, "Logowanie Google nie jest jeszcze skonfigurowane.");
  }
  const requestUrl = new URL(request.url);
  const origin = env.APP_URL || requestUrl.origin;
  const state = randomToken();
  const verifier = randomToken(48);
  const challenge = base64Url(await sha256Bytes(verifier));
  const invite = clean(requestUrl.searchParams.get("invite"), 200);
  const returnTo = invite ? `/czlonkowie.html?invite=${encodeURIComponent(invite)}` : safeReturnTo(requestUrl.searchParams.get("returnTo"));
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO oauth_states (state_hash, code_verifier, return_to, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(await sha256(state), verifier, returnTo, futureIso({ minutes: 10 }), nowIso()),
    env.DB.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(nowIso())
  ]);
  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  google.searchParams.set("redirect_uri", `${origin}/api/auth/google/callback`);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email profile");
  google.searchParams.set("state", state);
  google.searchParams.set("code_challenge", challenge);
  google.searchParams.set("code_challenge_method", "S256");
  google.searchParams.set("prompt", "select_account");
  return redirect(google.toString());
}
__name(googleStart, "googleStart");
async function googleCallback(request, env) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return redirect("/czlonkowie.html?status=login-cancelled");
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const stateRecord = await env.DB.prepare(`
    SELECT * FROM oauth_states WHERE state_hash = ? AND expires_at > ?
  `).bind(await sha256(state), nowIso()).first();
  if (!stateRecord || !code) throw new HttpError(400, "Sesja logowania wygas\u0142a. Spr\xF3buj ponownie.");
  await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash = ?").bind(await sha256(state)).run();
  const origin = env.APP_URL || url.origin;
  const tokenForm = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    code,
    code_verifier: stateRecord.code_verifier,
    grant_type: "authorization_code",
    redirect_uri: `${origin}/api/auth/google/callback`
  });
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenForm
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.id_token) throw new HttpError(401, "Google nie potwierdzi\u0142 logowania.");
  const verificationResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`
  );
  const identity = await verificationResponse.json();
  const verified = verificationResponse.ok && identity.aud === env.GOOGLE_CLIENT_ID && ["accounts.google.com", "https://accounts.google.com"].includes(identity.iss) && identity.email_verified === "true" && Number(identity.exp) * 1e3 > Date.now();
  if (!verified) throw new HttpError(401, "Nie uda\u0142o si\u0119 zweryfikowa\u0107 konta Google.");
  const email = normalizeEmail(identity.email);
  let member = await env.DB.prepare("SELECT * FROM members WHERE email = ? OR google_sub = ?").bind(email, identity.sub).first();
  const isAdmin = email === adminEmail(env);
  const invitationToken = invitationTokenFromReturnTo(stateRecord.return_to);
  const invitation = invitationToken ? await env.DB.prepare(`
    SELECT * FROM invitations
    WHERE token_hash = ? AND email = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
  `).bind(await sha256(invitationToken), email, nowIso()).first() : null;
  if (!member && !isAdmin && !invitation) {
    return redirect("/czlonkowie.html?status=not-invited");
  }
  if (!member) {
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO members (
        id, google_sub, email, display_name, google_picture_url, status, role,
        profile_public, approved_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).bind(
      id,
      identity.sub,
      email,
      clean(identity.name || email.split("@")[0], 80),
      clean(identity.picture, 500),
      isAdmin || invitation ? "approved" : "pending",
      isAdmin ? "admin" : invitation?.role || "member",
      isAdmin || invitation ? nowIso() : null,
      nowIso(),
      nowIso()
    ).run();
    member = await env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(id).first();
    if (!isAdmin && !invitation) {
      await sendEmail(env, {
        to: adminEmail(env),
        subject: `Nowe zg\u0142oszenie do strefy klubowicza: ${member.display_name}`,
        html: `<h2>Nowe zg\u0142oszenie</h2><p><strong>${escapeHtml(member.display_name)}</strong> (${escapeHtml(email)}) prosi o dost\u0119p do strefy klubowicza.</p><p><a href="${origin}/czlonkowie.html">Otw\xF3rz panel administratora</a></p>`
      });
    }
  } else {
    await env.DB.prepare(`
      UPDATE members SET google_sub = ?, google_picture_url = ?,
        status = CASE WHEN ? THEN 'approved' ELSE status END,
        role = CASE WHEN ? THEN 'admin' ELSE role END,
        approved_at = CASE WHEN ? AND approved_at IS NULL THEN ? ELSE approved_at END,
        updated_at = ? WHERE id = ?
    `).bind(
      identity.sub,
      clean(identity.picture, 500),
      isAdmin ? 1 : 0,
      isAdmin ? 1 : 0,
      isAdmin ? 1 : 0,
      nowIso(),
      nowIso(),
      member.id
    ).run();
    member = await env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(member.id).first();
  }
  if (invitation) {
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE members SET google_sub = ?, google_picture_url = ?, status = 'approved', role = ?,
          approved_at = COALESCE(approved_at, ?), updated_at = ? WHERE id = ?
      `).bind(
        identity.sub,
        clean(identity.picture, 500),
        isAdmin ? "admin" : invitation.role,
        nowIso(),
        nowIso(),
        member.id
      ),
      env.DB.prepare("UPDATE invitations SET accepted_at = ? WHERE id = ?").bind(nowIso(), invitation.id)
    ]);
    member = await env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(member.id).first();
  }
  if (member.status !== "approved") {
    return redirect(`/czlonkowie.html?status=${encodeURIComponent(member.status)}`);
  }
  const sessionToken = randomToken();
  await env.DB.prepare(`
    INSERT INTO sessions (id, member_id, token_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), member.id, await sha256(sessionToken), futureIso({ days: SESSION_DAYS }), nowIso()).run();
  const destination = invitation ? `${returnToWithoutInvitation(stateRecord.return_to)}${returnToWithoutInvitation(stateRecord.return_to).includes("?") ? "&" : "?"}status=invited` : stateRecord.return_to;
  return redirect(destination, sessionCookie(sessionToken));
}
__name(googleCallback, "googleCallback");
function memberDto(member) {
  return {
    id: member.id,
    email: member.email,
    displayName: member.display_name,
    bio: member.bio || "",
    avatarUrl: member.avatar_key ? `/media/${member.avatar_key}` : member.suppress_google_picture ? null : member.google_picture_url || null,
    status: member.status,
    role: member.role,
    profilePublic: Boolean(member.profile_public)
  };
}
__name(memberDto, "memberDto");
async function logout(request, env) {
  requireSameOrigin(request);
  const member = await getSession(request, env);
  if (member) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(member.session_id).run();
  const response = json({ ok: true });
  response.headers.append("set-cookie", sessionCookie("", 0));
  return response;
}
__name(logout, "logout");
async function updateProfile(request, env) {
  requireSameOrigin(request);
  const member = await requireMember(request, env);
  const body = await bodyJson(request);
  const displayName = clean(body.displayName, 80);
  if (displayName.length < 2) throw new HttpError(400, "Podaj imi\u0119 lub nazw\u0119 profilow\u0105.");
  await env.DB.prepare(`
    UPDATE members SET display_name = ?, bio = ?, profile_public = ?, updated_at = ? WHERE id = ?
  `).bind(displayName, clean(body.bio, 1200), body.profilePublic ? 1 : 0, nowIso(), member.id).run();
  return json({ ok: true, message: "Profil zosta\u0142 zapisany." });
}
__name(updateProfile, "updateProfile");
function imageExtension(type) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type] || null;
}
__name(imageExtension, "imageExtension");
async function readImage(request) {
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) throw new HttpError(400, "Wybierz zdj\u0119cie.");
  const extension = imageExtension(file.type);
  if (!extension) throw new HttpError(400, "Dozwolone formaty zdj\u0119\u0107: JPG, PNG i WebP.");
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, "Zdj\u0119cie mo\u017Ce mie\u0107 maksymalnie 5 MB.");
  return { file, extension, form };
}
__name(readImage, "readImage");
async function requirePersonInPortrait(file, env) {
  if (file.size > MAX_PORTRAIT_CHECK_BYTES) {
    throw new HttpError(400, "Zdj\u0119cie profilowe jest zbyt du\u017Ce do automatycznego sprawdzenia. Wybierz mniejszy plik lub spr\xF3buj przes\u0142a\u0107 go ponownie z tej strony.");
  }
  let detections;
  try {
    detections = await env.AI.run("@cf/facebook/detr-resnet-50", {
      image: [...new Uint8Array(await file.arrayBuffer())]
    });
  } catch (error) {
    console.error("Portrait detection failed", error);
    throw new HttpError(503, "Nie uda\u0142o si\u0119 sprawdzi\u0107 zdj\u0119cia. Spr\xF3buj ponownie za chwil\u0119.");
  }
  const items = Array.isArray(detections) ? detections : Array.isArray(detections?.result) ? detections.result : [];
  const hasPerson = items.some(
    (item) => String(item?.label || "").toLowerCase() === "person" && Number(item?.score || 0) >= 0.55
  );
  if (!hasPerson) {
    throw new HttpError(400, "Zdj\u0119cie profilowe musi przedstawia\u0107 osob\u0119. Logo, model ani inna grafika nie zostan\u0105 przyj\u0119te.");
  }
}
__name(requirePersonInPortrait, "requirePersonInPortrait");
async function uploadAvatar(request, env) {
  requireSameOrigin(request);
  const member = await requireMember(request, env);
  const { file, extension, form } = await readImage(request);
  if (form.get("portraitConfirmed") !== "yes") {
    throw new HttpError(400, "Potwierd\u017A, \u017Ce zdj\u0119cie przedstawia pilota.");
  }
  await requirePersonInPortrait(file, env);
  const key = `avatars/${member.id}/${crypto.randomUUID()}.${extension}`;
  await env.MEDIA.put(key, await file.arrayBuffer(), { metadata: { contentType: file.type } });
  await env.DB.prepare("UPDATE members SET avatar_key = ?, suppress_google_picture = 0, updated_at = ? WHERE id = ?").bind(key, nowIso(), member.id).run();
  if (member.avatar_key) await env.MEDIA.delete(member.avatar_key);
  return json({ ok: true, avatarUrl: `/media/${key}` });
}
__name(uploadAvatar, "uploadAvatar");
function modelInput(body) {
  const name = clean(body.name, 120);
  if (name.length < 2) throw new HttpError(400, "Podaj nazw\u0119 modelu.");
  return {
    name,
    category: clean(body.category, 80),
    manufacturer: clean(body.manufacturer, 120),
    buildType: clean(body.buildType, 80),
    designSource: clean(body.designSource, 200),
    constructionMaterials: clean(body.constructionMaterials, 300),
    scale: clean(body.scale, 50),
    wingspan: clean(body.wingspan, 50),
    weight: clean(body.weight, 50),
    propulsion: clean(body.propulsion, 80),
    motorEngine: clean(body.motorEngine, 160),
    esc: clean(body.esc, 120),
    bec: clean(body.bec, 120),
    battery: clean(body.battery, 120),
    batteryConnector: clean(body.batteryConnector, 80),
    propeller: clean(body.propeller, 120),
    radio: clean(body.radio, 120),
    receiver: clean(body.receiver, 120),
    receiverPower: clean(body.receiverPower, 160),
    servos: clean(body.servos, 200),
    ignition: clean(body.ignition, 160),
    fuelSystem: clean(body.fuelSystem, 300),
    exhaustSystem: clean(body.exhaustSystem, 200),
    stabilization: clean(body.stabilization, 160),
    telemetry: clean(body.telemetry, 300),
    landingGear: clean(body.landingGear, 200),
    brakes: clean(body.brakes, 160),
    lighting: clean(body.lighting, 200),
    smokeSystem: clean(body.smokeSystem, 200),
    fpvSystem: clean(body.fpvSystem, 300),
    auxiliarySystems: clean(body.auxiliarySystems, 600),
    equipment: clean(body.equipment, 1200),
    description: clean(body.description, 3e3),
    publicVisible: body.publicVisible ? 1 : 0
  };
}
__name(modelInput, "modelInput");
function modelDto(row, viewerId = null) {
  return {
    id: row.id,
    memberId: row.member_id,
    name: row.name,
    category: row.category || "",
    manufacturer: row.manufacturer || "",
    buildType: row.build_type || "",
    designSource: row.design_source || "",
    constructionMaterials: row.construction_materials || "",
    scale: row.scale || "",
    wingspan: row.wingspan || "",
    weight: row.weight || "",
    propulsion: row.propulsion || "",
    motorEngine: row.motor_engine || "",
    esc: row.esc || "",
    bec: row.bec || "",
    battery: row.battery || "",
    batteryConnector: row.battery_connector || "",
    propeller: row.propeller || "",
    radio: row.radio || "",
    receiver: row.receiver || "",
    receiverPower: row.receiver_power || "",
    servos: row.servos || "",
    ignition: row.ignition || "",
    fuelSystem: row.fuel_system || "",
    exhaustSystem: row.exhaust_system || "",
    stabilization: row.stabilization || "",
    telemetry: row.telemetry || "",
    landingGear: row.landing_gear || "",
    brakes: row.brakes || "",
    lighting: row.lighting || "",
    smokeSystem: row.smoke_system || "",
    fpvSystem: row.fpv_system || "",
    auxiliarySystems: row.auxiliary_systems || "",
    equipment: row.equipment || "",
    description: row.description || "",
    publicVisible: Boolean(row.public_visible),
    coverUrl: row.cover_key ? `/media/${row.cover_key}` : null,
    ownerName: row.display_name,
    ownerAvatarUrl: viewerId ? row.avatar_key ? `/media/${row.avatar_key}` : row.suppress_google_picture ? null : row.google_picture_url || null : row.profile_public ? row.avatar_key ? `/media/${row.avatar_key}` : row.suppress_google_picture ? null : row.google_picture_url || null : null,
    editable: viewerId === row.member_id,
    updatedAt: row.updated_at
  };
}
__name(modelDto, "modelDto");
var MODEL_SELECT = `
  SELECT m.*, p.display_name, p.avatar_key, p.google_picture_url,
    p.suppress_google_picture, p.profile_public
  FROM models m JOIN members p ON p.id = m.member_id
`;
async function listClubModels(request, env) {
  const member = await requireMember(request, env);
  const { results } = await env.DB.prepare(`${MODEL_SELECT}
    WHERE p.status = 'approved' ORDER BY p.display_name, m.updated_at DESC
  `).all();
  return json({ models: results.map((row) => modelDto(row, member.id)) });
}
__name(listClubModels, "listClubModels");
async function listPublicModels(env) {
  const { results } = await env.DB.prepare(`${MODEL_SELECT}
    WHERE p.status = 'approved' AND m.public_visible = 1 ORDER BY m.updated_at DESC
  `).all();
  return json({ models: results.map((row) => modelDto(row)) }, 200, "public, max-age=60");
}
__name(listPublicModels, "listPublicModels");
async function createModel(request, env) {
  requireSameOrigin(request);
  const member = await requireMember(request, env);
  const model = modelInput(await bodyJson(request));
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO models (
      id, member_id, name, category, manufacturer, build_type, design_source,
      construction_materials, scale, wingspan, weight,
      propulsion, motor_engine, esc, bec, battery, battery_connector, propeller,
      radio, receiver, receiver_power, servos, ignition, fuel_system, exhaust_system,
      stabilization, telemetry, landing_gear, brakes, lighting, smoke_system,
      fpv_system, auxiliary_systems, equipment, description, public_visible,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    member.id,
    model.name,
    model.category,
    model.manufacturer,
    model.buildType,
    model.designSource,
    model.constructionMaterials,
    model.scale,
    model.wingspan,
    model.weight,
    model.propulsion,
    model.motorEngine,
    model.esc,
    model.bec,
    model.battery,
    model.batteryConnector,
    model.propeller,
    model.radio,
    model.receiver,
    model.receiverPower,
    model.servos,
    model.ignition,
    model.fuelSystem,
    model.exhaustSystem,
    model.stabilization,
    model.telemetry,
    model.landingGear,
    model.brakes,
    model.lighting,
    model.smokeSystem,
    model.fpvSystem,
    model.auxiliarySystems,
    model.equipment,
    model.description,
    model.publicVisible,
    nowIso(),
    nowIso()
  ).run();
  return json({ ok: true, id, message: "Model zosta\u0142 dodany." }, 201);
}
__name(createModel, "createModel");
async function ownedModel(env, modelId, memberId) {
  const model = await env.DB.prepare("SELECT * FROM models WHERE id = ? AND member_id = ?").bind(modelId, memberId).first();
  if (!model) throw new HttpError(404, "Nie znaleziono modelu.");
  return model;
}
__name(ownedModel, "ownedModel");
async function updateModel(request, env, modelId) {
  requireSameOrigin(request);
  const member = await requireMember(request, env);
  await ownedModel(env, modelId, member.id);
  const model = modelInput(await bodyJson(request));
  await env.DB.prepare(`
    UPDATE models SET name=?, category=?, manufacturer=?, build_type=?, design_source=?,
      construction_materials=?, scale=?, wingspan=?, weight=?,
      propulsion=?, motor_engine=?, esc=?, bec=?, battery=?, battery_connector=?, propeller=?,
      radio=?, receiver=?, receiver_power=?, servos=?, ignition=?, fuel_system=?, exhaust_system=?,
      stabilization=?, telemetry=?, landing_gear=?, brakes=?, lighting=?, smoke_system=?,
      fpv_system=?, auxiliary_systems=?, equipment=?, description=?, public_visible=?,
      updated_at=? WHERE id=?
  `).bind(
    model.name,
    model.category,
    model.manufacturer,
    model.buildType,
    model.designSource,
    model.constructionMaterials,
    model.scale,
    model.wingspan,
    model.weight,
    model.propulsion,
    model.motorEngine,
    model.esc,
    model.bec,
    model.battery,
    model.batteryConnector,
    model.propeller,
    model.radio,
    model.receiver,
    model.receiverPower,
    model.servos,
    model.ignition,
    model.fuelSystem,
    model.exhaustSystem,
    model.stabilization,
    model.telemetry,
    model.landingGear,
    model.brakes,
    model.lighting,
    model.smokeSystem,
    model.fpvSystem,
    model.auxiliarySystems,
    model.equipment,
    model.description,
    model.publicVisible,
    nowIso(),
    modelId
  ).run();
  return json({ ok: true, message: "Model zosta\u0142 zapisany." });
}
__name(updateModel, "updateModel");
async function deleteModel(request, env, modelId) {
  requireSameOrigin(request);
  const member = await requireMember(request, env);
  const model = await ownedModel(env, modelId, member.id);
  if (model.cover_key) await env.MEDIA.delete(model.cover_key);
  await env.DB.prepare("DELETE FROM models WHERE id = ?").bind(modelId).run();
  return json({ ok: true, message: "Model zosta\u0142 usuni\u0119ty." });
}
__name(deleteModel, "deleteModel");
async function uploadModelPhoto(request, env, modelId) {
  requireSameOrigin(request);
  const member = await requireMember(request, env);
  const model = await ownedModel(env, modelId, member.id);
  const { file, extension } = await readImage(request);
  const key = `models/${member.id}/${modelId}/${crypto.randomUUID()}.${extension}`;
  await env.MEDIA.put(key, await file.arrayBuffer(), { metadata: { contentType: file.type } });
  await env.DB.prepare("UPDATE models SET cover_key = ?, updated_at = ? WHERE id = ?").bind(key, nowIso(), modelId).run();
  if (model.cover_key) await env.MEDIA.delete(model.cover_key);
  return json({ ok: true, coverUrl: `/media/${key}` });
}
__name(uploadModelPhoto, "uploadModelPhoto");
async function serveMedia(request, env, key) {
  const session = await getSession(request, env);
  const allowed = await env.DB.prepare(`
    SELECT 1 FROM members WHERE avatar_key = ? AND (profile_public = 1 OR ? != '')
    UNION ALL
    SELECT 1 FROM models m JOIN members p ON p.id = m.member_id
      WHERE m.cover_key = ? AND ((m.public_visible = 1 AND p.status = 'approved') OR ? != '')
    LIMIT 1
  `).bind(key, session?.id || "", key, session?.id || "").first();
  if (!allowed) throw new HttpError(404, "Nie znaleziono zdj\u0119cia.");
  const object = await env.MEDIA.getWithMetadata(key, "stream");
  if (!object.value) throw new HttpError(404, "Nie znaleziono zdj\u0119cia.");
  const headers = new Headers({
    "cache-control": "private, max-age=3600",
    "content-type": object.metadata?.contentType || "application/octet-stream",
    "x-content-type-options": "nosniff"
  });
  return new Response(object.value, { headers });
}
__name(serveMedia, "serveMedia");
async function pendingMembers(request, env) {
  await requireAdmin(request, env);
  const { results } = await env.DB.prepare(`
    SELECT id, email, display_name, google_picture_url, created_at
    FROM members WHERE status = 'pending' ORDER BY created_at
  `).all();
  return json({ members: results.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.google_picture_url || null,
    createdAt: row.created_at
  })) });
}
__name(pendingMembers, "pendingMembers");
async function decideMember(request, env, memberId, decision) {
  requireSameOrigin(request);
  await requireAdmin(request, env);
  const member = await env.DB.prepare("SELECT * FROM members WHERE id = ? AND status = 'pending'").bind(memberId).first();
  if (!member) throw new HttpError(404, "Nie znaleziono oczekuj\u0105cego zg\u0142oszenia.");
  const approved = decision === "approve";
  await env.DB.prepare("UPDATE members SET status=?, approved_at=?, updated_at=? WHERE id=?").bind(approved ? "approved" : "rejected", approved ? nowIso() : null, nowIso(), memberId).run();
  const origin = env.APP_URL || new URL(request.url).origin;
  await sendEmail(env, {
    to: member.email,
    subject: approved ? "Dost\u0119p do strefy klubowicza zosta\u0142 zatwierdzony" : "Informacja o zg\u0142oszeniu do strefy klubowicza",
    html: approved ? `<p>Dzie\u0144 dobry ${escapeHtml(member.display_name)},</p><p>Twoje konto zosta\u0142o zatwierdzone.</p><p><a href="${origin}/czlonkowie.html">Zaloguj si\u0119 przez Google</a></p>` : `<p>Dzie\u0144 dobry ${escapeHtml(member.display_name)},</p><p>Twoje zg\u0142oszenie nie zosta\u0142o zatwierdzone. Skontaktuj si\u0119 z klubem, je\u015Bli masz pytania.</p>`
  });
  return json({ ok: true });
}
__name(decideMember, "decideMember");
async function adminOverview(request, env) {
  const admin = await requireAdmin(request, env);
  const [{ results: members }, { results: invitations }] = await Promise.all([
    env.DB.prepare(`
      SELECT id, email, display_name, google_picture_url, avatar_key,
        suppress_google_picture, role, created_at
      FROM members WHERE status = 'approved' ORDER BY role DESC, display_name COLLATE NOCASE
    `).all(),
    env.DB.prepare(`
      SELECT id, email, role, expires_at, created_at
      FROM invitations
      WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
      ORDER BY created_at DESC
    `).bind(nowIso()).all()
  ]);
  return json({
    members: members.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_key ? `/media/${row.avatar_key}` : row.suppress_google_picture ? null : row.google_picture_url || null,
      role: row.role,
      isCurrent: row.id === admin.id
    })),
    invitations: invitations.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    }))
  });
}
__name(adminOverview, "adminOverview");
async function createInvitation(request, env) {
  requireSameOrigin(request);
  const admin = await requireAdmin(request, env);
  const body = await bodyJson(request);
  const email = normalizeEmail(body.email);
  const role = "member";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Podaj prawid\u0142owy adres e-mail.");
  }
  const existing = await env.DB.prepare("SELECT status FROM members WHERE email = ?").bind(email).first();
  if (existing?.status === "approved") throw new HttpError(409, "Ta osoba ma ju\u017C aktywne konto.");
  const token = randomToken(32);
  const expiresAt = futureIso({ days: 14 });
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`
      UPDATE invitations SET revoked_at = ?
      WHERE email = ? AND accepted_at IS NULL AND revoked_at IS NULL
    `).bind(nowIso(), email),
    env.DB.prepare(`
      INSERT INTO invitations (id, email, token_hash, role, invited_by, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, email, await sha256(token), role, admin.id, expiresAt, nowIso())
  ]);
  const origin = env.APP_URL || new URL(request.url).origin;
  const inviteUrl = `${origin}/czlonkowie.html?invite=${encodeURIComponent(token)}`;
  const emailSent = await sendEmail(env, {
    to: email,
    subject: "Zaproszenie do strefy klubowicza SKM Zag\u0142\u0119bie",
    html: `<h2>Zaproszenie do strefy klubowicza</h2><p>Administrator SKM Zag\u0142\u0119bie zaprosi\u0142 Ci\u0119 do klubowego hangaru.</p><p><a href="${escapeHtml(inviteUrl)}">Przyjmij zaproszenie i zaloguj si\u0119 przez Google</a></p><p>Zaproszenie jest wa\u017Cne przez 14 dni i dzia\u0142a wy\u0142\u0105cznie dla adresu ${escapeHtml(email)}.</p>`
  });
  return json({ id, email, role, expiresAt, inviteUrl, emailSent }, 201);
}
__name(createInvitation, "createInvitation");
async function revokeInvitation(request, env, invitationId) {
  requireSameOrigin(request);
  await requireAdmin(request, env);
  const result = await env.DB.prepare(`
    UPDATE invitations SET revoked_at = ?
    WHERE id = ? AND accepted_at IS NULL AND revoked_at IS NULL
  `).bind(nowIso(), invitationId).run();
  if (!result.meta.changes) throw new HttpError(404, "Nie znaleziono aktywnego zaproszenia.");
  return json({ ok: true });
}
__name(revokeInvitation, "revokeInvitation");
async function changeMemberRole(request, env, memberId) {
  requireSameOrigin(request);
  const admin = await requireAdmin(request, env);
  const body = await bodyJson(request);
  const role = body.role === "admin" ? "admin" : body.role === "member" ? "member" : null;
  if (!role) throw new HttpError(400, "Nieprawid\u0142owa rola.");
  if (memberId === admin.id && role !== "admin") {
    throw new HttpError(400, "Nie mo\u017Cesz odebra\u0107 sobie uprawnie\u0144 administratora.");
  }
  const result = await env.DB.prepare(`
    UPDATE members SET role = ?, updated_at = ? WHERE id = ? AND status = 'approved'
  `).bind(role, nowIso(), memberId).run();
  if (!result.meta.changes) throw new HttpError(404, "Nie znaleziono aktywnego cz\u0142onka.");
  return json({ ok: true });
}
__name(changeMemberRole, "changeMemberRole");
async function getFacebookPhotos(env) {
  if (!env.FB_PAGE_ACCESS_TOKEN) throw new Error("FB_PAGE_ACCESS_TOKEN is not configured");
  const photos = [];
  const seen = /* @__PURE__ */ new Set();
  let after = null;
  for (let page = 0; page < 5 && photos.length < MAX_FACEBOOK_PHOTOS; page++) {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}/photos`);
    url.searchParams.set("type", "uploaded");
    url.searchParams.set("fields", "id,images,created_time");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${env.FB_PAGE_ACCESS_TOKEN}` } });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data?.error?.message || `Facebook API returned ${response.status}`);
    for (const photo of data.data || []) {
      if (!photo.id || seen.has(photo.id)) continue;
      const best = (photo.images || []).reduce((largest, current) => {
        if (!largest) return current;
        return (current.width || 0) * (current.height || 0) > (largest.width || 0) * (largest.height || 0) ? current : largest;
      }, null);
      if (!best?.source) continue;
      seen.add(photo.id);
      photos.push({ id: photo.id, src: best.source, created_time: photo.created_time || null });
    }
    if (!data.paging?.cursors?.after) break;
    after = data.paging.cursors.after;
  }
  return photos.sort((a, b) => new Date(b.created_time || 0) - new Date(a.created_time || 0)).slice(0, MAX_FACEBOOK_PHOTOS);
}
__name(getFacebookPhotos, "getFacebookPhotos");
async function api(request, env, url) {
  const { pathname } = url;
  const method = request.method;
  if (pathname === "/api/facebook-gallery" && method === "GET") {
    const photos = await getFacebookPhotos(env);
    return json({ count: photos.length, photos }, 200, "public, max-age=300");
  }
  if (pathname === "/api/auth/google/start" && method === "GET") return googleStart(request, env);
  if (pathname === "/api/auth/google/callback" && method === "GET") return googleCallback(request, env);
  if (pathname === "/api/auth/logout" && method === "POST") return logout(request, env);
  if (pathname === "/api/auth/me" && method === "GET") {
    const member = await getSession(request, env);
    return json({ member: member?.status === "approved" ? memberDto(member) : null });
  }
  if (pathname === "/api/profile" && method === "PUT") return updateProfile(request, env);
  if (pathname === "/api/profile/avatar" && method === "POST") return uploadAvatar(request, env);
  if (pathname === "/api/models" && method === "GET") return listClubModels(request, env);
  if (pathname === "/api/models" && method === "POST") return createModel(request, env);
  if (pathname === "/api/public/models" && method === "GET") return listPublicModels(env);
  if (pathname === "/api/admin/pending" && method === "GET") return pendingMembers(request, env);
  if (pathname === "/api/admin/overview" && method === "GET") return adminOverview(request, env);
  if (pathname === "/api/admin/invitations" && method === "POST") return createInvitation(request, env);
  let match = pathname.match(/^\/api\/models\/([a-f0-9-]+)$/i);
  if (match && method === "PUT") return updateModel(request, env, match[1]);
  if (match && method === "DELETE") return deleteModel(request, env, match[1]);
  match = pathname.match(/^\/api\/models\/([a-f0-9-]+)\/photo$/i);
  if (match && method === "POST") return uploadModelPhoto(request, env, match[1]);
  match = pathname.match(/^\/api\/admin\/members\/([a-f0-9-]+)\/(approve|reject)$/i);
  if (match && method === "POST") return decideMember(request, env, match[1], match[2]);
  match = pathname.match(/^\/api\/admin\/members\/([a-f0-9-]+)\/role$/i);
  if (match && method === "PUT") return changeMemberRole(request, env, match[1]);
  match = pathname.match(/^\/api\/admin\/invitations\/([a-f0-9-]+)$/i);
  if (match && method === "DELETE") return revokeInvitation(request, env, match[1]);
  throw new HttpError(404, "Nie znaleziono endpointu.");
}
__name(api, "api");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await api(request, env, url);
      if (url.pathname.startsWith("/media/")) {
        return await serveMedia(request, env, decodeURIComponent(url.pathname.slice(7)));
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (!(error instanceof HttpError)) console.error("Worker error", error);
      return json({ error: error instanceof HttpError ? error.message : "Wyst\u0105pi\u0142 b\u0142\u0105d serwera." }, error.status || 500);
    }
  }
};
export {
  worker_default as default
};
