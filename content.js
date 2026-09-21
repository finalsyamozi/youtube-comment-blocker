"use strict";

let currentSettings = {
  blockedUsers: [],
  blockedWords: [],
};

let processing = false;
let processRequested = false;
let processTimer = null;

/**
 * Chrome Sync Storageから設定を取得する
 */
async function loadSettings() {
  const data = await chrome.storage.sync.get({
    blockedUsers: [],
    blockedWords: [],
  });

  currentSettings = {
    blockedUsers: Array.isArray(data.blockedUsers) ? data.blockedUsers : [],
    blockedWords: Array.isArray(data.blockedWords) ? data.blockedWords : [],
  };
}

/**
 * 空文字を除去して比較用リストを作る
 */
function normalizeList(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * ユーザー名を比較用に整える
 * 先頭の@の有無を同一ユーザーとして扱う
 */
function normalizeAuthorName(authorName) {
  return String(authorName || "")
    .replace(/^@/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ユーザーまたはNGワードに一致するか判定する
 */
function shouldBlock(authorName, commentText) {
  const normalizedAuthorName = normalizeAuthorName(authorName);
  const blockedUsers = normalizeList(currentSettings.blockedUsers);
  const blockedWords = normalizeList(currentSettings.blockedWords);

  const userBlocked = blockedUsers.some(
    (user) => normalizeAuthorName(user) === normalizedAuthorName,
  );

  const wordBlocked = blockedWords.some((word) =>
    String(commentText || "").includes(word),
  );

  return userBlocked || wordBlocked;
}

/**
 * 最初に一致した要素を取得する
 */
function queryFirst(root, selectors) {
  if (!root) {
    return null;
  }

  for (const selector of selectors) {
    const element = root.querySelector(selector);

    if (element) {
      return element;
    }
  }

  return null;
}

/**
 * コメント投稿者要素を取得する
 */
function getCommentAuthor(comment) {
  return queryFirst(comment, [
    "a#author-text",
    "#header-author a#author-text",
    "yt-formatted-string#author-text",
    "#author-text",
    "#author-thumbnail-button[aria-label]",
  ]);
}

/**
 * コメント本文要素を取得する
 */
function getCommentText(comment) {
  return queryFirst(comment, [
    "yt-attributed-string#content-text",
    "#content-text",
    "ytd-expander #content-text",
    "ytd-expander yt-attributed-string[slot='content']",
    "#expander #content",
  ]);
}

/**
 * 投稿者名を取得する
 */
function getCommentAuthorName(author) {
  if (!author) {
    return "";
  }

  const textName = normalizeAuthorName(author.textContent);

  if (textName) {
    return textName;
  }

  return normalizeAuthorName(author.getAttribute("aria-label"));
}

/**
 * 返信ボタンまたは返信ボタンのコンテナを取得する
 */
function getReplyButton(comment) {
  return queryFirst(comment, [
    "ytd-comment-engagement-bar #reply-button-end",
    "#action-buttons #reply-button-end",
    "#reply-button-end",
    "ytd-comment-engagement-bar button[aria-label='返信']",
    "#action-buttons button[aria-label='返信']",
    "button[aria-label='返信']",
  ]);
}

/**
 * 非表示・再表示の対象要素を取得する
 *
 * コメント単体を優先する。
 * スレッド全体は最後のフォールバックとして使用する。
 */
function getHideTarget(element) {
  if (!element) {
    return null;
  }

  return (
    element.closest("ytd-comment-view-model") ||
    element.closest("ytd-comment-renderer") ||
    element.closest("ytd-comment-thread-renderer") ||
    element
  );
}

/**
 * 拡張機能によって要素を非表示にする
 */
function hideElement(element) {
  if (!element) {
    return;
  }

  element.dataset.ytcbBlocked = "true";
  element.style.display = "none";
}

/**
 * ブロック解除時に要素を再表示する
 */
function showElement(element) {
  if (!element || element.dataset.ytcbBlocked !== "true") {
    return;
  }

  delete element.dataset.ytcbBlocked;
  element.style.display = "";
}

/**
 * ユーザーをブロックリストへ追加する
 */
async function blockUser(userName) {
  const normalizedName = normalizeAuthorName(userName);

  if (!normalizedName) {
    return;
  }

  const data = await chrome.storage.sync.get({
    blockedUsers: [],
  });

  const blockedUsers = normalizeList(data.blockedUsers);
  const alreadyBlocked = blockedUsers.some(
    (user) => normalizeAuthorName(user) === normalizedName,
  );

  if (!alreadyBlocked) {
    blockedUsers.push(normalizedName);

    await chrome.storage.sync.set({
      blockedUsers,
    });
  }

  // storage.onChangedを待たずに現在のページへ即時反映する
  currentSettings.blockedUsers = blockedUsers;
}

/**
 * 🚫アイコンを「返信」の右側へ追加する
 */
function addBlockButton(comment, authorName) {
  if (!comment || !authorName) {
    return;
  }

  const existingButton = comment.querySelector(".ytcb-block-btn");

  if (existingButton) {
    return;
  }

  const replyButton = getReplyButton(comment);

  if (!replyButton) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ytcb-block-btn";
  button.textContent = "🚫";
  button.title = `${authorName} をブロック`;
  button.setAttribute("aria-label", `${authorName} をブロック`);
  button.dataset.author = authorName;

  const replyContainer =
    replyButton.closest("#reply-button-end") || replyButton;

  replyContainer.insertAdjacentElement("afterend", button);
}

/**
 * 通常コメント・返信の候補を取得する
 */
function getNormalCommentElements() {
  return document.querySelectorAll(
    ["ytd-comment-view-model", "ytd-comment-renderer"].join(","),
  );
}

/**
 * 通常コメントと返信を処理する
 */
function processNormalComments() {
  getNormalCommentElements().forEach((comment) => {
    try {
      const author = getCommentAuthor(comment);

      if (!author) {
        return;
      }

      const text = getCommentText(comment);
      const authorName = getCommentAuthorName(author);
      const commentText = text?.textContent || "";

      if (!authorName) {
        return;
      }

      const hideTarget = getHideTarget(comment);
      const blocked = shouldBlock(authorName, commentText);

      if (blocked) {
        hideElement(hideTarget);

        return;
      }

      showElement(hideTarget);
      addBlockButton(comment, authorName);
    } catch (error) {
      console.warn("コメントの解析に失敗しました。", error);
    }
  });
}

/**
 * ライブチャット投稿者要素を取得する
 */
function getLiveChatAuthor(chat) {
  return queryFirst(chat, [
    "#author-name",
    "yt-live-chat-author-chip #author-name",
    ".author-name",
    "[data-author-name]",
  ]);
}

/**
 * ライブチャット本文要素を取得する
 */
function getLiveChatMessage(chat) {
  return queryFirst(chat, [
    "#message",
    "yt-formatted-string#message",
    "#message-text",
    ".message",
  ]);
}

/**
 * ライブチャットを処理する
 */
function processLiveChat() {
  const selectors = [
    "yt-live-chat-text-message-renderer",
    "yt-live-chat-paid-message-renderer",
    "yt-live-chat-paid-sticker-renderer",
    "yt-live-chat-membership-item-renderer",
    "yt-live-chat-viewer-engagement-message-renderer",
  ];

  document.querySelectorAll(selectors.join(",")).forEach((chat) => {
    try {
      const author = getLiveChatAuthor(chat);
      const message = getLiveChatMessage(chat);
      const authorName = normalizeAuthorName(
        author?.textContent || author?.getAttribute("data-author-name") || "",
      );
      const messageText = message?.textContent || "";
      const blocked = shouldBlock(authorName, messageText);

      if (blocked) {
        hideElement(chat);
      } else {
        showElement(chat);
      }
    } catch (error) {
      console.warn("ライブチャットの解析に失敗しました。", error);
    }
  });
}

/**
 * コメント処理を実行する
 */
async function processComments() {
  if (processing) {
    processRequested = true;
    return;
  }

  processing = true;

  try {
    do {
      processRequested = false;
      processNormalComments();
      processLiveChat();
    } while (processRequested);
  } catch (error) {
    console.error("コメント処理中にエラーが発生しました。", error);
  } finally {
    processing = false;
  }
}

/**
 * MutationObserverの連続実行を抑制する
 */
function scheduleProcess() {
  if (processTimer !== null) {
    return;
  }

  processTimer = window.setTimeout(() => {
    processTimer = null;
    processComments();
  }, 100);
}

/**
 * 初期化
 */
async function initialize() {
  await loadSettings();
  await processComments();

  const observer = new MutationObserver(() => {
    scheduleProcess();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  document.addEventListener("yt-navigate-finish", async () => {
    await loadSettings();
    await processComments();
  });
}

initialize().catch((error) => {
  console.error("YouTube Comment Blockerの初期化に失敗しました。", error);
});

/**
 * 設定画面でユーザーやNGワードが変更された場合、
 * ページをリロードせず即時反映する
 */
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  if (!changes.blockedUsers && !changes.blockedWords) {
    return;
  }

  try {
    await loadSettings();
    await processComments();
  } catch (error) {
    console.error("設定変更の反映に失敗しました。", error);
  }
});

/**
 * 後から生成された🚫ボタンにも対応するイベント委譲
 */
document.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest(".ytcb-block-btn");

  if (!button) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (button.disabled) {
    return;
  }

  const authorName = button.dataset.author;

  if (!authorName) {
    return;
  }

  button.disabled = true;

  try {
    await blockUser(authorName);

    const hideTarget = getHideTarget(button);

    if (hideTarget) {
      hideElement(hideTarget);
    }

    await processComments();
  } catch (error) {
    console.error("ユーザーのブロックに失敗しました。", error);

    button.disabled = false;
  }
});
