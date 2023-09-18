/**
 * When rendering a chat message sent by this module, give it the "hide" class
 * if the current user doesn't have the required permission level
 */
import {listen} from "./listen/listen.js"
Hooks.on(
    "renderChatMessage",
    (message, html) => {
        listen(message,html)
    }
);

