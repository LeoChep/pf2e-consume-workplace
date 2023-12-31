import { ActorPF2e } from "@actor";
import { craftItem, craftSpellConsumable } from "@actor/character/crafting/helpers.ts";
import { ElementalBlast } from "@actor/character/elemental-blast.ts";
import { SAVE_TYPES } from "@actor/values.ts";
import { ItemPF2e, PhysicalItemPF2e } from "@item";
import { isSpellConsumable } from "@item/consumable/spell-consumables.ts";
import { CoinsPF2e } from "@item/physical/helpers.ts";
import { elementTraits } from "@scripts/config/traits.ts";
import { eventToRollParams } from "@scripts/sheet-util.ts";
import { onRepairChatCardEvent } from "@system/action-macros/crafting/repair.ts";
import { CheckRoll } from "@system/check/index.ts";
import {
    ErrorPF2e,
    createHTMLElement,
    htmlClosest,
    htmlQuery,
    htmlQueryAll,
    objectHasKey,
    sluggify,
    tupleHasValue,
} from "@util";
import { ChatMessagePF2e } from "../index.ts";

class ChatCards {
    static #lastClick = 0;

    static listen(message, html) {
        const selector = ["a[data-action], button[data-action]"].join(",");
        for (const button of htmlQueryAll<HTMLButtonElement>(html, selector)) {
            button.addEventListener("click", async (event) => this.#onClickButton({ message, event, html, button }));
        }
    }

    static async #onClickButton({ message, event, html, button }) {
        const currentTime = Date.now();
        if (currentTime - this.#lastClick < 500) {
            return;
        }
        this.#lastClick = currentTime;

        // Extract card data
        const action = button.dataset.action;

        // Get the actor and item from the chat message
        const item = message.item;
        const actor = item?.actor ?? message.actor;
        if (!actor) return;

        // Confirm roll permission
        if (!game.user.isGM && !actor.isOwner && action !== "spell-save") return;

 
        // Handle everything else
        if (item) {
            const spell = item.isOfType("spell") ? item : item.isOfType("consumable") ? item.embeddedSpell : null;

            // Spell actions
            switch (action) {
                case "consume": {
                    // Consumable usage
                    if (item.isOfType("consumable")) {
                        item.consume();
                    } else if (item.isOfType("melee")) {
                        // Button is from an NPC attack effect
                        const consumable = actor.items.get(button.dataset.item ?? "");
                        if (consumable?.isOfType("consumable")) {
                            const oldQuant = consumable.quantity;
                            const consumableString = game.i18n.localize("TYPES.Item.consumable");
                            const toReplace = `${consumable.name} - ${consumableString} (${oldQuant})`;
                            await consumable.consume();
                            const currentQuant = oldQuant === 1 ? 0 : consumable.quantity;
                            let flavor = message.flavor.replace(
                                toReplace,
                                `${consumable.name} - ${consumableString} (${currentQuant})`
                            );
                            if (currentQuant === 0) {
                                const buttonStr = `>${game.i18n.localize("PF2E.ConsumableUseLabel")}</button>`;
                                flavor = flavor?.replace(buttonStr, " disabled" + buttonStr);
                            }
                            await message.update({ flavor });
                            message.render(true);
                        }
                    }
                    return;
                }
                case "expand-description": {
                    const { description } = item;
                    const element = htmlClosest(button, ".description");
                    if (element) {
                        element.innerHTML = await TextEditor.enrichHTML(description, {
                            async: true,
                            rollData: actor.getRollData(),
                        });
                        element.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                    break;
                }
                case "apply-effect": {
                    button.disabled = true;
                    const target = fromUuidSync(button.dataset.targets ?? "");
                    const effect =
                        item.isOfType("action", "feat") && item.system.selfEffect
                            ? await fromUuid(item.system.selfEffect.uuid)
                            : null;
                    if (target instanceof ActorPF2e && effect instanceof ItemPF2e && effect.isOfType("effect")) {
                        await target.createEmbeddedDocuments("Item", [effect.clone().toObject()]);
                        const parsedMessageContent = ((): HTMLElement => {
                            const container = document.createElement("div");
                            container.innerHTML = message.content;
                            return container;
                        })();

                        // Replace the "Apply Effect" button with a success notice
                        const buttons = htmlQuery(parsedMessageContent, ".message-buttons");
                        if (buttons) {
                            const span = createHTMLElement("span", { classes: ["effect-applied"] });
                            const anchor = effect.toAnchor({ attrs: { draggable: "true" } });
                            const locKey = "PF2E.Item.Action.SelfAppliedEffect.Applied";
                            const statement = game.i18n.format(locKey, { effect: anchor.outerHTML });
                            span.innerHTML = statement;
                            buttons.replaceChildren(span);
                            await message.update({ content: parsedMessageContent.innerHTML });
                        }
                    }
                    break;
                }
                case "elemental-blast-damage": {
                    if (!actor.isOfType("character")) return;
                    const roll = message.rolls.find(
                        (r): r is Rolled<CheckRoll> => r instanceof CheckRoll && r.action === "elemental-blast"
                    );
                    const outcome = button.dataset.outcome === "success" ? "success" : "criticalSuccess";
                    const [element, damageType, meleeOrRanged, actionCost]: (string | undefined)[] =
                        roll?.options.identifier?.split(".") ?? [];
                    if (objectHasKey(elementTraits, element) && objectHasKey(CONFIG.PF2E.damageTypes, damageType)) {
                        await new ElementalBlast(actor).damage({
                            element,
                            damageType,
                            melee: meleeOrRanged === "melee",
                            actionCost: Number(actionCost) || 1,
                            outcome,
                            event,
                        });
                    }
                }
            }
        } else if (action && actor.isOfType("character", "npc")) {
            const buttonGroup = htmlClosest(button, ".chat-card, .message-buttons");
            const physicalItem = await (async (): Promise<PhysicalItemPF2e | null> => {
                const itemUuid = buttonGroup?.dataset.itemUuid ?? "";
                const maybeItem = await fromUuid(itemUuid);
                return maybeItem instanceof PhysicalItemPF2e ? maybeItem : null;
            })();
            const quantity = Number(buttonGroup?.dataset.craftingQuantity) || 1;

            if (action === "repair-item" && buttonGroup) {
                await onRepairChatCardEvent(event, message, buttonGroup);
            } else if (physicalItem && action === "pay-crafting-costs") {
                const quantity = Number(buttonGroup?.dataset.craftingQuantity) || 1;
                const craftingCost = CoinsPF2e.fromPrice(physicalItem.price, quantity);
                const coinsToRemove = button.classList.contains("full") ? craftingCost : craftingCost.scale(0.5);
                if (!(await actor.inventory.removeCoins(coinsToRemove))) {
                    ui.notifications.warn(game.i18n.localize("PF2E.Actions.Craft.Warning.InsufficientCoins"));
                    return;
                }

                if (isSpellConsumable(physicalItem.id) && physicalItem.isOfType("consumable")) {
                    craftSpellConsumable(physicalItem, quantity, actor);
                    ChatMessagePF2e.create({
                        user: game.user.id,
                        content: game.i18n.format("PF2E.Actions.Craft.Information.PayAndReceive", {
                            actorName: actor.name,
                            cost: coinsToRemove.toString(),
                            quantity: quantity,
                            itemName: physicalItem.name,
                        }),
                        speaker: { alias: actor.name },
                    });
                    return;
                }

                const itemObject = physicalItem.toObject();
                itemObject.system.quantity = quantity;

                const result = await actor.addToInventory(itemObject, undefined);
                if (!result) {
                    ui.notifications.warn(game.i18n.localize("PF2E.Actions.Craft.Warning.CantAddItem"));
                    return;
                }

                ChatMessagePF2e.create({
                    user: game.user.id,
                    content: game.i18n.format("PF2E.Actions.Craft.Information.LoseMaterials", {
                        actorName: actor.name,
                        cost: coinsToRemove.toString(),
                        quantity: quantity,
                        itemName: physicalItem.name,
                    }),
                    speaker: { alias: actor.name },
                });
            } else if (physicalItem && action === "lose-materials") {
                const craftingCost = CoinsPF2e.fromPrice(physicalItem.price, quantity);
                const materialCosts = craftingCost.scale(0.5);
                const coinsToRemove = materialCosts.scale(0.1);
                if (!(await actor.inventory.removeCoins(coinsToRemove))) {
                    ui.notifications.warn(game.i18n.localize("PF2E.Actions.Craft.Warning.InsufficientCoins"));
                } else {
                    ChatMessagePF2e.create({
                        user: game.user.id,
                        content: game.i18n.format("PF2E.Actions.Craft.Information.PayAndReceive", {
                            actorName: actor.name,
                            cost: coinsToRemove.toString(),
                        }),
                        speaker: { alias: actor.name },
                    });
                }
            } else if (action === "receieve-crafting-item" && physicalItem) {
                if (isSpellConsumable(physicalItem.id) && physicalItem.isOfType("consumable")) {
                    return craftSpellConsumable(physicalItem, quantity, actor);
                } else {
                    return craftItem(physicalItem, quantity, actor);
                }
            }
        }
    }

    /**
     * Apply rolled dice damage to the token or tokens which are currently controlled.
     * This allows for damage to be scaled by a multiplier to account for healing, critical hits, or resistance
     */
    static async #rollActorSaves({ event, button, actor, item }: RollActorSavesParams): Promise<void> {
        if (canvas.tokens.controlled.length > 0) {
            const saveType = button.dataset.save;
            if (!tupleHasValue(SAVE_TYPES, saveType)) {
                throw ErrorPF2e(`"${saveType}" is not a recognized save type`);
            }

            const dc = Number(button.dataset.dc ?? "NaN");
            for (const token of canvas.tokens.controlled) {
                const save = token.actor?.saves?.[saveType];
                if (!save) return;

                save.check.roll({
                    ...eventToRollParams(event),
                    dc: Number.isInteger(dc) ? { value: Number(dc) } : null,
                    item,
                    origin: actor,
                });
            }
        } else {
            ui.notifications.error(game.i18n.localize("PF2E.UI.errorTargetToken"));
        }
    }
}

export { ChatCards };