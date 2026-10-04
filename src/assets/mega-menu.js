/* ── Sticky hide-on-scroll ── */
{
  const nav = document.querySelector("#main-nav");
  if (nav) {
    const badge = nav.querySelector(".mn-badge");

    function cartHasItems() {
      return badge && Number.parseInt(badge.textContent, 10) > 0;
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
          nav.classList.toggle(
            "nav-hidden",
            y > 0 && y > lastY && !cartHasItems(),
          );
          lastY = y;
          ticking = false;
        });
      },
      { passive: true },
    );
  }
}

/* Tablet: first tap on a dropdown link opens it, second tap follows it. */
{
  const items = document.querySelectorAll(".mn-item[data-has-drop]");
  const isTablet = () => window.innerWidth <= 1100 && window.innerWidth >= 769;
  const isMobile = () => window.innerWidth < 769;

  function closeAll(except) {
    for (const item of items) {
      if (item !== except) item.classList.remove("is-open");
    }
  }

  /** On mobile, only the search dropdown toggles; everything else is native. */
  const toggleMobileDropdown = (item, e) => {
    if (!item.querySelector(".mn-drop .mn-search")) return;
    e.preventDefault();
    closeAll(item);
    item.classList.toggle("is-open");
  };

  /**
   * First tap on a tablet opens the dropdown; a second tap on a real link
   * follows it. Desktop is left to hover + native clicks.
   */
  const toggleTabletDropdown = (item, link, e) => {
    if (!isTablet()) return; // desktop: let hover + native click work
    const followsLink =
      item.classList.contains("is-open") &&
      link.tagName === "A" &&
      link.getAttribute("href");
    if (followsLink) return;

    // first tap — open dropdown
    e.preventDefault();
    closeAll(item);
    item.classList.toggle("is-open");
  };

  for (const item of items) {
    const link = item.querySelector(":scope > a, :scope > button");
    if (!link) continue;

    link.addEventListener("click", (e) => {
      if (isMobile()) {
        toggleMobileDropdown(item, e);
        return;
      }
      toggleTabletDropdown(item, link, e);
    });
  }

  document.addEventListener("click", (e) => {
    if (!isTablet() && !isMobile()) return;
    if (!e.target.closest(".mn-item[data-has-drop]")) {
      closeAll();
    }
  });

  /* Desktop: keep the search dropdown open briefly after the mouse leaves. */
  const searchItem = document.querySelector(
    ".mn-actions .mn-item[data-has-drop]",
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
      }, 500);
    });
  }
}
