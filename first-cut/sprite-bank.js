/* Source builds load the WebPs. The offline build embeds the same bytes into the source table. */
window.TowerSprites=(()=>{
  "use strict";
  const assets=/* sprite sources */ {
    "seal-purse":"sprites/seal-purse.webp","seal-purse-tied":"sprites/seal-purse-tied.webp","stele-thorn":"sprites/stele-thorn.webp","stele-ink":"sprites/stele-ink.webp",
    "sign-turn":"sprites/sign-turn.webp","sign-brace":"sprites/sign-brace.webp","barrier-post":"sprites/barrier-post.webp",
    "obstacle-water":"sprites/obstacle-water.webp","obstacle-rock":"sprites/obstacle-rock.webp","obstacle-plank":"sprites/obstacle-plank.webp","obstacle-ruin":"sprites/obstacle-ruin.webp",
    "escort-road":"sprites/escort-road.webp","escort-road-2":"sprites/escort-road-2.webp","escort-road-3":"sprites/escort-road-3.webp","escort-road-4":"sprites/escort-road-4.webp","escort-cart":"sprites/escort-cart.webp",
    "merch-abacus":"sprites/merch-abacus.webp","merch-ash":"sprites/merch-ash.webp","merch-silk":"sprites/merch-silk.webp","merch-lining":"sprites/merch-lining.webp",
    "book-louse":"sprites/book-louse.webp","merch-hook":"sprites/merch-hook.webp","merch-ward-blade":"sprites/merch-ward-blade.webp","merch-knot":"sprites/merch-knot.webp","fox-pin":"sprites/fox-pin.webp","trade-cloth":"sprites/trade-cloth.webp",
    "merch-ink-shell":"sprites/merch-ink-shell.webp","merch-fox-clasp":"sprites/merch-fox-clasp.webp","merch-bell":"sprites/merch-bell.webp","merch-sword":"sprites/merch-sword.webp",
    "merch-order-purse":"sprites/merch-order-purse.webp","merch-order-hook":"sprites/merch-order-hook.webp",
    "blood-broker":"sprites/blood-broker.webp","merch-salve":"sprites/merch-salve.webp","merch-mirror":"sprites/merch-mirror.webp","merch-fang":"sprites/merch-fang.webp",
    "hero-ready":"sprites/hero-ready.webp","hero-thrust":"sprites/hero-thrust.webp","hero-recover":"sprites/hero-recover.webp",
    "crawl-fox":"sprites/crawl-fox.webp","crawl-moth":"sprites/crawl-moth.webp","crawl-rat":"sprites/crawl-rat.webp","crawl-rat-swipe":"sprites/crawl-rat-swipe.webp","bridge-bluestone":"sprites/bridge-bluestone.webp",
    "moth":"sprites/moth.webp","lamp-seal":"sprites/lamp-seal.webp","warden":"sprites/warden.webp","fox-offer":"sprites/fox-offer-hands.webp",
    "fox-counter":"sprites/fox-counter-hands.webp","fox-fold":"sprites/fox-fold-hands.webp","fox-return":"sprites/fox-return-hands.webp","fox-settle":"sprites/fox-settle-hands.webp","guide-oracle":"sprites/guide-oracle.webp","gate":"sprites/gate.webp",
    "hall":"sprites/hall.webp","shop-wall":"sprites/shop-wall.webp","grit":"sprites/grit.webp","last-market":"sprites/last-market.webp","counter":"sprites/counter.webp"
  } /* end sprite sources */;
  const images=new Map();
  const ready=Promise.all(Object.entries(assets).map(async ([name,url])=>{
    const img=new Image();img.src=url;await img.decode();images.set(name,img);
  }));
  // The game subscribes after all deferred renderer scripts have been evaluated.
  ready.catch(()=>{});
  return {ready,get:name=>images.get(name)};
})();
