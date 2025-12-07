import {isGenerating} from "../../../../script.js";

/** @type {Function} */
toastr.error

/** @type {Function} */
toastr.warning

/** @type {Function} */
toastr.success

/** @type {Function} */
toastr.info

// * MARK:Extension variables

const context = () => SillyTavern.getContext();
const {
    chat,
    getTokenCountAsync,
    deactivateSendButtons,
    activateSendButtons,
    saveChat,
    reloadCurrentChat,
    saveSettingsDebounced,
    callGenericPopup,
    POPUP_TYPE,
    t
} = context();

const extensionName = "SillyTavern-Add-Missing-Metadata";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = context().extensionSettings[extensionName];
const defaultSettings = {
    enabled: true,
    debug: false
};

const METADATA_KEYS_TO_AVOID = [
    'chat_id_hash',
    'persona',
    'integrity',
    'tainted'
]

const HTML_TEMPLATES = {
    settings: async function() {
        return await $.get(`${extensionFolderPath}/settings.html`)
    }
};

// * MARK:Debugs methods

const log = (...msg) => {
    if (!extensionSettings.enabled || !extensionSettings.debug) return;
    console.log("[" + extensionName + "]", ...msg);
};

// * MARK:Extension methods

/** Adds token_count to all messages in the current chat */
async function addTokenCount() {
    if (!extensionSettings.enabled) return;

    if (context().chatId === undefined) return toastr.error(t`No chat is active`);
    if (isGenerating()) return toastr.warning(t`Generating message, try again when generation finishes`);

    deactivateSendButtons();

    for (const mess of chat) {
        if (!mess.extra && mess.extra.token_count !== undefined) continue;

        const currentTokenCount = await getTokenCountAsync(String(mess.mes));
        mess.extra.token_count = Number(currentTokenCount);
    }

    saveChat();
    activateSendButtons();
    toastr.success(t`token_count added to all messages in the current chat`);
}

async function exportChatMetadata() {
    if (!extensionSettings.enabled) return;

    if (context().chatId === undefined) return toastr.error(t`No chat is active`);
    if (isGenerating()) return toastr.warning(t`Generating message, try again when generation finishes`);

    await saveChat();

    const chatMeta = {};

    for (const [k, v] of Object.entries(context().chatMetadata ?? {})) {
        if (METADATA_KEYS_TO_AVOID.includes(k)) continue;
        chatMeta[k] = v;
    }

    const exportData = JSON.stringify(chatMeta, null, 2);

    const blob = new Blob([exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat_${context().chatId}_metadata.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    toastr.success(t`Chat metadata exported successfully`);
}

async function importChatMetadata() {
    if (!extensionSettings.enabled) return;

    if (context().chatId === undefined) return toastr.error(t`No chat is active`);
    if (isGenerating()) return toastr.warning(t`Generating message, try again when generation finishes`);

    await saveChat();

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.onchange = async (event) => {
        const file = /** @type {HTMLInputElement} */ (event.target).files[0];

        if (!file) return;

        const popupValue = await callGenericPopup(t`Are you sure? It will override your extensions metadata.`, POPUP_TYPE.CONFIRM, null, {okButton: t`Continue`, cancelButton: t`Cancel`});

        if (!popupValue) return toastr.info(t`Import cancelled by user`);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = /** @type {string} */ (e.target.result);
                const importedMetadata = JSON.parse(content);
                
                for (const key in importedMetadata)
                    if (METADATA_KEYS_TO_AVOID.includes(key)) delete importedMetadata[key];
                
                log(importedMetadata);

                for (const [k, v] of Object.entries(importedMetadata))
                    context().chatMetadata[k] = v;

                await saveChat();

                toastr.success(t`Chat metadata imported successfully - Reloading chat...`);

                await reloadCurrentChat();
            } catch (error) {
                toastr.error(t`Failed to import chat metadata: ` + error.message);
            }
        };

        reader.readAsText(file);
    };

    input.click();
}

/** Initializes all the feature buttons inside the extension menu */
function setExtensionButtons() {
    $('#add-miss-meta-token-count').on("click", addTokenCount);
    $('#add-miss-meta-export-chat-metadata').on("click", exportChatMetadata);
    $('#add-miss-meta-import-chat-metadata').on("click", importChatMetadata);
}

// * MARK:Extension settings

const settingsCallbacks = {
    /**	Enables/Disables the extension */
    enabled: () => {
        // Nothing by the moment
    }
}

/** Changes a setting value and triggers a callback if there's any on settingsCallbacks. */
function settingsBooleanButton(event) {
    const target = event.target;
    const value = Boolean($(target).prop("checked"));
    const setting = target.getAttribute("add-miss-meta-setting");
    const callback = settingsCallbacks[setting];

    extensionSettings[setting] = value;

    if (callback) callback();

    log("toggleSetting " + setting, value);
    saveSettingsDebounced();
}

/**	Logs setting's values. */
function displaySettings() {
    console.debug("[" + extensionName + "]", `The extension is ${extensionSettings.enabled ? "active" : "not active"}`);
    console.debug("[" + extensionName + "]", `Debug mode is ${extensionSettings.debug ? "active" : "not active"}`);
    console.debug("[" + extensionName + "]", structuredClone(extensionSettings));
}

/** Append settings menu on ST and set listeners. */
async function loadHTMLSettings() {
    const settingsHtml = await HTML_TEMPLATES.settings();

    $("#extensions_settings").append(settingsHtml);

    // Event Listeners for the extension HTML
    $("#add-miss-meta-check-configuration").on("click", displaySettings);
    $("#add-miss-meta-activate-debug").on("input", settingsBooleanButton);
    $("#add-miss-meta-activate-extension").on("input", settingsBooleanButton);

    log("loadHTMLSettings");
}

/** Init setting values on the menu */
function setSettings() {
    $("#add-miss-meta-activate-extension").prop("checked", extensionSettings.enabled).trigger("input");
    $("#add-miss-meta-activate-debug").prop("checked", extensionSettings.debug).trigger("input");

    log("setSettings", extensionSettings);
}

// * Initialize Extension

(async function initExtension() {

    if (!context().extensionSettings[extensionName]) {
        context().extensionSettings[extensionName] = structuredClone(defaultSettings);
    }

    for (const key of Object.keys(defaultSettings)) {
        if (context().extensionSettings[extensionName][key] === undefined) {
            context().extensionSettings[extensionName][key] = defaultSettings[key];
        }
    }

    await loadHTMLSettings();
    setSettings();
    setExtensionButtons();
})();
