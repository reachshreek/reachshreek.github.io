document.documentElement.classList.add("js");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.querySelectorAll("[data-year]").forEach((year) => { year.textContent = new Date().getFullYear(); });

const revealItems = document.querySelectorAll(".reveal");
if (reduceMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const observer = new IntersectionObserver((entries, instance) => {
    entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); instance.unobserve(entry.target); } });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
}

document.querySelectorAll(".carousel").forEach((carousel) => {
  const track = carousel.querySelector(".carousel-track");
  const slides = [...track.children];
  const status = carousel.querySelector(".carousel-status");
  let current = 0;
  const update = () => {
    track.style.transform = `translateX(-${current * 100}%)`;
    status.textContent = `${current + 1} / ${slides.length}`;
    slides.forEach((slide, index) => slide.setAttribute("aria-hidden", String(index !== current)));
  };
  carousel.querySelector("[data-direction='next']")?.addEventListener("click", () => { current = (current + 1) % slides.length; update(); });
  carousel.querySelector("[data-direction='previous']")?.addEventListener("click", () => { current = (current - 1 + slides.length) % slides.length; update(); });
  carousel.addEventListener("keydown", (event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; current = event.key === "ArrowRight" ? (current + 1) % slides.length : (current - 1 + slides.length) % slides.length; update(); });
  update();
});

const copyButton = document.querySelector("[data-copy-email]");
if (copyButton) {
  const note = document.querySelector("[data-copy-note]");
  copyButton.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(copyButton.dataset.copyEmail); note.textContent = "Email copied to your clipboard."; }
    catch { note.textContent = "Copy unavailable. Select the email address above."; }
  });
}
