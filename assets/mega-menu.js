/* ── Sticky hide-on-scroll ── */
{
  const nav = document.querySelector("#main-nav");
  if (nav) {
    const badge = nav.querySelector(".mn-badge");

    function cartHasItems() {
      return badge && parseInt(badge.textContent, 10) > 0;
    }

    if (location.hash) {
      nav.style.transition = "none";
      nav.classList.add("nav-hidden");
      requestAnimationFrame(() => {
        nav.style.transition = "";
      });
    }
    let lastY = scrollY;
    let ticking = false;
    document.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = scrollY;
          nav.classList.toggle("nav-hidden", y > 0 && y > lastY && !cartHasItems());
          lastY = y;
          ticking = false;
        });
      },
      { passive: true }
    );
  }
}

/* ── Tablet: click-to-open dropdowns ── */
/* First tap on a link with dropdown: opens dropdown.
   Second tap (dropdown already open): follows the link.
   Tapping outside: closes all. */
{
  const items = document.querySelectorAll(".mn-item[data-has-drop]");
  const isTablet = () =>
    window.innerWidth <= 1100 && window.innerWidth >= 769;
  const isMobile = () => window.innerWidth < 769;

  function closeAll(except) {
    items.forEach((item) => {
      if (item !== except) item.classList.remove("is-open");
    });
  }

  items.forEach((item) => {
    const link = item.querySelector(":scope > a, :scope > button");
    if (!link) return;

    link.addEventListener("click", (e) => {
      // On mobile, only handle search dropdown toggles
      if (isMobile()) {
        const hasDrop = item.querySelector(".mn-drop .mn-search");
        if (!hasDrop) return;
        e.preventDefault();
        closeAll(item);
        item.classList.toggle("is-open");
        return;
      }
      if (!isTablet()) return; // desktop: let hover + native click work

      if (item.classList.contains("is-open")) {
        // already open — if it's a real link, let it navigate
        if (link.tagName === "A" && link.getAttribute("href")) {
          return; // follow the link
        }
      }

      // first tap — open dropdown
      e.preventDefault();
      closeAll(item);
      item.classList.toggle("is-open");
    });
  });

  // close on outside click
  document.addEventListener("click", (e) => {
    if (!isTablet() && !isMobile()) return;
    if (!e.target.closest(".mn-item[data-has-drop]")) {
      closeAll();
    }
  });

  /* ── Desktop: hover-intent for search dropdown ──
     Keeps the search dropdown open briefly when the mouse leaves
     the .mn-item (e.g. passing over the Contact Us button on the
     way to the search input). */
  const searchItem = document.querySelector(
    ".mn-actions .mn-item[data-has-drop]"
  );
  if (searchItem) {
    let hideTimer = null;
    const isDesktop = () => window.innerWidth > 1100;

    searchItem.addEventListener("mouseenter", () => {
      if (!isDesktop()) return;
      clearTimeout(hideTimer);
      searchItem.classList.add("is-open");
    });

    searchItem.addEventListener("mouseleave", () => {
      if (!isDesktop()) return;
      hideTimer = setTimeout(() => {
        searchItem.classList.remove("is-open");
      }, 300);
    });
  }
}
