// 签文: every floor draws one omen that bends its rules. Same maze, different decisions.

export interface OmenDef {
  id: string;
  name: string;
  /** What changes, in plain words. */
  text: string;
  /** Short flavour line shown above the rules. */
  verse: string;
  weight: number;
}

export const OMENS: OmenDef[] = [
  { id: "calm", name: "太平", weight: 2, verse: "签上只写了两个字：无事。", text: "这一层没有特别的事。" },
  { id: "rain", name: "雨夜", weight: 3, verse: "塔里漏雨，灯芯受潮。", text: "每走 3 步多烧 1 点灯油。雨里货俏：狐市收货每件多给 1 石。" },
  { id: "market", name: "集市日", weight: 3, verse: "绯绡把摊子摆得比平时大。", text: "狐市的东西打七五折，收货价多两成五。" },
  { id: "horde", name: "妖潮", weight: 3, verse: "楼下的妖都挤上来了。", text: "普通妖血量 +15%，但每只多掉一件货。" },
  { id: "moon", name: "月明", weight: 2, verse: "月光从窗格里照进来，整层看得清清楚楚。", text: "整层地图一开始就亮着。妖也看得见你：普通妖每下多打 1 点。" },
  { id: "fog", name: "迷雾", weight: 2, verse: "雾大得看不见三步外。", text: "小地图只记得你走过的地方。妖在雾里落单：每场战斗多得 6 石。" },
  { id: "festival", name: "灯会", weight: 2, verse: "镇上在过灯节，塔里也挂上了灯。", text: "灯油上限 +20 并添满。灯灰在狐市卖双倍价。" },
  { id: "bloodmoon", name: "血月", weight: 2, verse: "月亮红得像要滴下来。", text: "所有妖每下多打 1 点。取材成功时多拿一份。" },
  { id: "incense", name: "香火旺", weight: 2, verse: "有人在塔里上过香，烟还没散。", text: "每处理完一个事件，回复 5 气血。" },
  { id: "patrol", name: "精英巡夜", weight: 2, verse: "守夜的大妖在巡楼。", text: "精英妖血量 +15%，打倒后多给 20 石。" },
];

export const OMEN = Object.fromEntries(OMENS.map((o) => [o.id, o])) as Record<string, OmenDef>;
