import { getFlag, Updates } from "./utils/utils.js";
// export function hookAttack() {
//   libWrapper.register(
//     "pf2e-consume-workplace",
//     "CONFIG.PF2E.Actor.documentClasses.character.prototype.prepareStrike",
//     function (wrapper, ...args) {
//       const characterStrike = wrapper(...args);
//       console.log("characterStrike");
//       console.log(characterStrike.variants);
//       console.log(characterStrike.variants[0].roll());
//       console.log(characterStrike);
//       return characterStrike;
//     },
//     "MIXED"
//   );
// }
// export function hookAttacks() {
//   libWrapper.register(
//     "pf2e-consume-workplace",
//     "CONFIG.PF2E.Actor.documentClasses.character.prototype.prepareStrikes",
//     function (wrapper, ...args) {
//       const characterStrikes = wrapper(...args);
//       console.log("characterStrikes");
//       console.log(characterStrikes);

//       return characterStrikes;
//     },
//     "MIXED"
//   );
// }
export function hookPrepareDerivedData() {
  libWrapper.register(
    "pf2e-consume-workplace",
    'CONFIG.Actor.sheetClasses.character["pf2e.CharacterSheetPF2e"].cls.prototype._render',

    async function (wrapper, ...args) {
      console.log(...args);
      console.log(new Date().getSeconds());
      //遍历武器
      const actions = this.actor.system.actions;
      console.log(actions);
      for (let action of actions) {
        for (let trait of action.item.system.traits.value) {
          if (trait.includes("hb_area")) {
            action.variants[3] = { label: "区域射击" };
            const rules = action.item.rules;
            const distance = action.item.system.range;
            let tehcValue = 0;
            for (let rule of rules) {
              if (rule.label == "Tracking") tehcValue = rule.value;
            }
            action.variants[3].action = 2;
            const fireMan = this.actor;
            action.variants[3].roll = () => {
           if (!action.ammunition.selected){
            const chatData = {
              speaker: ChatMessage.getSpeaker({ fireMan }),
              type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            };
            chatData.content = "弹药不足,请装弹";
            ChatMessage.create(chatData);
           }
           
              for (let ammo of action.ammunition.compatible)
                if (ammo._id == action.ammunition.selected.id) {
                  const chatData = {
                    speaker: ChatMessage.getSpeaker({ fireMan }),
                    flags: {
                      pf2e: { origin: ammo.getOriginData() },
                    },
                    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                  };
                  chatData.content =
                    '<div class="pf2e chat-card action-card" data-actor-id="' +
                    fireMan._id +
                    '"' +
                    ' data-item-id="' +
                    ammo._id +
                    '">' +
                    '<header class="card-header flexrow">' +
                    '<img src="systems/pf2e/icons/actions/TwoActions.webp" title="Automatic Fire" width="36" height="36" />' +
                    "  <h3>区域射击Area Fire </h3>" +
                    " </header>" +
                    ' <div class="tags paizo-style">' +
                    '           <span class="tag" data-trait data-description="PF2E.TraitDescriptionAttack">攻击</span>' +
                    "</div>" +
                    '<div class="card-content">' +
                    "   <p>你瞄准指定区域内的每个目标，该区域为武器的射程增量（对于锥形或线形）或指定爆炸的爆发范围（对于爆发）";
                  if (trait == "hb_area-cone")
                  {
                    chatData.content +=
                    "@Template[type:cone|distance:" + distance + "]";
                  }
                    else{
                      chatData.content +="对于爆发，你能将其中心放置在第一个射程增量内。"+
                      "@Template[type:burst|distance:" + 10 + "]";
                    }
                  chatData.content +=
                    " 区域内的所有生物都必须通过基础反射豁免，DC为你的职业DC+你武器的追踪值（tracking value） @Check[type:reflex|dc:resolve(@actor.system.attributes.classDC.value+" +
                    tehcValue +
                    ")|basic:true] . 你不必进行攻击骰。该伤害为区域伤害。豁免大失败的生物都会承受武器重击的附带效果，包括武器的重击专精效果。</p>" +
                    "  </div>" +
                    "</div>" +
                    // '<button type="button" class="success" data-action="strike-damage">伤害 </button>'+
                    // '<button type="button" class="critical-success" data-action="strike-critical">重击 </button>'+
                    '<button data-action="useSingleAmmo">使用弹药</button>';
                  ChatMessage.create(chatData);
                }
            };
          }
          if (trait == "hb_automatic") {
            action.variants[3] = { label: "自动射击" };
            const rules = action.item.rules;
            const distance = action.item.system.range / 2;
            let tehcValue = 0;
            for (let rule of rules) {
              if (rule.label == "Tracking") tehcValue = rule.value;
            }
            action.variants[3].action = 2;
            const fireMan = this.actor;
            action.variants[3].roll = () => {
              //console.log(this.actor.system.actions[0])
              if (!action.ammunition.selected){
                const chatData = {
                  speaker: ChatMessage.getSpeaker({ fireMan }),
                  type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                };
                chatData.content = "弹药不足,请装弹";
                ChatMessage.create(chatData);
               }
              for (let ammo of action.ammunition.compatible)
                if (ammo._id == action.ammunition.selected.id) {
                  const chatData = {
                    speaker: ChatMessage.getSpeaker({ fireMan }),
                    flags: {
                      pf2e: { origin: ammo.getOriginData() },
                    },
                    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                  };
                  chatData.content =
                    '<div class="pf2e chat-card action-card" data-actor-id="' +
                    fireMan._id +
                    '"' +
                    ' data-item-id="' +
                    ammo._id +
                    '">' +
                    '<header class="card-header flexrow">' +
                    '<img src="systems/pf2e/icons/actions/TwoActions.webp" title="Automatic Fire" width="36" height="36" />' +
                    "  <h3>自动射击 Automatic Fire</h3>" +
                    " </header>" +
                    ' <div class="tags paizo-style">' +
                    '           <span class="tag" data-trait data-description="PF2E.TraitDescriptionAttack">攻击</span>' +
                    "</div>" +
                    '<div class="card-content">' +
                    "   <p>你攻击锥形区域内的每个敌人，锥形的射程等于你武器射程增量的一半。";
                  chatData.content +=
                    "@Template[type:cone|distance:" + distance + "]";
                  chatData.content +=
                    "区域内的所有生物都必须通过基础反射豁免，DC为你的职业DC+你武器的追踪值 @Check[type:reflex|dc:resolve(@actor.system.attributes.classDC.value+" +
                    tehcValue +
                    ")|basic:true]  你不必进行攻击骰。该伤害为区域伤害。豁免大失败的生物都会承受武器重击的附带效果，包括武器的重击专精效果。自动射击会耗用武器最大弹容一半的弹药。  </p>" +
                    "  </div>" +
                    "</div>" +
                    // '<button type="button" class="success" data-action="strike-damage">伤害 </button>'+
                    // '<button type="button" class="critical-success" data-action="strike-critical">重击 </button>'+
                    '<button data-action="useHalfAmmo">使用弹药</button>';
                  ChatMessage.create(chatData);
                }
            };
          }
        }
      }

      const result = await wrapper(...args);

      // const updates = [{ _id: this.actor._id, name: "thoms" }];
      // const updated = await Actor.updateDocuments(updates);

      console.log(...args);
      console.log(this);
      console.log(new Date().getSeconds());
      return result;
    },
    "MIXED"
  );
}
