const lightbox = document.createElement("dialog");
lightbox.className = "image-lightbox";
lightbox.setAttribute("aria-label", "Podgląd zdjęcia");
lightbox.innerHTML = `
  <button class="image-lightbox-close" type="button" aria-label="Zamknij podgląd">×</button>
  <img src="" alt="">
`;
document.body.append(lightbox);

const lightboxImage = lightbox.querySelector("img");
const closeButton = lightbox.querySelector(".image-lightbox-close");

function closeLightbox() {
  if (lightbox.open) lightbox.close();
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-lightbox]");
  if (!link) return;

  event.preventDefault();
  const sourceImage = link.querySelector("img");
  lightboxImage.src = link.href;
  lightboxImage.alt = sourceImage?.alt || "Powiększone zdjęcie";
  lightbox.showModal();
});

closeButton.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});
lightbox.addEventListener("close", () => {
  lightboxImage.src = "";
});
