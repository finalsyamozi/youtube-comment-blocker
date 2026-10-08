async function loadData() {

    const data = await chrome.storage.local.get({
        blockedUsers: [],
        blockedWords: [],
        darkMode: false
    });

    renderUsers(data.blockedUsers);
    renderWords(data.blockedWords);

    document.getElementById("userCount").textContent =
        data.blockedUsers.length;

    document.getElementById("wordCount").textContent =
        data.blockedWords.length;

    const darkMode =
        document.getElementById("darkMode");

    if (darkMode) {

        darkMode.checked = data.darkMode;

        document.body.classList.toggle(
            "dark",
            data.darkMode
        );
    }
}

function renderUsers(users) {

    const ul =
        document.getElementById("userList");

    ul.innerHTML = "";

    users.forEach(user => {

        const li =
            document.createElement("li");

        const text =
            document.createElement("span");

        text.textContent = user;

        const btn =
            document.createElement("button");

        btn.textContent = "削除";

        btn.onclick = () =>
            removeUser(user);

        li.appendChild(text);
        li.appendChild(btn);

        ul.appendChild(li);

    });
}

function renderWords(words) {

    const ul =
        document.getElementById("wordList");

    ul.innerHTML = "";

    words.forEach(word => {

        const li =
            document.createElement("li");

        const text =
            document.createElement("span");

        text.textContent = word;

        const btn =
            document.createElement("button");

        btn.textContent = "削除";

        btn.onclick = () =>
            removeWord(word);

        li.appendChild(text);
        li.appendChild(btn);

        ul.appendChild(li);

    });
}

async function addUser() {

    const input =
        document.getElementById("userInput");

    const value =
        input.value.trim();

    if (!value) {
        return;
    }

    const data =
        await chrome.storage.local.get({
            blockedUsers: []
        });

    const users = [
        ...new Set([
            ...data.blockedUsers,
            value
        ])
    ];

    await chrome.storage.local.set({
        blockedUsers: users
    });

    input.value = "";
}

async function addWord() {

    const input =
        document.getElementById("wordInput");

    const value =
        input.value.trim();

    if (!value) {
        return;
    }

    const data =
        await chrome.storage.local.get({
            blockedWords: []
        });

    const words = [
        ...new Set([
            ...data.blockedWords,
            value
        ])
    ];

    await chrome.storage.local.set({
        blockedWords: words
    });

    input.value = "";
}

async function removeUser(user) {

    const data =
        await chrome.storage.local.get({
            blockedUsers: []
        });

    await chrome.storage.local.set({
        blockedUsers:
            data.blockedUsers.filter(
                x => x !== user
            )
    });
}

async function removeWord(word) {

    const data =
        await chrome.storage.local.get({
            blockedWords: []
        });

    await chrome.storage.local.set({
        blockedWords:
            data.blockedWords.filter(
                x => x !== word
            )
    });
}

async function exportCsv() {

    const data =
        await chrome.storage.local.get({
            blockedUsers: [],
            blockedWords: []
        });

    const rows = [];

    rows.push("type,value");

    data.blockedUsers.forEach(user => {
        rows.push(
            `user,"${user.replace(/"/g, '""')}"`
        );
    });

    data.blockedWords.forEach(word => {
        rows.push(
            `word,"${word.replace(/"/g, '""')}"`
        );
    });

    const csv =
        rows.join("\n");

    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

    a.href = url;

    a.download =
        "youtube-comment-blocker.csv";

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

async function importCsv(event) {

    const file =
        event.target.files[0];

    if (!file) {
        return;
    }

    const confirmed =
        confirm(
            "CSVをインポートすると現在のブロックユーザーとNGワードは上書きされます。\n\n続行しますか？"
        );

    if (!confirmed) {

        event.target.value = "";

        return;

    }

    const text =
        await file.text();

    const blockedUsers = [];
    const blockedWords = [];

    const lines =
        text.split(/\r?\n/);

    lines.slice(1).forEach(line => {

        if (!line.trim()) {
            return;
        }

        const comma =
            line.indexOf(",");

        if (comma < 0) {
            return;
        }

        const type =
            line.substring(0, comma);

        const value =
            line
                .substring(comma + 1)
                .replace(/^"/, "")
                .replace(/"$/, "")
                .replace(/""/g, '"');

        if (type === "user") {
            blockedUsers.push(value);
        }

        if (type === "word") {
            blockedWords.push(value);
        }

    });

    await chrome.storage.local.set({
        blockedUsers:
            [...new Set(blockedUsers)],
        blockedWords:
            [...new Set(blockedWords)]
    });

alert(
    "CSVのインポートが完了しました。\n現在の設定はインポート内容で上書きされています。"
);

    event.target.value = "";
}

document
    .getElementById("addUser")
    .addEventListener(
        "click",
        addUser
    );

document
    .getElementById("addWord")
    .addEventListener(
        "click",
        addWord
    );

document
    .getElementById("exportCsv")
    .addEventListener(
        "click",
        exportCsv
    );

document
    .getElementById("importCsvButton")
    .addEventListener(
        "click",
        () => {
            document
                .getElementById("importCsv")
                .click();
        }
    );

document
    .getElementById("importCsv")
    .addEventListener(
        "change",
        importCsv
    );

document
    .getElementById("userInput")
    .addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {
                addUser();
            }

        }
    );

document
    .getElementById("wordInput")
    .addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {
                addWord();
            }

        }
    );

const darkMode =
    document.getElementById("darkMode");

if (darkMode) {

    darkMode.addEventListener(
        "change",
        async event => {

            document.body.classList.toggle(
                "dark",
                event.target.checked
            );

            await chrome.storage.local.set({
                darkMode:
                    event.target.checked
            });

        }
    );

}

chrome.storage.onChanged.addListener(
    (_, areaName) => {

        if (areaName === "local") {
            loadData();
        }

    }
);

document
    .querySelectorAll(".tab-button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(
                        ".tab-button"
                    )
                    .forEach(btn => {

                        btn.classList.remove(
                            "active"
                        );

                    });

                document
                    .querySelectorAll(
                        ".tab-content"
                    )
                    .forEach(tab => {

                        tab.classList.remove(
                            "active"
                        );

                    });

                button.classList.add(
                    "active"
                );

                const targetTab =
                    document.getElementById(
                        button.dataset.tab
                    );

                if (targetTab) {

                    targetTab.classList.add(
                        "active"
                    );

                }

            }
        );

    });

loadData();
