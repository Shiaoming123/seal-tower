// 图鉴: lore for every monster, and characters whose stories open up as your favour with them grows.
// Kept short and in plain words, so the world reads easily.

export const ENEMY_LORE: Record<string, string> = {
  moth: "镇上人家挂的纸灯笼放久了，灯里的蛾子吃了灯油成了精。它们一窝一窝往塔里飞，镇上的灯就一盏盏灭了。",
  rat: "塔底的老鼠，专偷别人的东西。它不吃货，只是喜欢囤着，所以赶在它钻洞前打死它，被抢的货多半还是好的。",
  louse: "书院的旧书被搬进塔里封存，书虫吃了墨，长成了这副样子。它的壳是上好的刻印料。",
  "mirror-fox": "在镜子里修炼的狐妖，和绯绡同族。颈下的铜扣是它们的身份牌，碎了就不值钱了。",
  "moth-queen": "所有纸灯蛾的娘。她占了照影廊最亮的那盏灯，谁去抢灯芯她就烧谁。",
  warden: "桥驿的看门狐。镇上的老人说它原本是守桥的，后来被塔里的妖气染黑了，脾气越拖越坏。",
  "night-fox": "桥驿夜市的主人，和绯绡是对头。她做的是抢来的买卖，摊子底下藏着九条尾巴。",
  bell: "镇塔钟里的钟灵，本来每夜敲钟镇妖。钟被妖气蛀空以后，它反过来占了整座塔。",
  "lantern-spirit": "给走夜路的人引路的灯笼。没了主人以后，它开始吸别人的灯油，好让自己一直亮着。",
  "paper-doll": "纸扎铺给死人扎的童子，夜里自己走进了塔。它怕火，可身上的红纸是扎灯笼的好料。",
  "fire-rat": "灯鼠里吃了太多灯灰的那几只，背上冒火星，见灰就啃。",
  "ink-moth": "纸灯蛾飞进了书院的砚台，从此只吃墨。被它糊了眼的人，一时半会儿看不清手里的牌。",
  "water-ghost": "桥驿下淹死的船工。它潜在水里等你松懈，再一下扑出来。",
  "stele-spirit": "塔里记事的石碑，被妖气泡久了活了过来。碑上刻着这座塔的来历，书院先生一直想拓下来。",
  fallen: "和你一样进塔斩妖的同行，在塔里待得太久，被妖气侵了心。他的剑法你认得，是同一个门派教的。",
  "thorn-stele": "荆棘长进了碑缝，把石碑变成了一只刺猬。打它的人都会被扎，所以要么不打，要打就一下打碎。",
  "bronze-puppet": "当年铸镇塔钟的匠人留下的看守。铜身太硬，刀砍上去只能留个白印。",
  "night-owl": "住在钟楼梁上的大鸟，怕光。灯越亮，它越不敢下来。",
  "fake-fox": "冒充绯绡做生意的白狐。它卖的东西有一半是树叶变的，收的钱却都是真的。",
  "paper-matron": "纸扎铺的老板娘，一辈子给别人扎纸人。死后被自己扎的纸人抬进了塔，还在这里接着开铺子。",
  "fallen-elder": "三十年前带队进塔的斩妖首座。他的队伍一个都没出来——原来都在这里，跟着他守塔。",
};

export interface CharacterDef {
  id: string;
  name: string;
  portrait: string;
  /** Favour key (an order id) that opens more of their story; null = always fully known once met. */
  favorKey: string | null;
  /** Lines open up at the given favour level. */
  lines: { need: number; text: string }[];
}

export const CHARACTERS: CharacterDef[] = [
  { id: "feixiao", name: "绯绡", portrait: "feixiao", favorKey: "clasp", lines: [
    { need: 0, text: "塔里唯一的狐市老板。她说做生意不分人妖，只看货。" },
    { need: 2, text: "她其实是镜狐一族的，为了离开族里才来塔里开铺子。她只收完整的狐扣——每一枚都刻着一个族人的名字。" },
    { need: 4, text: "她在等一个人。三十年前，有位斩妖首座答应过，出塔时回来买她的货。" },
  ] },
  { id: "lamp", name: "灯匠老周", portrait: "guide", favorKey: "lamp", lines: [
    { need: 0, text: "镇上修了四十年灯的老匠人，脾气倔，手很稳。" },
    { need: 2, text: "他年轻时也进过塔，在照影廊丢了一只眼睛，从此只修灯，不斩妖。" },
    { need: 4, text: "他说塔里最早的那盏灯是他亲手点的。灯灭了，塔里的妖才多起来。" },
  ] },
  { id: "herbs", name: "药铺阿蘅", portrait: "broker", favorKey: "herbs", lines: [
    { need: 0, text: "镇上药铺的掌柜，说话快，算账更快。" },
    { need: 2, text: "她配的夜咳药是给镇上孩子的。妖气顺着灯灭的街道飘下来，孩子们最先咳。" },
    { need: 4, text: "她把药价压得很低，亏的部分全靠你带回来的货补上。她从没跟你说过。" },
  ] },
  { id: "scholar", name: "书院先生", portrait: "guide", favorKey: "scholar", lines: [
    { need: 0, text: "在编一部塔志的老先生，眼神不好，记性很好。" },
    { need: 2, text: "碑上的字说，这座塔原本不是用来关妖的，是用来点灯的。" },
    { need: 4, text: "他拓下的最后一张碑文上，刻着三十年前那支进塔队伍的名字。最后一个名字被刮掉了。" },
  ] },
  { id: "mayor", name: "镇长", portrait: "hero", favorKey: "bell", lines: [
    { need: 0, text: "一心想让镇塔钟重新响起来的镇长。" },
    { need: 2, text: "镇塔钟每夜敲一次，妖就退一次。钟哑了以后，镇上的灯油就开始一夜一夜少下去。" },
    { need: 4, text: "他是三十年前那支队伍里唯一活着出来的人。碑文上被刮掉的，正是他的名字。" },
  ] },
  { id: "guide", name: "歇脚的道友", portrait: "guide", favorKey: null, lines: [
    { need: 0, text: "在塔里走了很多年的老道友，什么都知道一点，什么都不肯多说。好像在等谁。" },
  ] },
  { id: "broker", name: "血客", portrait: "broker", favorKey: null, lines: [
    { need: 0, text: "戴着面具做气血买卖的人。没人见过他的脸，也没人知道他买那么多血做什么。" },
  ] },
];
