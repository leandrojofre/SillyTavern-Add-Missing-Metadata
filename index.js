import {extension_settings} from "../../../extensions.js";
import {saveSettingsDebounced, chat, is_send_press, deactivateSendButtons, activateSendButtons, saveChatDebounced, reloadCurrentChat} from "../../../../script.js";
import {getTokenCountAsync} from "../../../tokenizers.js";

// * Extension variables

const extensionName = "SillyTavern-Add-Missing-Metadata";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {
    enabled: true,
    debug: false
};

const context = () => SillyTavern.getContext();

// * Debugs methods

const log = (...msg) => {
    if (!extensionSettings.enabled || !extensionSettings.debug) return;
    console.log("[" + extensionName + "]", ...msg);
};

// * Extension methods

async function addTokenCount() {
    if (!extensionSettings.enabled) return;

    // @ts-ignore
    if (context().chatId === undefined) return toastr.error("No chat is active");
    // @ts-ignore
    if (is_send_press) return toastr.error("Generating message, try again when generation finishes");

    deactivateSendButtons();
    log("addTokenCount/chat", chat)

    for (const mess of chat) {
        if (!mess["extra"] && mess["extra"]["token_count"] !== undefined) continue;

        const currentTokenCount = await getTokenCountAsync(String(mess["mes"]));
        mess["extra"]["token_count"] = Number(currentTokenCount);
    }

    saveChatDebounced();
    activateSendButtons();
    // @ts-ignore
    toastr.success("token_count added to all messages in the current chat");
}

function setExtensionButtons() {
    $('#add-miss-meta-token-count').on("click", addTokenCount);
}

// * Methods in charge of controlling the extension settings

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
    const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);

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
