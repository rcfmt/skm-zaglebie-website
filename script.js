const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-button");
const mainNav = document.querySelector(".main-nav");
const navLinks = mainNav.querySelectorAll("a");
const form = document.querySelector("#contact-form");

function updateHeader() {
  header.classList.toggle("is-scrolled", window.scrollY > 80);
}

function closeMenu() {
  menuButton.setAttribute("aria-expanded", "false");
  mainNav.classList.remove("is-open");
  document.body.classList.remove("menu-open");
}

menuButton.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  mainNav.classList.toggle("is-open", !isOpen);
  document.body.classList.toggle("menu-open", !isOpen);
});

navLinks.forEach((link) => link.addEventListener("click", closeMenu));

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const name = data.get("name").toString().trim();
  const email = data.get("email").toString().trim();
  const subject = data.get("subject").toString().trim();
  const message = data.get("message").toString().trim();

  const body = [
    `Dzień dobry,`,
    ``,
    message,
    ``,
    `Pozdrawiam,`,
    name,
    email
  ].join("\n");

  const mailto = `mailto:skmzaglebie@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
});

document.querySelector("#year").textContent = new Date().getFullYear();

// ===== FACEBOOK GALLERY =====

const facebookGallery = document.querySelector("#facebook-gallery");
const galleryPrev = document.querySelector("#gallery-prev");
const galleryNext = document.querySelector("#gallery-next");

const lightbox = document.querySelector("#gallery-lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxClose = document.querySelector("#lightbox-close");
const lightboxPrev = document.querySelector("#lightbox-prev");
const lightboxNext = document.querySelector("#lightbox-next");

let galleryPhotos = [];
let currentPhotoIndex = 0;

function showLightbox(index) {
  if (!galleryPhotos.length) return;

  currentPhotoIndex =
    (index + galleryPhotos.length) % galleryPhotos.length;

  lightboxImage.src = galleryPhotos[currentPhotoIndex].src;

  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImage.src = "";
  document.body.style.overflow = "";
}

function renderGallery(photos) {
  facebookGallery.innerHTML = "";

  if (!photos.length) {
    facebookGallery.innerHTML =
      '<div class="gallery-status">Brak zdjęć do wyświetlenia.</div>';
    return;
  }

  photos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-photo";
    button.setAttribute("aria-label", `Otwórz zdjęcie ${index + 1}`);

    const img = document.createElement("img");
    img.src = photo.src;
    img.alt = "Zdjęcie z galerii SKM Zagłębie";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";

    button.appendChild(img);
    button.addEventListener("click", () => showLightbox(index));

    facebookGallery.appendChild(button);
  });
}

async function loadFacebookGallery() {
  try {
    const response = await fetch("/api/facebook-gallery", {
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    galleryPhotos = Array.isArray(data.photos)
      ? data.photos.filter(photo => photo && photo.src)
      : [];

    renderGallery(galleryPhotos);
  } catch (error) {
    console.error("Facebook gallery failed:", error);

    facebookGallery.innerHTML =
      '<div class="gallery-status">Nie udało się załadować galerii.</div>';
  }
}

galleryPrev?.addEventListener("click", () => {
  facebookGallery.scrollBy({
    left: -facebookGallery.clientWidth * 0.85,
    behavior: "smooth"
  });
});

galleryNext?.addEventListener("click", () => {
  facebookGallery.scrollBy({
    left: facebookGallery.clientWidth * 0.85,
    behavior: "smooth"
  });
});

lightboxClose?.addEventListener("click", closeLightbox);

lightboxPrev?.addEventListener("click", () => {
  showLightbox(currentPhotoIndex - 1);
});

lightboxNext?.addEventListener("click", () => {
  showLightbox(currentPhotoIndex + 1);
});

lightbox?.addEventListener("click", event => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

document.addEventListener("keydown", event => {
  if (!lightbox?.classList.contains("is-open")) return;

  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") showLightbox(currentPhotoIndex - 1);
  if (event.key === "ArrowRight") showLightbox(currentPhotoIndex + 1);
});

loadFacebookGallery();

