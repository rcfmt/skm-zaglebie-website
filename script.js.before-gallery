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
