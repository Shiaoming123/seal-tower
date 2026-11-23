import type { GoodId } from "../game/types";

export interface OrderDef {
  id: string;
  client: string;
  portrait: string;
  title: string;
  /** Why they want it — one or two plain sentences. */
  story: string;
  needs: Partial<Record<GoodId, number>>;
  /** Boss orders are handed in automatically when you come home with the goods. */
  onReturn?: boolean;
  reward: { gold?: number; relic?: "rare"; salve?: number; removeCard?: boolean };
  renown: number;
  rewardText: string;
  hint: string;
  /** Once you've done this client's order before, they treat you as a regular. */
  regular: { gift: GoodId[]; relic?: string; bonusGold?: number; text: string };
}

export const ORDERS: Record<string, OrderDef> = {
  lamp: {
    id: "lamp", client: "灯匠老周", portrait: "guide", title: "四份灯灰",
    story: "镇上的路灯一盏盏灭了，灯油全被塔里的妖偷吃。老周要灯灰补灯。",
    needs: { ash: 4 }, reward: { gold: 30 }, renown: 1, rewardText: "30 石",
    hint: "纸灯蛾必掉灯灰。灯灰也能在战斗里烧掉换伤害、烧来照路——留着交单还是现在用，你自己算。",
    regular: { gift: ["ash", "ash"], bonusGold: 15, text: "老主顾：先送你 2 份灯灰，酬劳多 15 石" },
  },
  clasp: {
    id: "clasp", client: "绯绡", portrait: "feixiao", title: "一枚完整狐扣",
    story: "绯绡在塔里开狐市，她要一枚没裂的狐扣去换一位老主顾的人情。",
    needs: { clasp: 1 }, reward: { relic: "rare" }, renown: 2, rewardText: "一件稀有法宝",
    hint: "镜狐和夜市狐颈下有扣。单次伤害太高会把扣打碎，用多段小伤害收尾。",
    regular: { gift: [], relic: "pin", text: "老主顾：绯绡把狐扣针借给你（她的货打八折）" },
  },
  herbs: {
    id: "herbs", client: "药铺阿蘅", portrait: "broker", title: "鼠牙与蛾丝",
    story: "阿蘅要配治夜咳的药：两枚鼠牙磨粉，一卷蛾丝做药引。",
    needs: { fang: 2, silk: 1 }, reward: { gold: 15, salve: 2 }, renown: 1, rewardText: "15 石和两瓶金疮药",
    hint: "灯鼠掉鼠牙，纸灯蛾掉蛾丝。鼠会抢货，记得护住。",
    regular: { gift: ["salve"], bonusGold: 5, text: "老主顾：先送一瓶金疮药，酬劳多 5 石" },
  },
  bell: {
    id: "bell", client: "镇长", portrait: "hero", title: "负钟君的钟铜",
    story: "塔顶的镇塔钟被钟妖占了。镇长要你打下它，带回钟铜重铸大钟。",
    needs: { copper: 1 }, onReturn: true, reward: {}, renown: 3, rewardText: "声望 +3（回镇结算）",
    hint: "只有打败第三层的负钟君才能拿到。钟铜很占地方，给它留出 2×2 的位置。",
    regular: { gift: ["pill"], text: "老主顾：镇长先给一颗养元丹" },
  },
};
