import { getFlag, Updates } from "../utils/utils.js";
export function htmlQueryAll(parent, selectors) {
  console.log(parent);
  return Array.from(parent[0].children[1].querySelectorAll(selectors));
}
export async function onClickButton(input) {
  console.log(input);
  const message = input.message;
  const button = input.button;
  const item = message.item;
  const actor = item?.actor ?? message.actor;
  const action = button.dataset.action;

  if (action == "useSingleAmmo") {
    const ammo = item;
    console.log(item);
    console.log("UPDATA START");
    let oneShot=1
    if (ammo?.system?.consume?.value != "" && ammo?.system?.consume?.value != undefined)
    oneShot = parseInt(ammo?.system?.consume?.value); //一发消耗
    if (ammo?.system?.charges?.max!=0)//充能武器
    {
      if (ammo?.system?.charges?.value >=oneShot){//充能型攻击
        ammo.consume();
      }else{
        const chatData = {
          speaker: ChatMessage.getSpeaker({ actor }),
          type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        };
        chatData.content = "弹药不足,请装弹";
        ChatMessage.create(chatData);
      }
    }
    else{
      if (ammo?.system?.quantity >=oneShot){//非充能攻击
        ammo.consume();
      }else{
        const chatData = {
          speaker: ChatMessage.getSpeaker({ actor }),
          type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        };
        chatData.content = "弹药不足,请装弹";
        ChatMessage.create(chatData);
      }
    }

    
   
  }
  if (action == "useHalfAmmo") {
    const ammo = item;
    console.log(item);
    console.log("UPDATA START");
    if (ammo?.system?.charges.value != undefined) {
      //充能弹药
      const updates = new Updates(actor);
      let ammoExtraCost = ammo.system.charges.max / 2;

      if (ammo?.system?.charges?.value >= ammo.system.charges.max / 2) {
        updates.update(ammo, {
          "system.charges.value": ammo.system.charges.value - ammoExtraCost,
        });
        await updates.handleUpdates();
        // console.log(ammo);
        if (ammo.system.charges.value <= 0) {
          let oneShot = 0;
          if (ammo?.system?.consume != "" && ammo?.system?.consume?.value != undefined)
            oneShot = parseInt(ammo?.system?.consume?.value); //让枪最后开一发
          // updates.update(ammo, { "system.charges.value": oneShot });
          // await updates.handleUpdates();
          ammo.consume();
        }
        return wrapper(...args);
      } else {
        const chatData = {
          speaker: ChatMessage.getSpeaker({ actor }),
          flags: {
            pf2e: { origin: ammo.getOriginData() },
          },
          type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        };
        chatData.content = "弹药不足一半";
        ChatMessage.create(chatData);
      }
    }
  }
}
function createButton(input) {
  const message = input.message;

  const item = message.item;
  const actor = item?.actor ?? message.actor;
  const html = input.html[0].children[1];
  // if (item.system.slug==='area-fire'&&message.type==0)
  //   {//创建按钮
  //     const content=html
  //     const button =document.createElement('button')
  //     button.innerText='开火'
  //     content.append(button)

  //   }
}
export function listen(message, html) {
  console.log("listen");
  console.log(message);
  // createButton({ message, event, html })
  const selector = ["a[data-action], button[data-action]"].join(",");
  const htmlq = htmlQueryAll(html, selector);
  for (const button of htmlq) {
    button.addEventListener("click", async (event) =>
      onClickButton({ message, event, html, button })
    );
  }
}
