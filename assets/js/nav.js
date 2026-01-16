(function () {
  function updateNavPosition() {
    const nav = document.querySelector("nav ul");
    const rect = nav.getBoundingClientRect();
    document.documentElement.style.setProperty(
      "--nav-bottom",
      rect.bottom - 5 + "px",
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateNavPosition);
  } else {
    updateNavPosition();
  }

  window.addEventListener("resize", updateNavPosition);
  window.addEventListener("scroll", updateNavPosition);
})();
