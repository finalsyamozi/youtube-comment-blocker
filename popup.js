async function initialize() {

    const data =
        await chrome.storage.local.get({
            darkMode: false
        });

    document.body.classList.toggle(
        "dark",
        data.darkMode
    );

}

async function addUser() {

    const input =
        document.getElementById(
            "userInput"
        );

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
        document.getElementById(
            "wordInput"
        );

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

document.addEventListener(
    "DOMContentLoaded",
    () => {

        document
            .getElementById(
                "openOptions"
            )
            .addEventListener(
                "click",
                () => {

                    chrome.runtime
                        .openOptionsPage();

                }
            );

        document
            .getElementById(
                "addUser"
            )
            .addEventListener(
                "click",
                addUser
            );

        document
            .getElementById(
                "addWord"
            )
            .addEventListener(
                "click",
                addWord
            );

        document
            .getElementById(
                "userInput"
            )
            .addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        addUser();

                    }

                }
            );

        document
            .getElementById(
                "wordInput"
            )
            .addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        addWord();

                    }

                }
            );

        initialize();

    }
);

chrome.storage.onChanged.addListener(
    async (
        changes,
        areaName
    ) => {

        if (
            areaName === "sync" &&
            changes.darkMode
        ) {

            initialize();

        }

    }
);
