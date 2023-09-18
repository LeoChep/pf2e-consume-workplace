import { getFlag, Updates } from "./utils/utils.js";
import { transformWeapon } from "./utils/weapon-utils.js";
import {hookPrepareDerivedData} from "./fire-weapon-attack-hook.js";
Hooks.once('tokenActionHudCoreApiReady', async (coreModule)=>{
  console.log(coreModule)
})
Hooks.on("ready", () => {
  // alert("hello,load it!");

  hookPrepareDerivedData();
  /**
   * Override the system function of consuming ammunition so we can handle it ourselves
   */
  libWrapper.register(
    "pf2e-consume-workplace",
    "CONFIG.PF2E.Actor.documentClasses.character.prototype.consumeAmmo",
    function () {
      return true;
    },
    "OVERRIDE"
  );
    /**
   * consuming ammunition   */
    libWrapper.register(
        "pf2e-consume-workplace",
        "CONFIG.PF2E.Item.documentClasses.consumable.prototype.consume",
        async function (wrapper, ...args) {
            console.log(this)
          //
          //判断是否是弹药
          if (!this?.system?.consumableType.value=="ammo")
          {
            return wrapper(...args)
          }
          const actor=this.actor;
          const ammo=this;
          console.log(ammo)
         
          let ammoExtraCost=0;//额外消耗，因为默认会消耗1
          if (ammo?.system?.consume?.value!=undefined&&ammo?.system?.consume.value!="")//为空使用默认值
            ammoExtraCost=parseInt(ammo.system.consume.value)-1;
          if (ammoExtraCost<0)//不需要弹药
            return;
          if (ammo?.system?.charges.value!=undefined){//充能弹药
            const updates = new Updates(this.actor);
            updates.update(ammo, { "system.charges.value": ammo.system.charges.value - ammoExtraCost });
            await updates.handleUpdates()
            return wrapper(...args)
          }else{
            const updates = new Updates(this.actor);
            updates.update(ammo, { "system.quantity":ammo.system.quantity - ammoCost });
            await updates.handleUpdates()
            return wrapper(...args)
          }

        
        },
        "MIXED"
      );
//   /**
//    * Override the system function of determining a weapon's ammunition, so we still consider
//    * an empty stack as selected ammunition
//    */
  libWrapper.register(
    "pf2e-consume-workplace",
    "CONFIG.PF2E.Item.documentClasses.weapon.prototype.ammo",
    function () {
      const ammo = this.actor?.items.get(this.system.selectedAmmoId ?? "");
      return ammo?.type === "consumable" ? ammo : null;
    },
    "OVERRIDE"
  );

  libWrapper.register(
    "pf2e-consume-workplace",
    "game.pf2e.Check.roll",
    async function (wrapper, ...args) {
      const context = args[1];
      const actor = context.actor;
      const contextWeapon = context.item; // Either WeaponPF2e (for a character) or MeleePF2e (for an NPC)
      console.log(args)
      console.log(this)
     
      // If we don't have all the information we need, or this isn't an attack roll,
      // then just call the actual function
      if (!actor || !contextWeapon || context.type !== "attack-roll") {
        return wrapper(...args);
      }

      const weapon = transformWeapon(contextWeapon);
      if (!weapon) {
        return wrapper(...args);
      }

      // Actually make the roll.
      // If for some reason the roll doesn't get made, don't do any of the post-roll stuff
      const roll = await wrapper(...args);
      if (!roll) {
        return;
      }
      //非使用弹药的武器直接骰攻击骰
      if (weapon.usesAmmunition) {
        //需要弹药的武器弹出弹药消息
        const ammo=  weapon.ammunition
        // weapon.ammunition.toMessage();
        // if (!weapon.isRepeating)//不是连发要额外发送一个消耗弹药的按钮
        {
            const chatData = {
                speaker: ChatMessage.getSpeaker({ actor }),
                flags: {
                    pf2e: { origin:  ammo.getOriginData() },
                },
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            };
            chatData.content='<button data-action="useSingleAmmo">使用弹药</button>'
            ChatMessage.create(chatData) 
        }
      }
      const updates = new Updates(actor);
      // Run the various handlers for the weapon being used
      await updates.handleUpdates();
      return roll;
    },
    "MIXED"
  );
});
