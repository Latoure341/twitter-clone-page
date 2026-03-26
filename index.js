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

// NEW FEATURE: Tweet Creation
(function initTweetCreation() {
  var STORAGE_KEY = "tw_clone_userTweets_v1";
  var isHydrated = false;
  var timestampIntervalId = null;

  function safeParseJSON(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  }

  function formatTimeAgo(createdAtMs) {
    var now = Date.now();
    var deltaMs = now - createdAtMs;
    if (deltaMs < 0) return "Just now";

    var seconds = Math.floor(deltaMs / 1000);
    if (seconds < 60) return "Just now";

    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + "m";

    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h";

    var days = Math.floor(hours / 24);
    return days + "d";
  }

  function loadStoredTweets() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = safeParseJSON(raw, []);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveStoredTweets(tweets) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tweets));
    } catch (e) {
      // Ignore storage failures (e.g. private mode / quota).
    }
  }

  function getUserTweetRowFromHeartIcon(heartIconEl) {
    if (!heartIconEl || !heartIconEl.closest) return null;
    return heartIconEl.closest('div.row.border-bottom.border-secondary.m-0[data-tweet-id]');
  }

  function getTweetHeadingTimestampSpan(tweetRowEl) {
    if (!tweetRowEl) return null;
    var headingEl = tweetRowEl.querySelector(".post-heading .heading");
    if (!headingEl) return null;
    var spans = headingEl.querySelectorAll("span.fs-6.pe-1");
    if (!spans || spans.length === 0) return null;
    return spans[spans.length - 1];
  }

  function getHeartWrapperAndCountSpan(tweetRowEl) {
    if (!tweetRowEl) return null;
    var heartIcon = tweetRowEl.querySelector("i.bi-heart");
    if (!heartIcon) return null;
    var wrapper = heartIcon.parentElement;
    var countEl = wrapper
      ? wrapper.querySelector("span.fs-6.text-secondary")
      : null;
    return { wrapper: wrapper, countEl: countEl, heartIcon: heartIcon };
  }

  function createTweetElement(tweet) {
    var tweetId = tweet.id;
    var createdAtMs = Number(tweet.createdAtMs || Date.now());
    var text = String(tweet.text || "");
    var likeCount = Number(tweet.likeCount || 0);
    var liked = Boolean(tweet.liked);

    // Clone the existing feed tweet-card structure (markup-only).
    var host = document.createElement("div");
    host.innerHTML =
      '<div class="row border-bottom border-secondary m-0">' +
      '  <div class="col">' +
      '    <div class="row post-content p-2">' +
      '      <div class="col-1 pe-0  ps-0">' +
      '        <img class="rounded-pill ms-2" src="https://pbs.twimg.com/profile_images/2033865584266346496/g1G15O4b_400x400.jpg" height="40px" width="40px"/>' +
      '      </div>' +
      '      <div class="post-container col-11 d-flex flex-column align-items-start ps-2">' +
      '        <div class="post-heading container d-flex justify-content-between px-1">' +
      '          <div class="heading d-flex align-items-center me-4">' +
      '            <span class="fs-6 pe-1 fw-bolder">You</span>' +
      '            <a class="user-details pe-1"><i class="bi bi-patch-check fs-6"></i></a>' +
      '            <span class="fs-6 text-secondary pe-1">@You</span>' +
      '            <span class="fs-6 pe-1">. 0s</span>' +
      "          </div>" +
      '          <div class="heading-icons ms-4">' +
      '            <img src="./assets/grok-3.svg" alt="grok" height="20px" width="20px"/>' +
      '            <i class="bi bi-three-dots description more-details ps-1 fs-6 text-secondary"></i>' +
      "          </div>" +
      "        </div>" +
      '        <p class="content-description px-1">__TWEET_TEXT__</p>' +
      '        <div class="content-picture">' +
      '          <img class="rounded-4" src="https://pbs.twimg.com/media/HDw5keSXwAAIssQ?format=jpg&name=small" alt="content-picture" height="500px" width="400px"/>' +
      "        </div>" +
      '        <div class="content-footer d-flex align-items-center gap-4 pe-2 ps-2">' +
      '          <span class="me-4 p-1"><i class="fs-6 bi bi-chat text-secondary"></i> <span class="fs-6 text-secondary">0</span></span>' +
      '          <span class="me-4 p-1"><i class="bi fs-6 bi-arrow-repeat text-secondary"></i><span class="fs-6 text-secondary">0</span> </span>' +
      '          <span class="me-4 p-1"><i class="bi fs-6 bi-heart text-secondary"></i> <span class="fs-6 text-secondary">0</span></span>' +
      '          <span class="me-4 p-1"><i class="bi fs-6 bi-bar-chart text-secondary"></i> <span class="fs-6 text-secondary">0</span> </span>' +
      '          <span class="ms-4 p-1">' +
      '            <i class="bi fs-6 bi-bookmark text-secondary"></i> ' +
      '            <i class="bi fs-6 bi-upload text-secondary"></i>' +
      "          </span>" +
      "        </div>" +
      "      </div>" +
      "    </div>" +
      "  </div>" +
      "</div>";

    var tweetRowEl = host.firstElementChild;
    if (!tweetRowEl) return null;

    tweetRowEl.dataset.tweetId = tweetId;

    // Tweet text.
    var textEl = tweetRowEl.querySelector(".content-description");
    if (textEl) textEl.textContent = text;

    // Timestamp.
    var timestampSpan = getTweetHeadingTimestampSpan(tweetRowEl);
    if (timestampSpan) {
      timestampSpan.dataset.createdAtMs = String(createdAtMs);
      timestampSpan.textContent = formatTimeAgo(createdAtMs);
    }

    // Image Rendering in Tweet
    var contentPictureDiv = tweetRowEl.querySelector('.content-picture');
    var img = contentPictureDiv ? contentPictureDiv.querySelector('img') : null;
    if (tweet.imageUrl && img) {
      img.src = tweet.imageUrl;
      contentPictureDiv.style.display = 'block';
    } else if (contentPictureDiv) {
      contentPictureDiv.style.display = 'none';
    }

    // Like counter (per tweet).
    var likeBits = getHeartWrapperAndCountSpan(tweetRowEl);
    if (likeBits && likeBits.wrapper && likeBits.countEl) {
      likeBits.countEl.textContent = String(likeCount);
      likeBits.wrapper.dataset.likeCount = String(likeCount);
      likeBits.wrapper.dataset.liked = String(liked);
      likeBits.wrapper.dataset.wasCompact = "false";
    }

    return tweetRowEl;
  }

  function insertTweetAtTop(feedEl, tweetRowEl) {
    if (!feedEl || !tweetRowEl) return;

    // Insert before the first existing (or already inserted) post card.
    var firstPostContainer = feedEl.querySelector(
      ".row.border-bottom.border-secondary.m-0 .post-container",
    );
    var firstPostRow = firstPostContainer
      ? firstPostContainer.closest(
          "div.row.border-bottom.border-secondary.m-0",
        )
      : null;

    if (firstPostRow && firstPostRow.parentNode) {
      firstPostRow.parentNode.insertBefore(tweetRowEl, firstPostRow);
    } else {
      feedEl.appendChild(tweetRowEl);
    }
  }

  function updateUserTweetTimestamps() {
    var tweetRows = document.querySelectorAll(
      'div.row.border-bottom.border-secondary.m-0[data-tweet-id]',
    );
    for (var i = 0; i < tweetRows.length; i++) {
      var rowEl = tweetRows[i];
      var tsEl = getTweetHeadingTimestampSpan(rowEl);
      if (!tsEl) continue;

      var createdAtMs = Number(tsEl.dataset.createdAtMs || "0");
      if (!createdAtMs) continue;
      tsEl.textContent = formatTimeAgo(createdAtMs);
    }
  }

  function hydrateFromLocalStorage() {
    if (isHydrated) return;
    isHydrated = true;

    var feedEl = document.querySelector("section.feed");
    if (!feedEl) return;

    var storedTweets = loadStoredTweets();

    var existingIds = new Set(
      Array.prototype.slice
        .call(feedEl.querySelectorAll("[data-tweet-id]"))
        .map(function (el) {
          return el.dataset.tweetId;
        })
        .filter(function (id) {
          return Boolean(id);
        }),
    );

    storedTweets
      .slice()
      .sort(function (a, b) {
        return Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0);
      })
      .forEach(function (tweet) {
        if (!tweet || !tweet.id) return;
        if (existingIds.has(tweet.id)) return;

        var tweetEl = createTweetElement(tweet);
        if (tweetEl) insertTweetAtTop(feedEl, tweetEl);
      });

    // Keep timestamps fresh for user-created tweets.
    if (timestampIntervalId) clearInterval(timestampIntervalId);
    updateUserTweetTimestamps();
    timestampIntervalId = setInterval(updateUserTweetTimestamps, 30000);
  }

  var feedForm = document.querySelector("section.feed form.d-flex.flex-column");
  if (feedForm) {
    // NEW FEATURE: Tweet Image Upload
    var imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.id = 'tweet-image-input';
    imageInput.style.display = 'none';
    feedForm.appendChild(imageInput);

    var previewDiv = document.createElement('div');
    previewDiv.id = 'tweet-image-preview';
    previewDiv.style.display = 'none';
    previewDiv.innerHTML = '<img id="preview-img" style="max-width: 200px; max-height: 200px; border-radius: 8px;">';
    feedForm.appendChild(previewDiv);

    var imageIcon = feedForm.querySelector('.material-symbols-outlined');
    if (imageIcon) {
      imageIcon.addEventListener('click', function(e) {
        e.preventDefault();
        imageInput.click();
      });
    }

    imageInput.addEventListener('change', function() {
      var file = this.files[0];
      if (file) {
        var url = URL.createObjectURL(file);
        document.getElementById('preview-img').src = url;
        previewDiv.style.display = 'block';
      } else {
        previewDiv.style.display = 'none';
      }
    });

    // NEW FEATURE: Image Preview
    // Handled above

    feedForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var inputEl = feedForm.querySelector(".post-input");
      if (!inputEl) return;

      var tweetText = String(inputEl.value || "").trim();
      if (!tweetText) return; // Do nothing on empty tweet.

      var file = imageInput.files[0];
      var imageUrl = file ? URL.createObjectURL(file) : null;

      var tweetId = "tw_user_" + Date.now() + "_" + Math.random().toString(16).slice(2);
      var createdAtMs = Date.now();

      var tweet = {
        id: tweetId,
        text: tweetText,
        createdAtMs: createdAtMs,
        likeCount: 0,
        liked: false,
        imageUrl: imageUrl,
      };

      var feedEl = document.querySelector("section.feed");
      var tweetEl = createTweetElement(tweet);
      if (feedEl && tweetEl) insertTweetAtTop(feedEl, tweetEl);

      // Persist so refresh keeps the tweet.
      var storedTweets = loadStoredTweets();
      storedTweets.push(tweet);
      saveStoredTweets(storedTweets);

      inputEl.value = "";
      imageInput.value = "";
      previewDiv.style.display = 'none';
    });
  }

  // Persist like state to localStorage when user toggles heart.
  document.addEventListener("click", function (e) {
    var heartIcon = e.target && e.target.closest ? e.target.closest("i.bi-heart") : null;
    if (!heartIcon) return;

    var tweetRowEl = getUserTweetRowFromHeartIcon(heartIcon);
    if (!tweetRowEl) return;

    var tweetId = tweetRowEl.dataset.tweetId;
    if (!tweetId) return;

    var likeBits = getHeartWrapperAndCountSpan(tweetRowEl);
    if (!likeBits || !likeBits.wrapper) return;

    var likeCount = Number(likeBits.wrapper.dataset.likeCount || "0");
    var liked = likeBits.wrapper.dataset.liked === "true";

    var storedTweets = loadStoredTweets();
    var idx = storedTweets.findIndex(function (t) {
      return t && t.id === tweetId;
    });
    if (idx === -1) return;

    storedTweets[idx].likeCount = likeCount;
    storedTweets[idx].liked = liked;
    saveStoredTweets(storedTweets);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrateFromLocalStorage);
  } else {
    // If DOMContentLoaded already fired, hydrate immediately.
    hydrateFromLocalStorage();
  }
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
