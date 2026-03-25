// NEW FEATURE: Like Button Toggle
(function initLikeToggle() {
  function parseCompactNumber(str) {
    const s = String(str || "")
      .trim()
      .replace(/,/g, "");
    const m = s.match(/^(-?\d+(?:\.\d+)?)([KMB])?$/i);
    if (!m) return 0;
    const num = parseFloat(m[1]);
    const suffix = (m[2] || "").toUpperCase();
    const mult =
      suffix === "K" ? 1e3 : suffix === "M" ? 1e6 : suffix === "B" ? 1e9 : 1;
    return Math.round(num * mult);
  }

  function formatCompactNumber(value) {
    const v = Math.round(Number(value));
    if (!Number.isFinite(v)) return "0";
    const abs = Math.abs(v);
    if (abs < 1000) return String(v);

    if (abs < 1e6) {
      const num = v / 1e3;
      const decimals = v % 1e3 === 0 ? 0 : 1;
      const fixed = decimals === 0 ? num.toFixed(0) : num.toFixed(1);
      return fixed.replace(/\.0$/, "") + "K";
    }

    if (abs < 1e9) {
      const num = v / 1e6;
      const decimals = v % 1e6 === 0 ? 0 : 1;
      const fixed = decimals === 0 ? num.toFixed(0) : num.toFixed(1);
      return fixed.replace(/\.0$/, "") + "M";
    }

    const num = v / 1e9;
    const decimals = v % 1e9 === 0 ? 0 : 1;
    const fixed = decimals === 0 ? num.toFixed(0) : num.toFixed(1);
    return fixed.replace(/\.0$/, "") + "B";
  }

  document.addEventListener("click", function onDocumentClick(e) {
    const heartIcon =
      e.target && e.target.closest ? e.target.closest("i.bi-heart") : null;
    if (!heartIcon) return;

    // Heart icon is inside the small span that also holds the count span.
    const wrapper = heartIcon.parentElement;
    if (!wrapper) return;

    const countEl =
      wrapper.querySelector("span.fs-6.text-secondary") ||
      wrapper.querySelector("span");
    if (!countEl) return;

    // Initialize per-tweet (per-heart-wrapper) like state lazily on first interaction.
    if (!wrapper.dataset.likeCount) {
      wrapper.dataset.likeCount = String(
        parseCompactNumber(countEl.textContent),
      );
      wrapper.dataset.liked = "false";
      wrapper.dataset.wasCompact = String(/[KMB]/i.test(countEl.textContent));
    }

    const currentCount = Number(wrapper.dataset.likeCount || "0");
    const liked = wrapper.dataset.liked === "true";
    const nextCount = Math.max(0, currentCount + (liked ? -1 : 1));

    wrapper.dataset.likeCount = String(nextCount);
    wrapper.dataset.liked = String(!liked);
    // If the original count used compact notation (e.g. "1.4K"), show exact integers
    // after interaction so the +/-1 behavior is visible on every click.
    countEl.textContent =
      wrapper.dataset.wasCompact === "true"
        ? String(nextCount)
        : formatCompactNumber(nextCount);

    heartIcon.setAttribute("aria-pressed", String(!liked));
  });
})();

// NEW FEATURE: Tweet Timestamp
(function initTweetTimestamps() {
  function parseRelativeAge(text) {
    // Expected formats currently in markup: ". 4h", ". 23h", ". 9h", etc.
    const s = String(text || "").trim();
    const m = s.match(/\.?\s*(\d+(?:\.\d+)?)\s*([smhd])\b/i);
    if (!m) return null;
    const amount = parseFloat(m[1]);
    const unit = (m[2] || "").toLowerCase();
    const ms =
      unit === "s"
        ? 1000
        : unit === "m"
          ? 60 * 1000
          : unit === "h"
            ? 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;
    return Math.round(amount * ms);
  }

  function formatTimeAgo(createdAtMs) {
    const now = Date.now();
    const deltaMs = now - createdAtMs;
    if (deltaMs < 0) return "Just now";

    const seconds = Math.floor(deltaMs / 1000);
    if (seconds < 60) return "Just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + "m";

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h";

    const days = Math.floor(hours / 24);
    return days + "d";
  }

  function updateTimestampSpans(timestampSpans) {
    for (let i = 0; i < timestampSpans.length; i++) {
      const el = timestampSpans[i];
      const createdAtMs = Number(el.dataset.createdAtMs || "0");
      if (!createdAtMs) continue;
      el.textContent = formatTimeAgo(createdAtMs);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const timestampSpans = Array.prototype.slice
      .call(document.querySelectorAll(".post-heading .heading span.fs-6.pe-1"))
      .filter(function (el) {
        return /^\s*\.\s*\d/.test(el.textContent || "");
      });

    // Store a deterministic created-at timestamp per tweet so reloads keep progressing.
    const storedKeyPrefix = "tw_clone_createdAtMs_";
    const now = Date.now();

    timestampSpans.forEach(function (spanEl, idx) {
      const key = storedKeyPrefix + idx;
      const stored = localStorage.getItem(key);

      if (stored) {
        spanEl.dataset.createdAtMs = stored;
        return;
      }

      const ageMs = parseRelativeAge(spanEl.textContent);
      // Fallback to "just now" if parsing fails.
      const createdAt = new Date(now - (ageMs != null ? ageMs : 0));
      spanEl.dataset.createdAtMs = String(createdAt.getTime());
      localStorage.setItem(key, String(createdAt.getTime()));
    });

    updateTimestampSpans(timestampSpans);
    setInterval(function () {
      updateTimestampSpans(timestampSpans);
    }, 30000);
  });
})();
