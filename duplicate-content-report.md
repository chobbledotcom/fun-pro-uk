# Duplicate Content Report

Generated: 2026-02-16

This report identifies categories, events, and pages (excluding news posts) that cover the same or very similar topics. Findings are grouped by severity.

---

## 1. EXACT / NEAR-EXACT DUPLICATES

These are files where the body content is word-for-word identical (or differs only by a line or two). These represent clear waste — one copy should be removed, with a redirect pointing to the canonical version.

### 1.1 Promotional Event Games (page vs page)

| File | Title |
|------|-------|
| `pages/promotional-event-games.md` | Boost Brand Awareness With Promotional & Brand Activation Game Hire |
| `pages/promotion-event-games.md` | Boost Brand Awareness With Promotional & Brand Activation Game Hire |

**Verdict:** 100% identical body content, same meta_title, same meta_description. Only the `redirect_from` URL differs. One should be deleted outright.

---

### 1.2 Exhibition Games (category vs event)

| File | Title |
|------|-------|
| `categories/exhibition-games.md` | Exhibition Games |
| `events/exhibition-games.md` | Exhibition Games |

**Verdict:** Same meta_description, same body content (the category has a `[Read more..]` tag, otherwise identical). Same heading, same game list, same branded exhibition section. One should be the canonical version and the other removed.

---

### 1.3 Fun Days / Family Fun Days (category vs event)

| File | Title |
|------|-------|
| `categories/fun-days.md` | Fun Days |
| `events/family-fun-days.md` | Family Fun Days |

**Verdict:** Same meta_description. Body content is virtually identical: same heading ("Family Fun Days - Benefits and Planning"), same 5 benefits list, same 7-step planning process, same closing paragraph. Minor formatting differences only.

---

## 2. HIGH OVERLAP — Same Topic, Different Content

These are files covering the same subject from the same angle, but with meaningfully different text. They compete with each other for search rankings and fragment the site's authority on each topic.

### 2.1 Christmas Content Cluster (5 files)

| File | Title | Angle |
|------|-------|-------|
| `categories/christmas-game-hire.md` | Christmas Game Hire | Festive games for corporate events, detailed game lists, branding options |
| `categories/christmas-games.md` | Christmas Games | General Christmas range overview, client names, purpose-built games |
| `categories/christmas-grotto-hire.md` | Christmas Grotto Hire | Specifically grottos |
| `events/christmas-entertainment.md` | Christmas Entertainment | Event type page for Christmas |
| `pages/christmas-photo-booth-corporate-event-hire.md` | Christmas Photobooth hire | Specifically Christmas photo booths |

**Overlap:** "Christmas Game Hire" and "Christmas Games" are both broad overviews of the same festive game hire service. "Christmas Entertainment" (event) also broadly covers Christmas game hire. The grotto and photo booth pages are narrower but add to the cluster.

**Suggestion:** Consolidate "Christmas Game Hire" and "Christmas Games" into one strong category page. Make the event page distinct or redirect it to the category.

---

### 2.2 Exhibition / Brand Activation Cluster (6+ files)

| File | Title | Angle |
|------|-------|-------|
| `categories/exhibition-games.md` | Exhibition Games | Games for trade show stands |
| `categories/branded-exhibition-games.md` | Branded Exhibition Games | Branded games for exhibitions |
| `events/exhibition-games.md` | Exhibition Games | **Duplicate of category** |
| `events/brand-activation.md` | Brand Activation | Branded games for experiential campaigns |
| `pages/promotional-event-games.md` | Brand Activation & Promotional Game Hire | Branded/promotional games |
| `pages/promotion-event-games.md` | Brand Activation & Promotional Game Hire | **Duplicate of above** |
| `pages/games-for-exhibition-stands-to-hire.md` | How to Entice Guests to Your Exhibition Booth | Exhibition stand game guide |
| `pages/exhibition.md` | exhibition | **Minimal/empty content** |
| `pages/promotion.md` | promotion | **Minimal/empty content** |

**Overlap:** Six substantive pages all target "exhibition game hire" or "branded game hire" keywords. The branded-exhibition-games category, brand-activation event, and promotional-event-games page all cover branded/custom games for corporate events from nearly the same angle.

**Suggestion:** Keep one strong category page for exhibition games, one event page, and one brand activation page. Remove the duplicates and empty stubs.

---

### 2.3 Corporate / Office Entertainment Cluster (4 files remaining)

| File | Title | Angle |
|------|-------|-------|
| `categories/corporate-entertainment.md` | Corporate Entertainment | Office party game ideas |
| `events/corporate-events.md` | Corporate Events | Corporate event game hire (team building, awards, staff parties) |
| `events/office-entertainment.md` | Office Entertainment | Compact games for workplaces |
| ~~`pages/office-and-corporate-entertainment.md`~~ | ~~Office & Corporate Entertainment Ideas~~ | **Deleted (was duplicate of category)** |
| `pages/about-corporate-entertainment-hire.md` | About Fun Pro UK | About page with corporate focus |

**Overlap:** The duplicate page has been deleted. The corporate-events event and office-entertainment event both still target corporate clients with games. The about page also focuses on corporate entertainment.

---

### 2.4 Wedding Cluster (2 files remaining)

| File | Title | Angle |
|------|-------|-------|
| `categories/weddings.md` | Weddings | Wedding game hire |
| `events/wedding-entertainment.md` | Wedding Entertainment | Wedding reception entertainment (more detailed) |
| ~~`pages/wedding-entertainment.md`~~ | ~~Wedding Entertainment for Guests~~ | **Deleted (was duplicate of category)** |

**Overlap:** The duplicate page has been deleted. Two files remain — the category and the event page, which has genuinely different, more detailed content (garden games, casino tables, evening entertainment, sweet treats).

---

### 2.5 University / Freshers Cluster (4 files)

| File | Title | Angle |
|------|-------|-------|
| `categories/freshers-fair-games.md` | Freshers Fair Games | Freshers week game hire |
| `events/college-entertainment.md` | College Entertainment | College/university event games |
| `events/university-events.md` | University Events | University event entertainment |
| `pages/freshers-entertainment-ideas.md` | Freshers Week Entertainment Hire | Freshers entertainment guide |

**Overlap:** Four pages all targeting university/college entertainment. The category and the page both focus on freshers week specifically. The two events overlap significantly — "College Entertainment" and "University Events" target the same audience.

---

### 2.6 Conference Cluster (3 files)

| File | Title | Angle |
|------|-------|-------|
| `events/conference-idea.md` | Conference Production | Conference break entertainment |
| `pages/conference-game-hire.md` | Conference Game Hire | Conference game hire guide |
| `pages/conference-production.md` | Conference Production | **Minimal/empty content** |

**Overlap:** The event and the page cover the same topic (games for conference breakout sessions). The conference-production page is empty.

---

### 2.7 Award Ceremonies (2 files)

| File | Title | Angle |
|------|-------|-------|
| `events/company-award-ceremonies.md` | Award Ceremonies | Award night entertainment (detailed: photo booths, casino, racing) |
| `pages/award-ceremonies.md` | UK Company Awards Presentation Hire | Award ceremony equipment |

**Overlap:** Both cover entertainment for company award nights. The event page is substantially more detailed.

---

### 2.8 School / Educational (2 files)

| File | Title | Angle |
|------|-------|-------|
| `events/school-entertainment.md` | School Entertainment | Games for school fun days |
| `events/educational-and-community.md` | Educational & Community | Games for schools, colleges, universities, community groups |

**Overlap:** School entertainment is a subset of the educational & community page. Both mention inflatables, liability insurance, and nationwide delivery.

---

## 3. TEMPLATED NEAR-DUPLICATES

### 3.1 Regional Corporate Entertainment Pages (5 files)

| File | Title |
|------|-------|
| `pages/cambridge-corporate-event-hire.md` | Corporate Entertainment Hire in Cambridge |
| `pages/gloucester-corporate-event-hire.md` | Corporate Entertainment Agency for Gloucester |
| `pages/liverpool-corporate-event-hire.md` | Corporate Event Hire Liverpool |
| `pages/oxford-corporate-event-hire.md` | Corporate Event Hire Oxford |
| `pages/reading-corporate-event-hire.md` | Corporate Event Entertainment in Reading |

**Verdict:** These five pages follow the same template structure with the city name swapped in. All mention the events industry being worth "£42.3 billion". All follow the same pattern: why host events -> how to find an agency -> what entertainment to hire -> budget-friendly. All recommend the same games (race car simulators, retro arcade, casino tables with croupier). These are classic "doorway pages" that search engines penalise.

**Note:** These are separate from the `locations/` directory which has its own location pages, creating further duplication with location-specific content.

---

## 4. EMPTY / STUB PAGES

These pages exist but have minimal or no body content:

| File | Title | Content |
|------|-------|---------|
| `pages/exhibition.md` | exhibition | Title only |
| `pages/promotion.md` | promotion | Title only |
| `pages/conference-production.md` | Conference Production | Title only |
| `pages/liverpool.md` | Liverpool | Title only (also duplicates `locations/` content) |

These should either be fleshed out with unique content or removed with redirects.

---

## Summary Table

| # | Severity | Files Involved | Topic |
|---|----------|---------------|-------|
| 1.1 | **Exact duplicate** | 2 pages | Promotional event games |
| 1.2 | **Exact duplicate** | 1 category + 1 event | Exhibition games |
| 1.3 | **Exact duplicate** | 1 category + 1 event | Fun days / family fun days |
| 1.4 | **Exact duplicate** | 1 page + 1 event | Summer entertainment |
| 1.5 | **Exact duplicate** | 1 page + 1 event | Wellbeing days |
| 1.6 | ~~Exact duplicate~~ **RESOLVED** | 1 category + ~~1 page~~ | Corporate entertainment |
| 1.7 | ~~Exact duplicate~~ **RESOLVED** | 1 category + ~~1 page~~ | Weddings |
| 2.1 | **High overlap** | 5 files | Christmas |
| 2.2 | **High overlap** | 6+ files | Exhibition / brand activation |
| 2.3 | **High overlap** | 5 files | Corporate / office entertainment |
| 2.4 | **High overlap** | 3 files | Weddings |
| 2.5 | **High overlap** | 4 files | University / freshers |
| 2.6 | **High overlap** | 3 files | Conferences |
| 2.7 | **High overlap** | 2 files | Award ceremonies |
| 2.8 | **High overlap** | 2 files | School / educational |
| 3.1 | **Templated** | 5 pages | Regional corporate entertainment |
| 4 | **Empty stubs** | 4 pages | Various |

**Total files affected:** ~43 files across categories, events, and pages contain duplicate or heavily overlapping content (2 duplicate pages deleted on 2026-02-16).
