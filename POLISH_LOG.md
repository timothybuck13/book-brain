# Book Brain Auto-Polish Log

Hourly UI improvements applied autonomously by Hatch.

---

## 2026-05-22 14:00 UTC
**Change:** Cycling animated placeholder text in chat input — the static "Ask about books..." placeholder now rotates through five different suggestion prompts ("What should I read next?", "Find me a page-turner…", "What are my reading patterns?", "Suggest something outside my comfort zone…") every 4 seconds with a subtle fade-in-up animation. Uses a positioned overlay span instead of the native placeholder attribute for full animation control. On focus, snaps to a static "Ask about books…" text without animation. Cycling pauses whenever the input has text or is focused, and restarts from the next suggestion when re-blurred. `placeholder-cycle` CSS keyframe (opacity + translateY) with reduced-motion fallback.
**Files:** src/App.jsx, src/index.css

## 2026-05-02 14:00 UTC
**Change:** Toast notification system — added a lightweight toast/snackbar system for user action feedback. Toasts slide up from the bottom of the screen with a spring animation, auto-dismiss after 2.5s with a fade-out exit, and support success (green checkmark) and error (red warning) types. Wired up to: book added to library, book removed, all books deleted, conversation deleted, and import completion (shows count). Error variants added for failed add/delete operations. CSS keyframe animations (`toastIn` slide-up + scale, `toastOut` fade-down), `pointer-events-none` container with `pointer-events-auto` toasts, `role="status"` + `aria-live="polite"` for screen reader accessibility.
**Files:** src/index.css, src/App.jsx, src/LibraryView.jsx
**Commit:** 80441b6

## 2026-05-01 14:00 UTC
**Change:** Keyboard shortcuts — added global keyboard shortcuts for power users. `⌘/Ctrl+N` starts a new chat (in chat view only), `/` focuses the chat input (in chat or demo view, skipped when in library or import modal). Shortcuts are suppressed when already typing in an input/textarea. Added a discoverable `⌘N` kbd badge on the sidebar's "New Chat" button (desktop only) and a title tooltip. Respects context — shortcuts only activate in relevant app states.
**Files:** src/App.jsx, src/Sidebar.jsx
**Commit:** 2e7fc36

## 2026-04-24 04:00 UTC
**Change:** Smooth page/view transitions and fade-in animations — added CSS keyframe animations (fadeIn, fadeInUp, fadeInScale, messageIn, backdropIn) with staggered delay utilities. Applied to: landing page (logo scale-in, staggered CTA buttons), onboarding steps, demo/chat empty states (staggered suggestion cards), chat messages (slide-up entrance), and import modal (backdrop fade + content scale-in).
**Files:** src/index.css, src/App.jsx, src/ChatMessage.jsx, src/ImportModal.jsx
**Commit:** a460f90 (local — push pending: GitHub token expired)

## 2026-04-24 05:00 UTC
**Change:** Hover micro-interactions on buttons and cards — added four CSS interaction classes: `card-hover` (translateY lift + shadow on suggestion cards, book rows, onboarding prompts), `btn-press` (scale-down on click + amber glow on hover for all primary buttons), `send-glow` (amber glow ring on the chat send button), `sidebar-row` (smooth background transition + subtle press scale on conversation items). Uses cubic-bezier easing for natural feel. Active/pressed states provide tactile click feedback.
**Files:** src/index.css, src/App.jsx, src/Sidebar.jsx, src/LibraryView.jsx, src/ImportModal.jsx
**Commit:** 8b273b3 (local — push pending: GitHub + Vercel tokens expired)

## 2026-04-24 06:00 UTC
**Change:** Shimmer skeleton loading states — added a full CSS shimmer animation system (`@keyframes shimmer`, `.skeleton`, `.skeleton-text`, `.skeleton-circle`, `.skeleton-book-row`) with staggered wave timing. Applied to: app loading screen (skeleton header bar + pulse-glow logo), onboarding import step (5 animated book-row skeletons with varying widths), and ImportModal parsing/importing states (3–4 skeleton book rows). Replaces bare "Loading…" text with visual placeholders that hint at incoming content shape.
**Files:** src/index.css, src/App.jsx, src/ImportModal.jsx
**Commit:** cb82c9c (local — push pending: GitHub + Vercel tokens expired)

## 2026-04-24 07:00 UTC
**Change:** Input focus animations and better form UX — added `.input-focus` class (warm amber border + outer glow ring on focus with smooth transitions) and `.chat-input-bar` class (container lifts 1px and gains a subtle amber-tinted glow via `:focus-within` when the textarea is active; amber caret color). Applied to: main chat input form (lift + glow), Library search input, sort dropdown, add-book title/author/date fields. Replaces flat `focus:border-gray-300` with a cohesive warm focus system matching the amber brand color.
**Files:** src/index.css, src/App.jsx, src/LibraryView.jsx
**Commit:** 9759ade (local — push pending: GitHub + Vercel tokens expired)

## 2026-04-24 08:00 UTC
**Change:** Empty state illustrations and improved messaging — replaced bare text empty states with decorative SVG icons (open book, magnifying glass, chat bubble, upload arrow, warning triangle, success checkmark) inside tinted icon containers, plus improved copy with helpful subtext and CTAs. Applied to: Library empty state (amber book icon + "Add Your First Book" button), Library search-no-results (gray search icon + helper text), Sidebar empty conversations (amber chat icon + two-line description), onboarding/import drop zones (upload arrow icon), error states (warning triangle in red-50 pill), and import/onboarding success states (green checkmark circle with scale-in animation).
**Files:** src/App.jsx, src/ImportModal.jsx, src/LibraryView.jsx, src/Sidebar.jsx
**Commit:** ff5bfde (local — push pending: GitHub token expired; 5 commits now queued)

## 2026-04-25 14:00 UTC
**Change:** Accessibility improvements — added ARIA attributes, keyboard navigation, focus management, and reduced-motion support. Key changes: ImportModal gets `role="dialog"`, `aria-modal`, `aria-label`, focus trapping (Tab cycles within modal), and Escape-to-close. User menu gets `aria-expanded`, `aria-haspopup`, `role="menu"`/`role="menuitem"`, and Escape-to-close. Sidebar gets `role="navigation"`, `aria-label`, and Escape-to-close on mobile. All icon-only buttons get descriptive `aria-label` (hamburger, close, delete, send). Chat textarea gets `aria-label`. Message containers get `role="log"` and `aria-live="polite"` for screen readers. CSS adds `:focus-visible` amber outline for keyboard users (hidden for mouse), `.sr-only` utility, and `prefers-reduced-motion: reduce` media query that disables all animations.
**Files:** src/index.css, src/App.jsx, src/ImportModal.jsx, src/Sidebar.jsx, src/LibraryView.jsx

## 2026-05-17 14:00 UTC
**Change:** Touch-friendly action buttons — on touch-only devices (phones, tablets), delete buttons (book rows, sidebar conversations) and copy buttons (chat messages) are now visible at low opacity instead of being completely hidden behind hover states. Uses `@media (hover: none) and (pointer: coarse)` to detect touch devices. Buttons appear at 35% opacity and brighten to full on tap. Mouse users retain the existing hover-to-reveal behavior unchanged. Added `.hover-action` utility class to the three hidden-action-button patterns: library book delete, sidebar conversation delete, and chat message copy.
**Files:** src/index.css, src/LibraryView.jsx, src/Sidebar.jsx, src/ChatMessage.jsx
**Commit:** (see git log)

## 2026-05-20 14:00 UTC
**Change:** Dynamic document title — the browser tab now reflects the current app context instead of always showing "Book Brain". Title updates include: "Personalized Book Recommendations" suffix on landing page, "Set Up Your Library" during onboarding, "My Library" when viewing books, "Thinking…" during AI response streaming, active conversation title (truncated to 50 chars) when chatting, and "Demo" in demo mode. Falls back to plain "Book Brain" for new-chat state. Improves tab management for multi-tab users and provides a subtle streaming status indicator in the browser chrome.
**Files:** src/App.jsx
**Commit:** (see git log)

## 2026-05-19 14:00 UTC
**Change:** Time-based conversation group headers in sidebar — conversations are now grouped under "Today", "Yesterday", "This Week", and "Earlier" headers based on their creation date. Uses a `getTimeGroup()` function that compares each conversation's timestamp against midnight boundaries and a 7-day rolling window. The `groupConversations()` function preserves the existing sort order within each group. Headers use tiny uppercase tracking-widest labels (10px) in gray-400 with a subtle fade-in animation via the existing `fadeIn` keyframe. The grouping recalculates every 60 seconds alongside the existing relative-time ticker, so conversations automatically move between groups at midnight. Empty groups are hidden. `sidebar-group-header` CSS class added to `index.css`.
**Files:** src/Sidebar.jsx, src/index.css
**Commit:** 31d6f84

## 2026-05-18 14:00 UTC
**Change:** Smooth exit animation on book row deletion — when a book is deleted from the library, the row now fades out with a slide-left + scale-down + height collapse animation (0.35s ease-in-out) before being removed from state. Uses a `deletingIds` set to track rows mid-animation. `pointer-events: none` prevents interaction during exit. Respects `prefers-reduced-motion` by hiding instantly instead of animating.
**Files:** src/index.css, src/LibraryView.jsx
