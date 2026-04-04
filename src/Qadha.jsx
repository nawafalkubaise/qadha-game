import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react";
import { KW } from "./data/kwBank.js";
import { GCC_BANKS, GCC_COUNTRY_IDS } from "./data/gccBanks.js";
import { FALLBACK_AR, FALLBACK_EN } from "./triviaFallbacks.js";
import {
  loadCache,
  saveCache,
  loadSeen,
  saveSeen,
  qHash,
  getCacheCount,
  clearQuestionCachesFromStorage,
} from "./game/questionCache.js";
import { syncContentOverlayFromServer, readCachedOverlayMeta } from "./services/contentApi.js";
import { getRoom, putRoomState } from "./services/roomApi.js";
import OnlineLobby from "./components/OnlineLobby.jsx";
import { useVoiceMesh } from "./hooks/useVoiceMesh.js";
import { useRoomChannel } from "./hooks/useRoomChannel.js";

/* ═══════ AUDIO — مؤثرات قصيرة فقط (بدون موسيقى خلفية) ═══════ */
class SFX {
  constructor() { this.c = null; this.isAr = false; }
  init() { if (this.c) return; try { this.c = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* ignore */ } }
  t(f,s,d,tp="sine",v=0.1) { if(!this.c)return; try { const o=this.c.createOscillator(),g=this.c.createGain(); o.type=tp; o.frequency.setValueAtTime(f,s); g.gain.setValueAtTime(v,s); g.gain.exponentialRampToValueAtTime(0.001,s+d); o.connect(g).connect(this.c.destination); o.start(s); o.stop(s+d); } catch { /* ignore */ } }
  oud(f,s,d=0.4,v=0.05) { this.t(f,s,d,"triangle",v); this.t(f*2,s,d*0.4,"sine",v*0.25); }
  drum(s,v=0.05) { this.t(150,s,0.12,"sine",v); this.t(800,s,0.03,"square",v*0.3); }
  click() { this.t(800,this.c?.currentTime||0,0.05,"sine",0.04); }
  correct() { const n=this.c?.currentTime||0; if(this.isAr){[293.66,369.99,440,587.33].forEach((f,i)=>this.oud(f,n+i*0.12,0.25,0.09))}else{[523,659,784,1047].forEach((f,i)=>this.t(f,n+i*0.1,0.2,"sine",0.11))} }
  wrong() { const n=this.c?.currentTime||0; this.t(250,n,0.3,"sawtooth",0.08); this.t(180,n+0.2,0.4,"sawtooth",0.06); }
  steal() { const n=this.c?.currentTime||0; [700,800,900,1000].forEach((f,i)=>this.t(f,n+i*0.06,0.1,"triangle",0.07)); }
  victory() { const n=this.c?.currentTime||0; if(this.isAr){[293.66,369.99,392,440,523.25,587.33].forEach((f,i)=>{this.oud(f,n+i*0.18,0.35,0.08);if(i%2===0)this.drum(n+i*0.18,0.04)})}else{[523,659,784,1047,1319].forEach((f,i)=>this.t(f,n+i*0.14,0.3,"sine",0.1))} }
  defeat() { const n=this.c?.currentTime||0; [400,350,300,250].forEach((f,i)=>this.t(f,n+i*0.3,0.5,"sawtooth",0.06)); }
  coin() { this.t(1100,this.c?.currentTime||0,0.06,"square",0.05); }
  tick(u) { if(this.isAr)this.drum(this.c?.currentTime||0,u?0.06:0.02); else this.t(u?800:400,this.c?.currentTime||0,0.06,"square",u?0.07:0.03); }
  stop() {}
}
const sfx=new SFX();

/* ═══════ 60 CATEGORIES ═══════ */
const CATS=[
{id:"history",n:"History",ar:"التاريخ",icon:"📜",c:"#A855F7"},
{id:"theater",n:"Theater",ar:"المسرح",icon:"🎭",c:"#F97316"},
{id:"food",n:"Food",ar:"المطبخ",icon:"🥘",c:"#F59E0B"},
{id:"geography",n:"Geography",ar:"الجغرافيا",icon:"🌍",c:"#4ECDC4"},
{id:"landmarks",n:"Landmarks",ar:"المعالم",icon:"🗼",c:"#FB7185"},
{id:"music",n:"Music",ar:"موسيقى",icon:"🎼",c:"#A78BFA"},
{id:"culture",n:"Culture",ar:"الثقافة",icon:"🖼️",c:"#D97706"},
{id:"sports",n:"Sports",ar:"الرياضة",icon:"🏀",c:"#FF6B6B"},
{id:"science",n:"Science",ar:"العلوم",icon:"🔬",c:"#00E5A0"},
{id:"movies",n:"Movies",ar:"سينما",icon:"🎬",c:"#FF8A5C"},
{id:"nature",n:"Nature",ar:"الطبيعة",icon:"🌳",c:"#10B981"},
{id:"art",n:"Art",ar:"الفن",icon:"🎨",c:"#F472B6"},
{id:"politics",n:"Politics",ar:"السياسة",icon:"🏛️",c:"#EF4444"},
{id:"religion",n:"Religion",ar:"الدين",icon:"🕌",c:"#FCD34D"},
{id:"media",n:"Media",ar:"الإعلام",icon:"📰",c:"#8B5CF6"},
{id:"customs",n:"Traditions",ar:"العادات",icon:"☕",c:"#D97706"},
{id:"space",n:"Space",ar:"الفضاء",icon:"🛸",c:"#818CF8"},
{id:"animals",n:"Animals",ar:"الحيوانات",icon:"🐾",c:"#FB923C"},
{id:"fashion",n:"Fashion",ar:"الأزياء",icon:"👠",c:"#E879F9"},
{id:"business",n:"Business",ar:"الأعمال",icon:"💼",c:"#22D3EE"},
{id:"gaming",n:"Games",ar:"ألعاب",icon:"🕹️",c:"#4ADE80"},
{id:"cars",n:"Cars",ar:"السيارات",icon:"🚙",c:"#F43F5E"},
{id:"health",n:"Health",ar:"الصحة",icon:"❤️‍🩹",c:"#22C55E"},
{id:"travel",n:"Travel",ar:"السفر",icon:"🧳",c:"#2DD4BF"},
{id:"brands",n:"Brands",ar:"علامات",icon:"🏷️",c:"#F43F5E"},
{id:"soccer",n:"Football",ar:"كرة القدم",icon:"⚽",c:"#22C55E"},
{id:"maps",n:"Capitals",ar:"عواصم",icon:"🗺️",c:"#2DD4BF"},
{id:"riddles",n:"Riddles",ar:"ألغاز",icon:"❓",c:"#E879F9"},
{id:"chemistry",n:"Chemistry",ar:"الكيمياء",icon:"🧪",c:"#34D399"},
{id:"math",n:"Math",ar:"رياضيات",icon:"🔢",c:"#6366F1"},
{id:"leaders",n:"Leaders",ar:"قادة",icon:"👑",c:"#6366F1"},
{id:"ancient",n:"Ancient",ar:"حضارات",icon:"🗿",c:"#D97706"},
{id:"proverbs",n:"Proverbs",ar:"أمثال",icon:"💬",c:"#A855F7"},
{id:"psychology",n:"Psychology",ar:"علم النفس",icon:"🧠",c:"#C084FC"},
{id:"olympics",n:"Olympics",ar:"أولمبياد",icon:"🏅",c:"#FBBF24"},
{id:"inventions",n:"Inventions",ar:"اختراعات",icon:"💡",c:"#FDE68A"},
{id:"horror",n:"Horror",ar:"رعب",icon:"🧛",c:"#7C3AED"},
{id:"anime",n:"Anime",ar:"أنمي",icon:"🎎",c:"#F9A8D4"},
{id:"architecture",n:"Architecture",ar:"عمارة",icon:"🏙️",c:"#FB7185"},
{id:"ocean",n:"Oceans",ar:"البحار",icon:"🌊",c:"#38BDF8"},
{id:"medicine",n:"Medicine",ar:"الطب",icon:"⚕️",c:"#34D399"},
{id:"social",n:"Social Media",ar:"التواصل",icon:"📲",c:"#3B82F6"},
{id:"law",n:"Law",ar:"القانون",icon:"⚖️",c:"#94A3B8"},
{id:"flags",n:"Flags",ar:"أعلام",icon:"🚩",c:"#F472B6"},
{id:"dance",n:"Dance",ar:"رقص",icon:"🩰",c:"#F9A8D4"},
{id:"mythology",n:"Mythology",ar:"أساطير",icon:"🐉",c:"#FDE047"},
{id:"economics",n:"Economics",ar:"اقتصاد",icon:"📈",c:"#60A5FA"},
{id:"aviation",n:"Aviation",ar:"طيران",icon:"🛫",c:"#38BDF8"},
{id:"literature",n:"Literature",ar:"الأدب",icon:"📖",c:"#EC4899"},
{id:"tech",n:"Technology",ar:"تكنولوجيا",icon:"💻",c:"#3B82F6"},
{id:"currencies",n:"Currencies",ar:"عملات",icon:"🪙",c:"#A3E635"},
{id:"language",n:"Languages",ar:"لغات",icon:"🔤",c:"#A3E635"},
{id:"photography",n:"Photography",ar:"تصوير",icon:"📸",c:"#94A3B8"},
{id:"gems",n:"Gems",ar:"أحجار كريمة",icon:"💎",c:"#67E8F9"},
{id:"weather",n:"Weather",ar:"طقس",icon:"⛅",c:"#67E8F9"},
{id:"dinosaurs",n:"Dinosaurs",ar:"ديناصورات",icon:"🦖",c:"#A3E635"},
{id:"comics",n:"Comics",ar:"كوميكس",icon:"🦸",c:"#FB923C"},
{id:"boardgames",n:"Board Games",ar:"ألعاب طاولة",icon:"🎲",c:"#FBBF24"},
{id:"physics",n:"Physics",ar:"الفيزياء",icon:"⚛️",c:"#60A5FA"},
{id:"biology",n:"Biology",ar:"الأحياء",icon:"🧬",c:"#4ADE80"},
];

/** صفوف عرض الفئات (أقسام + بطاقات) */
const CAT_GROUP_ROWS=[
  {ar:"سيارات",en:"Cars",ids:new Set(["cars"])},
  {ar:"أماكن وسفر",en:"Places & Travel",ids:new Set(["geography","landmarks","maps","flags","ocean","travel","aviation","space"])},
  {ar:"تاريخ ومجتمع",en:"History & Society",ids:new Set(["history","ancient","leaders","politics","law","religion","customs","proverbs","mythology","psychology","social","economics","currencies"])},
  {ar:"علوم وتقنية",en:"Science & Tech",ids:new Set(["science","chemistry","math","physics","biology","medicine","inventions","tech","weather","gems","dinosaurs"])},
  {ar:"فن وثقافة وإعلام",en:"Arts & Media",ids:new Set(["culture","art","theater","music","dance","movies","anime","comics","photography","horror","architecture","literature","media","fashion","boardgames","riddles"])},
  {ar:"طبيعة وحياة",en:"Nature & Life",ids:new Set(["nature","animals","food","health"])},
  {ar:"رياضة وأسلوب حياة",en:"Sports & Lifestyle",ids:new Set(["sports","soccer","olympics","gaming","business","brands","language"])},
];
function groupCatsForUi(catList){
  const rows=[];
  CAT_GROUP_ROWS.forEach(g=>{
    const cats=catList.filter(c=>g.ids.has(c.id));
    if(cats.length)rows.push({label:g.ar,cats});
  });
  const used=new Set();
  CAT_GROUP_ROWS.forEach(g=>g.ids.forEach(id=>used.add(id)));
  const rest=catList.filter(c=>!used.has(c.id));
  if(rest.length)rows.push({label:"أخرى",cats:rest});
  return rows;
}

/* ═══════ 🇰🇼 KUWAIT QUESTIONS (60 cats × 8 each) ═══════ */

/* ═══════ 🌍 GENERAL KNOWLEDGE QUESTIONS ═══════ */
const GEN_AR={"history":[{q:"متى انتهت الحرب العالمية الثانية؟",o:["١٩٤٣","١٩٤٤","١٩٤٥","١٩٤٦"],a:2},{q:"أول إنسان مشى على القمر؟",o:["باز ألدرين","يوري غاغارين","نيل أرمسترونغ","جون غلين"],a:2},{q:"سقط جدار برلين بأي سنة؟",o:["١٩٨٧","١٩٨٩","١٩٩١","١٩٩٣"],a:1},{q:"تيتانيك غرقت بأي سنة؟",o:["١٩١٠","١٩١٢","١٩١٤","١٩١٦"],a:1},{q:"الحرب العالمية الأولى بدأت بـ؟",o:["١٩١٢","١٩١٤","١٩١٦","١٩١٨"],a:1},{q:"منو رسم سقف كنيسة سيستين؟",o:["دافنشي","رافائيل","مايكل أنجلو","بوتيتشيلي"],a:2},{q:"الحضارة الفرعونية بـ؟",o:["العراق","مصر","سوريا","لبنان"],a:1},{q:"الثورة الفرنسية بدأت بـ؟",o:["١٧٨٩","١٧٧٦","١٧٩٩","١٨٠٤"],a:0}],"science":[{q:"الكوكب الأحمر؟",o:["الزهرة","المشتري","المريخ","زحل"],a:2},{q:"رمز الماء الكيميائي؟",o:["HO","H2O","O2H","OH2"],a:1},{q:"كم عظمة بجسم الإنسان؟",o:["١٩٦","٢٠٢","٢٠٦","٢١٦"],a:2},{q:"النباتات تمتص غاز؟",o:["الأوكسجين","ثاني أكسيد الكربون","النيتروجين","الهيدروجين"],a:1},{q:"سرعة الضوء تقريباً؟",o:["٢٠٠ ألف كم/ث","٣٠٠ ألف كم/ث","٤٠٠ ألف كم/ث","٥٠٠ ألف كم/ث"],a:1},{q:"العضو اللي ينتج الأنسولين؟",o:["الكبد","الكلى","البنكرياس","القلب"],a:2},{q:"أكبر عضو بالجسم؟",o:["الكبد","القلب","الجلد","الدماغ"],a:2},{q:"فصيلة الدم المعطي العام؟",o:["A","B","AB","O"],a:3}],"sports":[{q:"منو فاز بكأس العالم ٢٠٢٢؟",o:["فرنسا","البرازيل","ألمانيا","الأرجنتين"],a:3},{q:"كم لاعب بفريق كرة السلة بالملعب؟",o:["٤","٥","٦","٧"],a:1},{q:"مسافة الماراثون؟",o:["٤١.٥ كم","٤٢.١٩٥ كم","٤٣.١ كم","٤٢.٨ كم"],a:1},{q:"أولمبياد ٢٠٢٠ استضافتها؟",o:["الصين","البرازيل","اليابان","كوريا"],a:2},{q:"الكريكيت نشأ بـ؟",o:["الهند","أستراليا","إنجلترا","جنوب أفريقيا"],a:2},{q:"كم شوط بمباراة كرة القدم؟",o:["٢","٣","٤","١"],a:0},{q:"الفيفا تأسست بأي سنة؟",o:["١٩٠٠","١٩٠٤","١٩١٠","١٩٢٠"],a:1},{q:"٤٠-٤٠ بالتنس يسمى؟",o:["أدفانتج","ديوس","بريك","ماتش بوينت"],a:1}],"geography":[{q:"أكبر صحراء بالعالم؟",o:["الصحراء الكبرى","غوبي","القطب الجنوبي","العربية"],a:2},{q:"عاصمة أستراليا؟",o:["سيدني","كانبيرا","ملبورن","بريزبين"],a:1},{q:"أصغر دولة بالعالم؟",o:["موناكو","سان مارينو","لختنشتاين","الفاتيكان"],a:3},{q:"أطول نهر بالعالم؟",o:["الأمازون","المسيسبي","النيل","اليانغتسي"],a:2},{q:"أكبر محيط؟",o:["الأطلسي","الهندي","الهادئ","المتجمد"],a:2},{q:"أكثر دولة سكاناً؟",o:["أمريكا","الهند","الصين","إندونيسيا"],a:1},{q:"جبل إيفرست على حدود؟",o:["الهند-الصين","نيبال-الهند","نيبال-الصين","التبت"],a:2},{q:"نهر الأمازون بأي قارة؟",o:["أفريقيا","أمريكا الجنوبية","آسيا","أمريكا الشمالية"],a:1}],"movies":[{q:"مخرج فيلم إنسيبشن؟",o:["سبيلبرغ","تارانتينو","نولان","سكورسيزي"],a:2},{q:"أعلى فيلم إيرادات؟",o:["تيتانيك","إندغيم","أفاتار","ستار وورز"],a:2},{q:"منو لعب جاك بتيتانيك؟",o:["براد بيت","توم كروز","جوني ديب","دي كابريو"],a:3},{q:"أول فيلم ستار وورز؟",o:["١٩٧٥","١٩٧٧","١٩٧٩","١٩٨١"],a:1},{q:"منو لعب آيرون مان؟",o:["كريس إيفانز","روبرت داوني","كريس هيمسوورث","مارك رافالو"],a:1},{q:"أول فيلم لبيكسار؟",o:["نيمو","توي ستوري","كارز","أب"],a:1},{q:"فيلم العراب من إخراج؟",o:["سكورسيزي","كوبولا","كوبريك","دي بالما"],a:1},{q:"أوسكار أفضل فيلم ٢٠٢٠؟",o:["١٩١٧","جوكر","فورد ضد فيراري","باراسايت"],a:3}],"music":[{q:"آلة فيها ٨٨ مفتاح؟",o:["غيتار","هارب","بيانو","كمان"],a:2},{q:"ملك البوب؟",o:["إلفيس","برنس","بوي","مايكل جاكسون"],a:3},{q:"بوهيميان رابسودي لفرقة؟",o:["بيتلز","ليد زيبلين","بينك فلويد","كوين"],a:3},{q:"الريغي من؟",o:["كوبا","البرازيل","جامايكا","المكسيك"],a:2},{q:"كم وتر بالغيتار؟",o:["٤","٥","٦","٨"],a:2},{q:"بيتهوفن من؟",o:["النمسا","فرنسا","ألمانيا","إيطاليا"],a:2},{q:"أم كلثوم من؟",o:["لبنان","سوريا","مصر","العراق"],a:2},{q:"فيروز من؟",o:["مصر","لبنان","سوريا","فلسطين"],a:1}],"food":[{q:"السوشي من؟",o:["الصين","تايلاند","اليابان","كوريا"],a:2},{q:"الذهب الأحمر؟",o:["الكركم","القرفة","الزعفران","البابريكا"],a:2},{q:"مكون الحمص الرئيسي؟",o:["عدس","بازلاء","حمص","فاصوليا"],a:2},{q:"الكرواسون أصله؟",o:["فرنسا","إيطاليا","النمسا","بلجيكا"],a:2},{q:"التاكو من؟",o:["إسبانيا","البرازيل","المكسيك","الأرجنتين"],a:2},{q:"الكبسة طبق من؟",o:["مصر","السعودية والخليج","لبنان","المغرب"],a:1},{q:"الفلافل أصلها؟",o:["الشام ومصر","الهند","تركيا","إيران"],a:0},{q:"الكيمتشي من؟",o:["اليابان","فيتنام","كوريا","الصين"],a:2}],"nature":[{q:"أسرع حيوان بري؟",o:["الأسد","الحصان","الفهد","الغزال"],a:2},{q:"كم قلب للأخطبوط؟",o:["١","٢","٣","٤"],a:2},{q:"أكبر حيوان ثديي؟",o:["الفيل","الزرافة","الحوت الأزرق","فرس النهر"],a:2},{q:"كم رجل للعنكبوت؟",o:["٦","٨","١٠","١٢"],a:1},{q:"أطول حيوان؟",o:["الفيل","الزرافة","الحصان","الجمل"],a:1},{q:"أسرع طائر؟",o:["النسر","الصقر الشاهين","الباز","البومة"],a:1},{q:"الحيوان اللي ينام ٣ سنوات؟",o:["الدب","الكوالا","الحلزون","الكسلان"],a:2},{q:"مجموعة الأسود تسمى؟",o:["قطيع","سرب","زمرة","لبؤة"],a:2}],"art":[{q:"منو رسم الموناليزا؟",o:["بيكاسو","رافائيل","دافنشي","مايكل أنجلو"],a:2},{q:"ليلة النجوم لمنو؟",o:["مونيه","سيزان","رينوار","فان غوخ"],a:3},{q:"الأوريغامي فن ياباني لـ؟",o:["الفخار","النسيج","طي الورق","الرسم"],a:2},{q:"فريدا كاهلو من؟",o:["إسبانيا","البرازيل","المكسيك","الأرجنتين"],a:2},{q:"البوب آرت أسسها؟",o:["بيكاسو","وارهول","مونيه","دالي"],a:1},{q:"لوحة الصرخة لـ؟",o:["مونيه","مونك","بيكاسو","دالي"],a:1},{q:"الخط العربي يعتبر فن؟",o:["زخرفة عابرة فقط","تراثي عريق","خط لاتيني كلاسيكي","مراسلات إدارية بحتة"],a:1},{q:"السريالية حركة أسسها؟",o:["بيكاسو","دالي","بريتون","موندريان"],a:2}],"literature":[{q:"روميو وجولييت لـ؟",o:["ديكنز","أوستن","شكسبير","همنغواي"],a:2},{q:"رواية ١٩٨٤ لـ؟",o:["هكسلي","برادبري","أورويل","تولكين"],a:2},{q:"ألف ليلة وليلة من؟",o:["التراث الفارسي والعربي","اليوناني","الصيني","الهندي"],a:0},{q:"نجيب محفوظ فاز بـ؟",o:["أوسكار","نوبل","غرامي","بوليتزر"],a:1},{q:"سيد الخواتم لـ؟",o:["لويس","رولينغ","تولكين","مارتن"],a:2},{q:"المتنبي شاعر من؟",o:["العصر الحديث","العصر العباسي","الجاهلية","الأموي"],a:1},{q:"هاري بوتر كتبتها؟",o:["كينغ","ماير","رولينغ","كولينز"],a:2},{q:"دون كيشوت لـ؟",o:["سرفانتس","لوركا","بورخيس","نيرودا"],a:0}],"tech":[{q:"مؤسس أبل؟",o:["غيتس","ماسك","ستيف جوبز","بيزوس"],a:2},{q:"أول آيفون بـ؟",o:["٢٠٠٦","٢٠٠٧","٢٠٠٨","٢٠٠٩"],a:1},{q:"أندرويد من؟",o:["سامسونغ","مايكروسوفت","أبل","غوغل"],a:3},{q:"تشات جي بي تي من؟",o:["غوغل","ميتا","أوبن أي آي","أبل"],a:2},{q:"الذكاء الاصطناعي يعني؟",o:["أتمتة بسيطة دون تعلم","محاكاة ذكاء الإنسان","تعلم آلة بمهام ضيقة","إحصاءات ومجموعات بيانات"],a:1},{q:"أول كمبيوتر بحجم؟",o:["لوح إلكتروني","غرفة كاملة","طابعة مكتبية","ساعة يد"],a:1},{q:"بايثون هو؟",o:["بيئة تشغيل أنظمة","لغة برمجة","مكتبة رسوم فقط","قاعدة بيانات مدمجة"],a:1},{q:"مؤسس أمازون؟",o:["غيتس","زوكربيرغ","ماسك","بيزوس"],a:3}],"medicine":[{q:"درجة حرارة الجسم الطبيعية؟",o:["٣٦.٥°","٣٧°","٣٧.٥°","٣٦°"],a:1},{q:"كم فصيلة دم رئيسية؟",o:["٢","٤","٦","٨"],a:1},{q:"الأنسولين يعالج؟",o:["السرطان","السكري","البرد","الإنفلونزا"],a:1},{q:"فيتامين C بـ؟",o:["اللحم","الحمضيات","الخبز","الرز"],a:1},{q:"نبض القلب الطبيعي؟",o:["٤٠","٦٠-١٠٠","١٢٠","١٥٠"],a:1},{q:"المضادات الحيوية تحارب؟",o:["فيروسات","بكتيريا","حساسية","ألم"],a:1},{q:"أكبر عضو بالجسم؟",o:["الكبد","القلب","الجلد","الدماغ"],a:2},{q:"WHO تعني؟",o:["منظمة مساعدة","منظمة الصحة العالمية","مستشفى عالمي","مكتب صحي"],a:1}],"physics":[{q:"الجاذبية اكتشفها؟",o:["أينشتاين","نيوتن","غاليليو","هوكينغ"],a:1},{q:"E=mc² لـ؟",o:["نيوتن","هوكينغ","أينشتاين","بور"],a:2},{q:"الضوء أسرع بـ؟",o:["الماء","الزجاج","الفراغ","الهواء"],a:2},{q:"وحدة القوة؟",o:["واط","جول","نيوتن","فولت"],a:2},{q:"الصوت أسرع بـ؟",o:["الهواء","الماء","الفراغ","المواد الصلبة"],a:3},{q:"ألوان قوس قزح؟",o:["٥","٦","٧","٨"],a:2},{q:"سرعة الضوء تقريباً؟",o:["١٥٠ ألف","٣٠٠ ألف كم/ث","٥٠٠ ألف","مليون"],a:1},{q:"الصفر المطلق؟",o:["-١٠٠°","-٢٧٣°","-٢٠٠°","٠°"],a:1}],"biology":[{q:"DNA اختصار لـ؟",o:["حمض نووي ريبي منقوص الأكسجين","حمض نووي ريبوزي","سلسلة ببتيدية مزدوجة","بلمر ليبيدي معقد"],a:0},{q:"أكبر خلية بالجسم؟",o:["العصبية","الدم الحمراء","البويضة","الدم البيضاء"],a:2},{q:"التمثيل الضوئي يحتاج؟",o:["ظلام","ضوء الشمس","رياح","مطر"],a:1},{q:"كم كروموسوم؟",o:["٢٣","٤٦","٤٨","٤٤"],a:1},{q:"الميتوكوندريا هي؟",o:["مخ الخلية","محطة طاقة الخلية","جدار","نواة"],a:1},{q:"النباتات خضراء بسبب؟",o:["الماء","الكلوروفيل","التربة","الشمس"],a:1},{q:"أصغر وحدة للحياة؟",o:["الذرة","الجزيء","الخلية","العضو"],a:2},{q:"وزن الدماغ تقريباً؟",o:["٠.٥ كغ","١.٤ كغ","٣ كغ","٥ كغ"],a:1}]};
const GEN={"history":[{q:"When did World War II end?",o:["1944","1945","1946","1943"],a:2},{q:"Who walked on the moon first?",o:["Buzz Aldrin","Yuri Gagarin","Neil Armstrong","John Glenn"],a:2},{q:"The French Revolution began in?",o:["1789","1776","1799","1812"],a:0},{q:"Who built the Colosseum?",o:["Greeks","Romans","Ottomans","Persians"],a:1},{q:"Berlin Wall fell in?",o:["1991","1987","1989","1993"],a:2},{q:"Who painted Sistine Chapel ceiling?",o:["Da Vinci","Raphael","Michelangelo","Botticelli"],a:2},{q:"Titanic sank in?",o:["1910","1912","1914","1916"],a:1},{q:"Who discovered penicillin?",o:["Einstein","Fleming","Darwin","Newton"],a:1}],"science":[{q:"Red Planet is?",o:["Venus","Jupiter","Mars","Saturn"],a:2},{q:"Chemical symbol for water?",o:["HO","H2O","O2H","WA"],a:1},{q:"Bones in adult body?",o:["196","206","216","202"],a:2},{q:"Gas plants absorb?",o:["Oxygen","CO₂","Nitrogen","Hydrogen"],a:1},{q:"Speed of light approx?",o:["150K km/s","500K km/s","300K km/s","1M km/s"],a:2},{q:"Organ producing insulin?",o:["Liver","Kidney","Pancreas","Heart"],a:2},{q:"Largest organ of body?",o:["Liver","Heart","Skin","Brain"],a:2},{q:"Blood type universal donor?",o:["A","B","AB","O"],a:3}],"sports":[{q:"2022 FIFA World Cup winner?",o:["France","Brazil","Germany","Argentina"],a:3},{q:"Basketball players per team on court?",o:["4","6","5","7"],a:2},{q:"40-40 in tennis called?",o:["Advantage","Match point","Deuce","Break"],a:2},{q:"Marathon distance?",o:["41.5 km","42.195 km","43.1 km","42.8 km"],a:1},{q:"2020 Olympics hosted by?",o:["China","Brazil","Japan","Korea"],a:2},{q:"Slam dunk is in?",o:["Volleyball","Tennis","Basketball","Football"],a:2},{q:"Cricket originated in?",o:["India","Australia","England","South Africa"],a:2},{q:"Olympic motto is?",o:["Win!","Faster Higher Stronger","Best Always","Go Gold"],a:1}],"geography":[{q:"Largest desert?",o:["Sahara","Gobi","Antarctic","Arabian"],a:2},{q:"Capital of Australia?",o:["Sydney","Canberra","Melbourne","Brisbane"],a:1},{q:"Smallest country?",o:["Monaco","San Marino","Liechtenstein","Vatican City"],a:3},{q:"Amazon River continent?",o:["Africa","South America","Asia","N. America"],a:1},{q:"Everest borders?",o:["India-China","Nepal-India","Nepal-China","Tibet-India"],a:2},{q:"Longest river?",o:["Amazon","Mississippi","Nile","Yangtze"],a:2},{q:"Largest ocean?",o:["Atlantic","Indian","Pacific","Arctic"],a:2},{q:"Most populated country?",o:["USA","India","China","Indonesia"],a:1}],"movies":[{q:"Director of Inception?",o:["Spielberg","Tarantino","Nolan","Scorsese"],a:2},{q:"Highest-grossing film ever?",o:["Titanic","Endgame","Avatar","Star Wars"],a:2},{q:"Jack in Titanic?",o:["Brad Pitt","Tom Cruise","Johnny Depp","DiCaprio"],a:3},{q:"2020 Best Picture?",o:["1917","Joker","Ford v Ferrari","Parasite"],a:3},{q:"Godfather directed by?",o:["Scorsese","Kubrick","Coppola","De Palma"],a:2},{q:"First Star Wars year?",o:["1975","1979","1977","1981"],a:2},{q:"Who played Iron Man?",o:["Chris Evans","Robert Downey Jr","Chris Hemsworth","Mark Ruffalo"],a:1},{q:"Pixar's first feature film?",o:["Finding Nemo","Toy Story","Cars","Up"],a:1}],"music":[{q:"88 keys instrument?",o:["Guitar","Harp","Piano","Violin"],a:2},{q:"King of Pop?",o:["Elvis","Prince","Bowie","Michael Jackson"],a:3},{q:"Bohemian Rhapsody band?",o:["Beatles","Led Zeppelin","Pink Floyd","Queen"],a:3},{q:"Genre from Jamaica?",o:["Jazz","Blues","Samba","Reggae"],a:3},{q:"Guitar strings count?",o:["4","5","8","6"],a:3},{q:"Beethoven's country?",o:["Austria","France","Germany","Italy"],a:2},{q:"Instrument in an orchestra that conducts?",o:["Piano","Baton","Violin","Drum"],a:1},{q:"Auto-Tune became famous in which decade?",o:["1980s","1990s","2000s","2010s"],a:1}],"nature":[{q:"Fastest land animal?",o:["Lion","Horse","Cheetah","Gazelle"],a:2},{q:"Octopus hearts?",o:["1","2","4","3"],a:3},{q:"Largest mammal?",o:["Elephant","Giraffe","Blue Whale","Hippo"],a:2},{q:"Spider legs?",o:["6","10","8","12"],a:2},{q:"Group of lions?",o:["Pack","Herd","Pride","Flock"],a:2},{q:"Sleeps up to 3 years?",o:["Bear","Koala","Snail","Sloth"],a:2},{q:"Tallest animal?",o:["Elephant","Giraffe","Horse","Camel"],a:1},{q:"Fastest bird?",o:["Eagle","Falcon (Peregrine)","Hawk","Owl"],a:1}],"food":[{q:"Sushi origin?",o:["China","Thailand","Japan","Korea"],a:2},{q:"Red gold spice?",o:["Turmeric","Cinnamon","Saffron","Paprika"],a:2},{q:"Main ingredient of hummus?",o:["Lentils","Peas","Chickpeas","Beans"],a:2},{q:"Kimchi from?",o:["Japan","Vietnam","South Korea","China"],a:2},{q:"Italy's pasta city?",o:["Rome","Milan","Bologna","Venice"],a:2},{q:"Croissant originated in?",o:["France","Italy","Austria","Belgium"],a:2},{q:"Taco origin country?",o:["Spain","Brazil","Mexico","Argentina"],a:2},{q:"Dim sum from?",o:["Japan","Korea","China","Thailand"],a:2}],"art":[{q:"Mona Lisa painter?",o:["Picasso","Raphael","Da Vinci","Michelangelo"],a:2},{q:"Starry Night painter?",o:["Monet","Cézanne","Renoir","Van Gogh"],a:3},{q:"Dalí's movement?",o:["Cubism","Pop Art","Surrealism","Impressionism"],a:2},{q:"David sculptor?",o:["Da Vinci","Bernini","Donatello","Michelangelo"],a:3},{q:"Frida Kahlo's country?",o:["Spain","Brazil","Mexico","Argentina"],a:2},{q:"Origami is?",o:["Clay art","Weaving","Paper folding","Painting"],a:2},{q:"Andy Warhol's movement?",o:["Cubism","Pop Art","Impressionism","Baroque"],a:1},{q:"The Scream painted by?",o:["Monet","Edvard Munch","Picasso","Dalí"],a:1}],"literature":[{q:"Romeo and Juliet author?",o:["Dickens","Austen","Shakespeare","Hemingway"],a:2},{q:"1984 author?",o:["Huxley","Bradbury","Orwell","Tolkien"],a:2},{q:"Harry Potter author?",o:["King","Meyer","Rowling","Collins"],a:2},{q:"The Alchemist author?",o:["Marquez","Borges","Coelho","Allende"],a:2},{q:"Don Quixote author?",o:["Cervantes","Lorca","Borges","Neruda"],a:0},{q:"The Prince author?",o:["Plato","Aristotle","Machiavelli","Socrates"],a:2},{q:"Lord of the Rings author?",o:["Lewis","Rowling","Tolkien","Martin"],a:2},{q:"Crime and Punishment author?",o:["Tolstoy","Dostoevsky","Chekhov","Pushkin"],a:1}],"tech":[{q:"Apple co-founder?",o:["Gates","Musk","Steve Jobs","Bezos"],a:2},{q:"First iPhone year?",o:["2006","2007","2008","2009"],a:1},{q:"Android creator?",o:["Samsung","Microsoft","Apple","Google"],a:3},{q:"Amazon founder?",o:["Gates","Zuckerberg","Musk","Bezos"],a:3},{q:"WWW stands for?",o:["Wide World Web","World Wide Web","Web World Wide","Western Web"],a:1},{q:"Python is a?",o:["CPU microcode layer","Programming language","purely visual markup","embedded database"],a:1},{q:"Tesla CEO?",o:["Bezos","Gates","Cook","Musk"],a:3},{q:"ChatGPT made by?",o:["Google","Meta","OpenAI","Apple"],a:2}],"flags":[{q:"Japan's flag has?",o:["Star","Moon","Red circle","Dragon"],a:2},{q:"How many stars on US flag?",o:["48","50","52","13"],a:1},{q:"Canada's flag symbol?",o:["Eagle","Maple leaf","Bear","Moose"],a:1},{q:"France's flag colors?",o:["Red-white","Blue-white-red","Green-white","Red-yellow"],a:1},{q:"Crescent and star flag?",o:["Japan","China","Turkey","Brazil"],a:2},{q:"Brazil's flag color?",o:["Red-white","Blue-yellow","Green-yellow","Orange-white"],a:2},{q:"UK flag called?",o:["Stars & Stripes","Union Jack","Tricolor","Rising Sun"],a:1},{q:"Which flag has a dragon?",o:["Japan","China","Wales","Scotland"],a:2}],"economics":[{q:"GDP stands for?",o:["General Daily Product","Gross Domestic Product","Global Data Plan","Grand Dollar Price"],a:1},{q:"World's largest economy?",o:["China","Japan","USA","Germany"],a:2},{q:"Inflation means?",o:["Prices drop","Prices rise","Prices stay","No change"],a:1},{q:"Wall Street is in?",o:["London","Tokyo","New York","Hong Kong"],a:2},{q:"Bitcoin created in?",o:["2005","2009","2013","2017"],a:1},{q:"OPEC deals with?",o:["Technology","Oil","Food","Banking"],a:1},{q:"Euro used by how many countries approx?",o:["10","15","20","27"],a:2},{q:"Richest person changes but often from?",o:["Sports","Tech industry","Oil","Real estate"],a:1}],"medicine":[{q:"Largest organ?",o:["Liver","Heart","Skin","Brain"],a:2},{q:"Normal body temperature?",o:["36.5°C","37°C","37.5°C","36°C"],a:1},{q:"Blood types count?",o:["2","4","6","8"],a:1},{q:"Insulin treats?",o:["Cancer","Diabetes","Cold","Flu"],a:1},{q:"Vitamin C found in?",o:["Meat","Citrus fruits","Bread","Rice"],a:1},{q:"Heart beats per minute (avg)?",o:["40","60-100","120","150"],a:1},{q:"Antibiotics fight?",o:["Viruses","Bacteria","Allergies","Pain"],a:1},{q:"WHO stands for?",o:["World Help Org","World Health Organization","World Hospital Order","Western Health Office"],a:1}],"physics":[{q:"Speed of light approx?",o:["150K km/s","300K km/s","500K km/s","1M km/s"],a:1},{q:"Gravity discovered by?",o:["Einstein","Newton","Galileo","Hawking"],a:1},{q:"E=mc² is by?",o:["Newton","Hawking","Einstein","Bohr"],a:2},{q:"Absolute zero in Celsius?",o:["-100°C","-273°C","-200°C","0°C"],a:1},{q:"Light travels fastest in?",o:["Water","Glass","Vacuum","Air"],a:2},{q:"Unit of force?",o:["Watt","Joule","Newton","Volt"],a:2},{q:"Sound travels fastest in?",o:["Air","Water","Vacuum","Solids"],a:3},{q:"Rainbow colors count?",o:["5","6","7","8"],a:2}],"biology":[{q:"DNA stands for?",o:["Deoxyribonucleic acid","Ribonucleic acid","Dipeptide nucleotide","Amino-acid helix"],a:0},{q:"Largest cell in human body?",o:["Neuron","Red blood cell","Egg cell","White blood cell"],a:2},{q:"Photosynthesis needs?",o:["Complete darkness","Sunlight","Frozen ground","CO₂ alone without light"],a:1},{q:"Humans have how many chromosomes?",o:["23","46","48","44"],a:1},{q:"Mitochondria is the?",o:["Brain","Powerhouse of cell","Wall","Nucleus"],a:1},{q:"Plants are green because of?",o:["Water","Chlorophyll","Soil","Sunlight"],a:1},{q:"Smallest unit of life?",o:["Atom","Molecule","Cell","Organ"],a:2},{q:"Human brain weighs about?",o:["0.5 kg","1.4 kg","3 kg","5 kg"],a:1}]};

const fillMissing = (bank, isAr) => {
  const fb = isAr ? FALLBACK_AR : FALLBACK_EN;
  CATS.forEach(cat => {
    if (!bank[cat.id]) {
      if (fb[cat.id]) { bank[cat.id] = fb[cat.id]; }
      else if (isAr && GEN_AR[cat.id]) { bank[cat.id] = GEN_AR[cat.id]; }
      else if (!isAr && GEN[cat.id]) { bank[cat.id] = GEN[cat.id]; }
      else {
        bank[cat.id] = Array.from({length:20}, (_,i) => {
          const a = Math.floor(Math.random()*4);
          return {
            q: isAr ? `أي خيار هو الأدق ضمن سياق ${cat.ar}؟ (${i+1})` : `Which option is most precise in ${cat.n}? (${i+1})`,
            o: isAr
              ? [`${cat.ar} - خيار دقيق`,`${cat.ar} - خيار قريب`,`${cat.ar} - خيار مشابه`,`${cat.ar} - خيار ملتبس`]
              : [`${cat.n} - precise option`,`${cat.n} - near option`,`${cat.n} - similar option`,`${cat.n} - tricky option`],
            a
          };
        });
      }
    }
  });
};
fillMissing(KW, true);
fillMissing(GEN_AR, true);
fillMissing(GEN, false);
GCC_COUNTRY_IDS.forEach((id) => {
  fillMissing(GCC_BANKS[id], true);
});

/* ═══════ UTILS ═══════ */
const shuf=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
const shufQ=q=>{const c=q.o[q.a];const s=shuf(q.o);return{...q,o:s,a:s.indexOf(c)}};

const COUNTRIES=[
{id:"general_ar",name:"Global AR",native:"عالمي · أسئلة عربية",flag:"🌍",lang:"ar",dir:"rtl",dialect:"Modern Standard Arabic"},
{id:"general_en",name:"Global EN",native:"عالمي · أسئلة بالإنجليزية",flag:"🌐",lang:"en",dir:"ltr",dialect:"English"},
{id:"kw",name:"Kuwait",native:"الكويت",flag:"🇰🇼",lang:"ar",dir:"rtl",dialect:"Kuwaiti Arabic dialect"},
{id:"sa",name:"Saudi Arabia",native:"السعودية",flag:"🇸🇦",lang:"ar",dir:"rtl",dialect:"Saudi Arabic"},
{id:"ae",name:"UAE",native:"الإمارات",flag:"🇦🇪",lang:"ar",dir:"rtl",dialect:"Emirati Arabic"},
{id:"qa",name:"Qatar",native:"قطر",flag:"🇶🇦",lang:"ar",dir:"rtl",dialect:"Qatari Arabic"},
{id:"bh",name:"Bahrain",native:"البحرين",flag:"🇧🇭",lang:"ar",dir:"rtl",dialect:"Bahraini Arabic"},
{id:"om",name:"Oman",native:"عُمان",flag:"🇴🇲",lang:"ar",dir:"rtl",dialect:"Omani Arabic"},
];
const isWorldwideCountry=id=>id==="general_ar"||id==="general_en";

const LN={en:"English",ar:"العربية",fr:"Français",de:"Deutsch",es:"Español",ja:"日本語",tr:"Türkçe",pt:"Português",hi:"हिन्दी"};
const T={
  en:{start:"START",mode:"SELECT MODE",duel:"1 vs 1",teamVs:"Team vs Team",back:"← Back",matchN:"Match Name",player:"Player",team:"Team",cats:"Pick 8 Categories",sel:"selected",startM:"GO!",selCats:"Categories →",nextSetup:"Next — team setup",turn:"'s Turn",pts:"pts",bounce:"🔄 STEAL!",steal:"can steal!",fifty:"50/50",ext:"+15s",end:"End",wins:"THE WINNER!",tie:"TIE!",vCard:"✦ VICTORY ✦",rematch:"AGAIN",newCats:"🎯 New categories",menu:"🏠 Menu",country:"Pick Country",loading:"Loading...",setup:"Setup",change:"Change",search:"🔍 Search...",nobody:"Nobody got it!",catWord:"categories"},
  ar:{start:"يلا",mode:"اختار الوضع",duel:"١ ضد ١",teamVs:"فريق ضد فريق",back:"→ رجوع",matchN:"اسم المباراة",player:"لاعب",team:"فريق",cats:"اختار ٨ فئات",sel:"مختارة",startM:"يلا!",selCats:"→ الفئات",nextSetup:"التالي — إعداد الفريق",turn:" يلعب",pts:"نقطة",bounce:"🔄 سرقة!",steal:"يسرق!",fifty:"٥٠/٥٠",ext:"+١٥ث",end:"إنهاء",wins:"الفريق الفائز!",tie:"تعادل!",vCard:"✦ النصر ✦",rematch:"ثاني",newCats:"🎯 فئات جديدة",menu:"🏠 الرئيسية",country:"اختار الدولة",loading:"نحمّل...",setup:"إعداد",change:"غيّر",search:"🔍 بحث...",nobody:"!محد عرف",catWord:"فئة"},
};
/** واجهة المستخدم بالعربية */
const BI={
  langBadge: LN.ar,
  themeAria: "نمط العرض",
  themeCalm: "هادئ",
  themeNight: "ليلي",
  themeLight: "فاتح",
  difficulty: "مستوى الصعوبة",
  normal: "عادي 😊",
  hard: "صعب 🔥",
  placeholderAns: "اكتب إجابتك هنا...",
  wrongAns: "❌ إجابة خاطئة",
  hardBanner: "الوضع الصعب — اكتب الإجابة",
  /** مستوى صف الشبكة (حسب النقاط) — وليس زر «وضع الكتابة» */
  gridTierEasy: "عادي",
  gridTierMid: "وسط",
  gridTierHard: "صعب",
  gridTierHint: "٢٠٠ عادي · ٤٠٠ وسط · ٦٠٠ صعب",
};
const catBi = (c) => c.ar || c.n;
const PTS=[200,200,400,400,600,600];
/** مؤقت أقصر تدريجياً للصفوف الأصعب */
const PTS_TIMER=[45,45,40,40,35,35];
function ptsTierLabelAr(pts){
  if(pts<=200)return BI.gridTierEasy;
  if(pts<=400)return BI.gridTierMid;
  return BI.gridTierHard;
}
function rowTierFromRi(ri){return ri<2?"easy":ri<4?"mid":"hard";}
/** يقسّم بنك الأسئلة إلى ثلاث مستويات (أقصر نصاً ≈ أسهل، أطول ≈ أصعب) */
function splitQuestionsByDifficulty(pick){
  const allUnique=[...pick];
  if(!allUnique.length)return empty;
  if(allUnique.length<4){
    const s=shuf(allUnique);
    return{easy:s,mid:[],hard:[]};
  }
  const scored=allUnique.map(q=>({
    q,
    s:String(q.q||"").length+(Array.isArray(q.o)?q.o.map(String).join("").length:0)
  }));
  scored.sort((a,b)=>a.s-b.s);
  const n=scored.length;
  let i1=Math.max(1,Math.ceil(n/3));
  let i2=Math.max(i1+1,Math.ceil((2*n)/3));
  let easy=scored.slice(0,i1).map(x=>x.q);
  let mid=scored.slice(i1,i2).map(x=>x.q);
  let hard=scored.slice(i2).map(x=>x.q);
  const minPer=2;
  while(easy.length<minPer&&mid.length){easy.push(mid.shift())}
  while(mid.length<minPer&&hard.length){mid.push(hard.shift())}
  while(mid.length<minPer&&easy.length>minPer){mid.unshift(easy.pop())}
  while(hard.length<minPer&&mid.length>minPer){hard.push(mid.pop())}
  return{easy:shuf(easy),mid:shuf(mid),hard:shuf(hard)};
}
const AC=["#2563EB","#D97706","#059669","#DB2777"];
const AB=["rgba(37,99,235,.1)","rgba(217,119,6,.1)","rgba(5,150,105,.1)","rgba(219,39,119,.1)"];


/** Dev: proxied via vite.config; production static build has no proxy */
const anthropicMessagesUrl = import.meta.env.DEV ? "/api/anthropic/v1/messages" : null;
/** يُعطّل تحميل الـ API بعد 401/403 لتفادي عشرات الطلبات الفاشلة بدون مفتاح */
let anthropicRemoteDisabled = false;
function markAnthropicAuthFailure(status) {
  if (status === 401 || status === 403) anthropicRemoteDisabled = true;
}
/* ═══════ AI ═══════ */
async function genQs(cats,country){
  const langRule=country.lang==="ar"
    ?`LANGUAGE: Arabic ONLY for every "q" and every string in "o". No English words inside Arabic text (except universally fixed symbols like UN, DNA if unavoidable). Perfect Arabic spelling and diacritics where natural. No mixed-script sentences.`
    :`LANGUAGE: English ONLY for "q" and "o". No Arabic script in English fields.`;
  const prompt=`You are an expert fact-checked trivia author. Use only verifiable real-world facts (well-known references, no invention). ${langRule}
Generate trivia quiz JSON. ${isWorldwideCountry(country.id)?"Worldwide general knowledge":"EXCLUSIVELY about "+country.name}.
Categories: ${cats.map(c=>c.n).join(", ")}
For EACH category generate exactly 60 unique questions with 4 options and 1 correct answer.
${!isWorldwideCountry(country.id)?`ALL questions must be specifically about ${country.name} — its history, culture, people, landmarks, food, sports, traditions, arts, media, science, geography, politics. Use REAL facts only.`:"Use diverse topics — history, science, pop culture, geography, sports, arts, literature, technology. REAL facts only."}
Write in ${country.dialect} for tone; still obey LANGUAGE rule above for the actual strings in JSON.
CRITICAL — EXPERT / HIGH DIFFICULTY (raise the bar):
- Wrong answers must be HIGHLY plausible: same «type» as the truth (near dates, homologous models, bordering capitals, easily confused names). No joke options, no obviously wrong outliers.
- At least half the set should need precise knowledge (not only what «everyone» knows from headlines); include specific numbers, years, technical terms, and niche-but-verifiable facts where appropriate.
- One unambiguous correct option; distractors should trap someone who is «almost» right.
- No duplicate or near-duplicate questions across the set.
- Randomize correct answer index (0-3) evenly across the set.
RESPOND WITH ONLY VALID JSON (no markdown, no backticks):
{"categories":{"catId":[{"q":"question","o":["opt1","opt2","opt3","opt4"],"a":correctIndex}]}}
Category IDs: ${cats.map(c=>c.id).join(",")}`;
  try{
    if(!anthropicMessagesUrl||anthropicRemoteDisabled)return null;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    const r=await fetch(anthropicMessagesUrl,{method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:8000,messages:[{role:"user",content:prompt}]})});
    clearTimeout(timeout);
    if(!r.ok){markAnthropicAuthFailure(r.status);return null;}
    const d=await r.json();const txt=(d.content||[]).map(i=>i.text||"").join("");
    const clean=txt.replace(/```json|```/g,"").trim();
    const parsed=JSON.parse(clean);
    return parsed.categories||parsed;
  }catch{return null}
}

// Generate questions for a batch of categories
async function genBatch(catIds,country){
  const cats=catIds.map(id=>CATS.find(c=>c.id===id)).filter(Boolean);
  if(!cats.length)return null;
  const langRule=country.lang==="ar"
    ?`Arabic ONLY in all "q" and "o" strings — no English inside Arabic. Accurate spelling.`
    :`English ONLY in all "q" and "o" strings — no Arabic script.`;
  const prompt=`Expert fact-checked trivia. ${langRule}
${isWorldwideCountry(country.id)?"Worldwide general knowledge":"EXCLUSIVELY about "+country.name}.
Categories: ${cats.map(c=>c.n).join(", ")}
Each category: 80 unique EXPERT-LEVEL questions. Four options: one correct; three wrong answers must be highly plausible confusers (near-miss facts, same category of detail). At least half should require precise or specialized knowledge. No nonsense distractors.
Write in ${country.dialect} for tone; obey LANGUAGE rule for JSON strings.
Randomize correct index 0-3. ONLY JSON: {"categories":{"catId":[{"q":"text","o":["a","b","c","d"],"a":num}]}}
IDs: ${catIds.join(",")}`;
  try{
    if(!anthropicMessagesUrl||anthropicRemoteDisabled)return null;
    const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),15000);
    const r=await fetch(anthropicMessagesUrl,{method:"POST",headers:{"Content-Type":"application/json"},signal:ctrl.signal,body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:8000,messages:[{role:"user",content:prompt}]})});
    if(!r.ok){markAnthropicAuthFailure(r.status);return null;}
    const d=await r.json();const txt=(d.content||[]).map(i=>i.text||"").join("");
    const p=JSON.parse(txt.replace(/```json|```/g,"").trim());
    return p.categories||p;
  }catch{return null}
}

// Bulk download — generates questions for ALL categories in batches
async function bulkDownload(country,onProgress){
  const cache=loadCache();
  const cacheKey=country.id;
  const allIds=CATS.map(c=>c.id);
  const batchSize=3; // smaller batches for higher response quality
  const batches=[];
  for(let i=0;i<allIds.length;i+=batchSize){batches.push(allIds.slice(i,i+batchSize))}
  
  let done=0;
  for(const batch of batches){
    if(anthropicRemoteDisabled)break;
    const result=await genBatch(batch,country);
    if(result){
      batch.forEach(catId=>{
        const key=`${cacheKey}_${catId}`;
        const existing=cache[key]||[];
        const newQs=result[catId]||[];
        // Merge and deduplicate
        const all={};
        existing.forEach(q=>{const h=qHash(q);if(!all[h])all[h]=q});
        newQs.forEach(q=>{const h=qHash(q);if(!all[h])all[h]=q});
        cache[key]=Object.values(all).slice(0,600); // max 600 per category
      });
    }
    done++;
    if(onProgress)onProgress(Math.round((done/batches.length)*100));
  }
  saveCache(cache);
  return getCacheCount();
}

function getQuestions(cats,cid,apiResult,remoteOverlay={}){
  const cache=loadCache();
  const seen=loadSeen();
  const result={};
  
  cats.forEach(c=>{
    let allQs=[];
    if(apiResult&&apiResult[c.id]&&Array.isArray(apiResult[c.id]))allQs=allQs.concat(apiResult[c.id]);
    const ov=(remoteOverlay&&remoteOverlay[cid]&&remoteOverlay[cid][c.id])||null;
    if(ov&&Array.isArray(ov))allQs=allQs.concat(ov);
    const cacheKey=`${cid}_${c.id}`;
    if(cache[cacheKey])allQs=allQs.concat(cache[cacheKey]);
    if(cid==="kw"){
      if(KW[c.id])allQs=allQs.concat(KW[c.id]);
    }else if(GCC_BANKS[cid]?.[c.id]){
      allQs=allQs.concat(GCC_BANKS[cid][c.id]);
    }else if(cid==="general_ar"){
      if(GEN_AR[c.id])allQs=allQs.concat(GEN_AR[c.id]);
      if(FALLBACK_AR[c.id])allQs=allQs.concat(FALLBACK_AR[c.id]);
    }else if(cid==="general_en"){
      if(GEN[c.id])allQs=allQs.concat(GEN[c.id]);
      if(FALLBACK_EN[c.id])allQs=allQs.concat(FALLBACK_EN[c.id]);
    }
    
    const unique={};
    allQs.forEach(q=>{if(q&&q.q&&q.o){const h=qHash(q);if(!unique[h])unique[h]=q}});
    const allUnique=Object.values(unique);
    const unseen=allUnique.filter(q=>!seen.has(qHash(q)));
    const pick=unseen.length>=6?unseen:allUnique;
    const tiers=splitQuestionsByDifficulty(pick);
    result[c.id]=tiers;
    for(const tier of["easy","mid","hard"]){
      for(const q of tiers[tier])seen.add(qHash(q));
    }
    
    // Update cache
    cache[cacheKey]=allUnique.slice(0,900);
  });
  
  saveSeen(seen);
  saveCache(cache);
  return result;
}
/* ═══════ MAIN ═══════ */
export default function Qadha(){
  const[country,setCountry]=useState(COUNTRIES[0]);
  const[sc,setSc]=useState("splash");
  const[mode,setMode]=useState("1v1");
  const[matchName,setMatchName]=useState("");
  const[p1,setP1]=useState("");const[p2,setP2]=useState("");
  const[t1,setT1]=useState("");const[t2,setT2]=useState("");
  const[selCats,setSelCats]=useState([]);const[catQ,setCatQ]=useState("");const[countryQ,setCountryQ]=useState("");
  const[used,setUsed]=useState({});const[active,setActive]=useState(1);const[scores,setScores]=useState([0,0]);
  const[curQ,setCurQ]=useState(null);const[curPts,setCurPts]=useState(0);
  const[timer,setTimer]=useState(45);const[answered,setAnswered]=useState(false);const[selA,setSelA]=useState(null);
  const[revealed,setRevealed]=useState(false);const[firstWrong,setFirstWrong]=useState(null);
  const[typedAns,setTypedAns]=useState("");
  const[hard,setHard]=useState(false);const[qBank,setQBank]=useState({});const[usedQI,setUsedQI]=useState({});
  const[loading,setLoading]=useState(false);const[loadProg,setLoadProg]=useState(0);
  const[onlineSession,setOnlineSession]=useState(null);
  const[micOn,setMicOn]=useState(false);
  const[catsMicStream,setCatsMicStream]=useState(null);
  const[openCatGroupIdx,setOpenCatGroupIdx]=useState(0);
  const[remoteOverlay,setRemoteOverlay]=useState(()=>readCachedOverlayMeta().overlay);
  const matchQHashesRef=useRef(new Map());
  const nextSetupBtnRef=useRef(null);
  const scRef=useRef(sc);
  const micStreamRef=useRef(null);
  const[themeMode,setThemeMode]=useState(()=>{try{const s=localStorage.getItem("qadha_theme");if(s==="calm"||s==="night"||s==="light")return s}catch{/* ignore */}return"night"});
  const prefetchRef=useRef({done:new Set()});
  const tRef=useRef(null);const bRef=useRef(false);
  const wipeQuestionCachesAfterGame=useCallback(()=>{
    clearQuestionCachesFromStorage();
    prefetchRef.current.done.clear();
  },[]);

  useEffect(()=>{try{localStorage.setItem("qadha_theme",themeMode)}catch{/* ignore */}},[themeMode]);
  useEffect(()=>{document.documentElement.lang="ar";document.documentElement.dir="rtl"},[]);
  useEffect(()=>{void syncContentOverlayFromServer().then(({overlay})=>setRemoteOverlay(overlay||{}))},[]);
  useEffect(()=>{scRef.current=sc},[sc]);

  const isOnlineHost=onlineSession?.isHost===true;
  const isOnlineGuest=Boolean(onlineSession)&&!onlineSession.isHost;
  const liveRoom=useRoomChannel(
    onlineSession?.code||"",
    onlineSession?.voiceToken||"",
    Boolean(onlineSession?.code&&onlineSession?.voiceToken),
  );
  const voiceSignalTransport=useMemo(
    ()=>(liveRoom.connected?{subscribe:liveRoom.subscribeSignals,send:liveRoom.sendSignal}:null),
    [liveRoom.connected,liveRoom.subscribeSignals,liveRoom.sendSignal],
  );
  const fetchVoicePeers=useCallback(async()=>{
    const ps=liveRoom.room?.players;
    if(Array.isArray(ps)&&ps.length)return ps.map(p=>p.id);
    const data=await getRoom(onlineSession?.code||"");
    return(data.players||[]).map(p=>p.id);
  },[liveRoom.room,onlineSession?.code]);
  const voiceSessReady=Boolean(
    onlineSession?.code&&onlineSession?.playerId&&onlineSession?.voiceToken,
  );
  const {remoteStreams}=useVoiceMesh({
    roomCode:onlineSession?.code||"",
    selfId:onlineSession?.playerId||"",
    authToken:onlineSession?.voiceToken||"",
    enabled:voiceSessReady&&sc==="cats"&&micOn&&!!catsMicStream,
    localStream:catsMicStream,
    signalTransport:voiceSignalTransport,
    fetchPeerIds:fetchVoicePeers,
  });
  const voiceRemoteList=useMemo(()=>Array.from(remoteStreams.entries()),[remoteStreams]);

  useEffect(()=>()=>{
    if(micStreamRef.current){
      micStreamRef.current.getTracks().forEach(tr=>tr.stop());
      micStreamRef.current=null;
    }
    setCatsMicStream(null);
  },[]);

  useEffect(()=>{
    if(sc==="cats")return;
    if(micStreamRef.current){
      micStreamRef.current.getTracks().forEach(tr=>tr.stop());
      micStreamRef.current=null;
    }
    setCatsMicStream(null);
    setMicOn(false);
  },[sc]);

  // ثلاثة أنماط: هادئ، ليلي، فاتح — ألوان نص وأيقونات متناسقة
  const THEMES={
    night:{
      bg:"linear-gradient(155deg,#0F0F1A,#1A1030 40%,#0F0F1A 70%,#0A0A14)",
      card:"rgba(20,15,40,.88)",cardBd:"rgba(168,85,247,.15)",
      text:"#F0F0F5",textDim:"rgba(255,255,255,.42)",textDim2:"rgba(255,255,255,.22)",
      accent:"#C4B5FD",accentRgb:"196,181,253",accentDim:"rgba(196,181,253,.28)",
      gold:"#E8D48A",goldGlow:"0 0 40px rgba(232,212,138,.35)",
      input:"rgba(255,255,255,.06)",inputBd:"rgba(196,181,253,.22)",
      btnBg:"linear-gradient(135deg,#A855F7,#7C3AED,#A855F7)",btnText:"#FFF",
      btn2Bg:"rgba(255,255,255,.05)",btn2Hover:"rgba(196,181,253,.12)",
      badge:"rgba(15,15,30,.92)",gridCell:"rgba(255,255,255,.02)",
      scoreTxt:"#F0F0F5",placeholder:"rgba(255,255,255,.32)",
      catMuted:"rgba(255,255,255,.48)",      gridPts:"#C4B5FD",iconGlow:"rgba(196,181,253,.15)",
    },
    light:{
      bg:"linear-gradient(155deg,#FAFAF8,#F0EDE6 45%,#F7F4ED 72%,#FCFBF8)",
      card:"rgba(255,255,255,.94)",cardBd:"rgba(91,33,182,.1)",
      text:"#1E1530",textDim:"rgba(30,21,48,.52)",textDim2:"rgba(30,21,48,.28)",
      accent:"#6D28D9",accentRgb:"109,40,217",accentDim:"rgba(109,40,217,.18)",
      gold:"#A16207",goldGlow:"0 0 28px rgba(161,98,7,.22)",
      input:"rgba(255,255,255,.95)",inputBd:"rgba(109,40,217,.15)",
      btnBg:"linear-gradient(135deg,#7C3AED,#5B21B6,#7C3AED)",btnText:"#FFF",
      btn2Bg:"rgba(109,40,217,.06)",btn2Hover:"rgba(109,40,217,.12)",
      badge:"rgba(255,255,255,.97)",gridCell:"rgba(0,0,0,.025)",
      scoreTxt:"#1E1530",placeholder:"rgba(30,21,48,.35)",
      catMuted:"#5B21B6",      gridPts:"#6D28D9",iconGlow:"rgba(109,40,217,.08)",
    },
    calm:{
      bg:"linear-gradient(160deg,#E8F2EE,#DCEAE3 42%,#E6F0EA 68%,#EDF5F0)",
      card:"rgba(255,255,255,.9)",cardBd:"rgba(74,124,106,.14)",
      text:"#243A32",textDim:"rgba(36,58,50,.5)",textDim2:"rgba(36,58,50,.26)",
      accent:"#3D6B5A",accentRgb:"61,107,90",accentDim:"rgba(61,107,90,.2)",
      gold:"#9A7B4F",goldGlow:"0 0 26px rgba(154,123,79,.2)",
      input:"rgba(255,255,255,.92)",inputBd:"rgba(61,107,90,.18)",
      btnBg:"linear-gradient(135deg,#4A7C6A,#3D6B5A,#4A7C6A)",btnText:"#FAFDFB",
      btn2Bg:"rgba(61,107,90,.07)",btn2Hover:"rgba(61,107,90,.14)",
      badge:"rgba(255,255,255,.93)",gridCell:"rgba(61,107,90,.04)",
      scoreTxt:"#243A32",placeholder:"rgba(36,58,50,.32)",
      catMuted:"#4A6B5E",gridPts:"#3D6B5A",iconGlow:"rgba(61,107,90,.1)",
    },
  };
  const th=THEMES[themeMode];
  const isNight=themeMode==="night";
  function CatIcon({cat,sz=64}){
    const fs=Math.round(Math.max(54,Math.min(132,sz*1.38)));
    return(
      <span
        className="catEmojiSolo"
        style={{fontSize:fs,lineHeight:1,display:"block"}}
        aria-hidden
      >
        {cat.icon}
      </span>
    );
  }

  const tx = T.ar;
  const rtl = true;

  useEffect(()=>{
    if((sc!=="menu"&&sc!=="cats")||!anthropicMessagesUrl||anthropicRemoteDisabled)return;
    if(prefetchRef.current.done.has(country.id))return;
    prefetchRef.current.done.add(country.id);
    void bulkDownload(country,null);
  },[sc,country]);

  const go=useCallback(s=>{sfx.stop();setSc(s);setTimeout(()=>{sfx.init();sfx.isAr=rtl},200)},[rtl]);

  useEffect(()=>{
    if(sc!=="cats"||!isOnlineHost||!onlineSession?.hostToken)return;
    const code=onlineSession.code;
    const token=onlineSession.hostToken;
    let cancelled=false;
    const t=setTimeout(()=>{void (async()=>{
      try{
        const data=await getRoom(code);
        if(cancelled)return;
        const prev=data.gameState&&typeof data.gameState==="object"?data.gameState:{};
        const gameState={...prev,phase:"cats",countryId:country.id,selCatIds:selCats.map(c=>c.id)};
        try{
          await putRoomState(code,token,{clientRev:data.rev,gameState});
        }catch(e){
          const m=String(e.message||e);
          if(m==="rev_conflict"||m.includes("409")){
            const d2=await getRoom(code);
            if(!cancelled)await putRoomState(code,token,{clientRev:d2.rev,gameState});
          }
        }
      }catch{/* ignore */}
    })()},320);
    return()=>{cancelled=true;clearTimeout(t)};
  },[sc,isOnlineHost,onlineSession?.code,onlineSession?.hostToken,country.id,selCats]);

  useEffect(()=>{
    if(!onlineSession||isOnlineHost||(sc!=="cats"&&sc!=="setup"))return;
    const gs=liveRoom.room?.gameState;
    if(!gs||typeof gs!=="object")return;
    if(gs.countryId){
      const nc=COUNTRIES.find(x=>x.id===gs.countryId);
      if(nc)setCountry(nc);
    }
    if(Array.isArray(gs.selCatIds)){
      const next=gs.selCatIds.map(id=>CATS.find(k=>k.id===id)).filter(Boolean);
      setSelCats(next);
    }
    if(gs.phase==="setup"&&scRef.current==="cats")go("setup");
  },[onlineSession,isOnlineHost,sc,liveRoom.room,go]);

  useEffect(()=>{if(sc==="splash"){const t=setTimeout(()=>go("menu"),2800);return()=>clearTimeout(t)}},[sc,go]);

  useEffect(()=>{
    if(sc==="question"&&!answered&&curQ){
      tRef.current=setInterval(()=>{setTimer(p=>{
        if(p<=1){clearInterval(tRef.current);sfx.stop();sfx.wrong();setAnswered(true);if(!bRef.current){bRef.current=true;setTimeout(()=>{sfx.steal();setAnswered(false);setSelA(null);setActive(v=>v===1?2:1);setTimer(45)},2000)}else{setRevealed(true);setTimeout(()=>{bRef.current=false;setRevealed(false);setFirstWrong(null);go("grid")},2500)}return 0}
        if(p===11){sfx.stop()}
        if(p<=6)sfx.tick(true);else if(p<=15)sfx.tick(false);
        return p-1})},1000);
      return()=>{clearInterval(tRef.current);sfx.stop()};
    }
  },[sc,curQ,answered,go]);

  const doAns=idx=>{
    if(answered)return;clearInterval(tRef.current);sfx.stop();setAnswered(true);setSelA(idx);
    if(idx===curQ.a){sfx.correct();setRevealed(true);setScores(p=>{const n=[...p];n[active-1]+=curPts;return n});setTimeout(()=>{bRef.current=false;setRevealed(false);setFirstWrong(null);go("grid")},1800)}
    else{sfx.wrong();if(!bRef.current){setFirstWrong(idx);bRef.current=true;setTimeout(()=>{sfx.steal();setAnswered(false);setSelA(null);setActive(v=>v===1?2:1);setTimer(45)},2000)}else{setRevealed(true);setTimeout(()=>{bRef.current=false;setRevealed(false);setFirstWrong(null);go("grid")},2500)}}
  };

  const openQ=(ci,ri)=>{
    const k=`${ci}-${ri}`;if(used[k])return;sfx.click();setUsed(p=>({...p,[k]:true}));
    const catId=selCats[ci].id;
    const tier=rowTierFromRi(ri);
    const pack=qBank[catId];
    let qs=[];
    if(pack&&typeof pack==="object"&&!Array.isArray(pack)&&Array.isArray(pack.easy)){
      qs=pack[tier]||[];
      if(!qs.length)qs=[...(pack.easy||[]),...(pack.mid||[]),...(pack.hard||[])];
    }else if(Array.isArray(pack))qs=pack;
    if(qs.length>0){
      const prev=usedQI[catId]||{easy:[],mid:[],hard:[]};
      const usedArr=Array.isArray(prev[tier])?prev[tier]:[];
      const us=new Set(usedArr);
      const hFor=i=>qHash(qs[i]);
      const map=matchQHashesRef.current;
      let hset=map.get(catId)||new Set();
      let candidates=qs.map((_,i)=>i).filter(i=>!us.has(i)&&!hset.has(hFor(i)));
      if(!candidates.length)candidates=qs.map((_,i)=>i).filter(i=>!hset.has(hFor(i)));
      if(!candidates.length){hset=new Set();map.set(catId,hset);candidates=qs.map((_,i)=>i).filter(i=>!us.has(i));}
      if(!candidates.length)candidates=qs.map((_,i)=>i);
      const pi=candidates[Math.floor(Math.random()*candidates.length)];
      hset.add(hFor(pi));map.set(catId,hset);
      const nu=new Set(us);nu.add(pi);
      setUsedQI(p=>{
        const base={easy:[],mid:[],hard:[]};
        const cur={...base,...p[catId]};
        return{...p,[catId]:{...cur,[tier]:[...nu]}};
      });
      setCurQ(shufQ(qs[pi]));
    }else{setCurQ({q:"?",o:["A","B","C","D"],a:0})}
    setCurPts(PTS[ri]);setAnswered(false);setSelA(null);bRef.current=false;setRevealed(false);setFirstWrong(null);setTimer(PTS_TIMER[ri]??45);setTypedAns("");go("question");
  };
  const checkTyped=()=>{
    if(answered||!curQ||!typedAns.trim())return;
    clearInterval(tRef.current);sfx.stop();setAnswered(true);
    const correct=curQ.o[curQ.a].trim().toLowerCase().replace(/[^\w\u0600-\u06FF\s]/g,"");
    const typed=typedAns.trim().toLowerCase().replace(/[^\w\u0600-\u06FF\s]/g,"");
    const isMatch=correct===typed||correct.includes(typed)||typed.includes(correct)||(typed.length>2&&correct.startsWith(typed.substring(0,Math.ceil(typed.length*0.6))));
    if(isMatch){
      sfx.correct();setRevealed(true);setScores(p=>{const n=[...p];n[active-1]+=curPts;return n});
      setTimeout(()=>{bRef.current=false;setRevealed(false);setFirstWrong(null);go("grid")},2000);
    }else{
      sfx.wrong();
      if(!bRef.current){bRef.current=true;setTimeout(()=>{sfx.steal();setAnswered(false);setSelA(null);setTypedAns("");setActive(v=>v===1?2:1);setTimer(45)},2000)}
      else{setRevealed(true);setTimeout(()=>{bRef.current=false;setRevealed(false);setFirstWrong(null);go("grid")},2500)}
    }
  };
  const startGame=async()=>{
    if(selCats.length!==8)return;sfx.click();sfx.stop();matchQHashesRef.current=new Map();setLoading(true);setLoadProg(0);
    const pi=setInterval(()=>setLoadProg(p=>Math.min(p+Math.random()*6+2,92)),400);
    const r=await genQs(selCats,country);clearInterval(pi);setLoadProg(100);
    const questions=getQuestions(selCats,country.id,r,remoteOverlay);
    setQBank(questions);
    setTimeout(()=>{setLoading(false);setScores([0,0]);setUsed({});setUsedQI({});setActive(1);go("grid")},500);
  };

  const isDone=Object.keys(used).length>=48;
  useEffect(()=>{if(sc==="grid"&&isDone){setTimeout(()=>{wipeQuestionCachesAfterGame();scores[0]>scores[1]?sfx.victory():sfx.defeat();go("results")},600)}},[sc,isDone,scores,go,wipeQuestionCachesAfterGame]);

  const tn=n=>mode==="1v1"?(n===1?(p1||`${tx.player} 1`):(p2||`${tx.player} 2`)):(n===1?(t1||`${tx.team} 1`):(t2||`${tx.team} 2`));
  const turnLabel=n=>(country.lang==="ar"?`${tn(n)} ${T.ar.turn.trim()}`:`${tn(n)}${T.en.turn}`);
  const stealBanner=`${country.lang==="ar"?T.ar.bounce:T.en.bounce} ${country.lang==="ar"?`${tn(active)} ${T.ar.steal}`:`${tn(active)} ${T.en.steal}`}`;
  const fCats=catQ?CATS.filter(c=>c.n.toLowerCase().includes(catQ.toLowerCase())||c.ar.includes(catQ)):CATS;
  const fCountries=countryQ?COUNTRIES.filter(c=>c.name.toLowerCase().includes(countryQ.toLowerCase())||c.native.includes(countryQ)):COUNTRIES;
  const selSet=new Set(selCats.map(c=>c.id));
  const togCat=useCallback(cat=>{
    if(onlineSession&&!onlineSession.isHost)return;
    setSelCats(p=>p.find(c=>c.id===cat.id)?p.filter(c=>c.id!==cat.id):p.length>=8?p:[...p,cat]);
  },[onlineSession]);
  const toggleCatsMic=useCallback(async()=>{
    if(micStreamRef.current){
      micStreamRef.current.getTracks().forEach(tr=>tr.stop());
      micStreamRef.current=null;
      setCatsMicStream(null);
      setMicOn(false);
      return;
    }
    try{
      const s=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      micStreamRef.current=s;
      setCatsMicStream(s);
      setMicOn(true);
    }catch{
      alert("تعذر فتح المايك. اسمح باستخدام الميكروفون من إعدادات المتصفح.");
    }
  },[]);
  const catRows=useMemo(()=>groupCatsForUi(fCats),[fCats]);
  useEffect(()=>{setOpenCatGroupIdx(0)},[country.id]);
  useEffect(()=>{setOpenCatGroupIdx(i=>{const m=Math.max(0,catRows.length-1);return Math.min(i,m)})},[catRows.length]);
  useEffect(()=>{
    if(sc!=="cats"||selCats.length!==8)return;
    const el=nextSetupBtnRef.current;
    if(!el)return;
    requestAnimationFrame(()=>{try{el.scrollIntoView({behavior:"smooth",block:"center"});el.focus({preventScroll:true})}catch{/* ignore */}});
  },[sc,selCats.length]);
  const flowSteps=[
    {sc:"menu",ic:"🏠",lb:"الرئيسية"},
    {sc:"cats",ic:"🎯",lb:"الدولة والفئات"},
    {sc:"setup",ic:"⚙️",lb:"الفريق"},
  ];

  const W={width:"100%",minHeight:"min(100dvh,100svh)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxSizing:"border-box",paddingLeft:"env(safe-area-inset-left,0px)",paddingRight:"env(safe-area-inset-right,0px)"};
  const WScroll={width:"100%",minHeight:"min(100dvh,100svh)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",boxSizing:"border-box",paddingLeft:"env(safe-area-inset-left,0px)",paddingRight:"env(safe-area-inset-right,0px)"};
  const P={width:"100%",maxWidth:"min(820px,100%)",padding:"max(16px,env(safe-area-inset-top)) max(min(26px,5.5vw),env(safe-area-inset-left,0px),env(safe-area-inset-right,0px)) max(28px,env(safe-area-inset-bottom))",margin:0,boxSizing:"border-box",display:"flex",flexDirection:"column",alignItems:"stretch"};
  const Pwide={...P,maxWidth:"min(1080px,100%)"};
  const PScroll={...P,flex:1,minHeight:0,justifyContent:"flex-start"};
  const PwideScroll={...Pwide,flex:1,minHeight:0,justifyContent:"flex-start"};

  return(
    <div style={{...W,width:"100%",background:th.bg,color:th.text,direction:rtl?"rtl":"ltr",fontWeight:700}} onClick={()=>sfx.init()}>
      <style>{`
*{box-sizing:border-box;margin:0;padding:0;font-family:'Tajawal','Poppins',sans-serif;color:inherit;-webkit-tap-highlight-color:transparent;font-weight:700}
button{touch-action:manipulation;-webkit-touch-callout:none;user-select:none}
@keyframes cb{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-6px) rotate(3deg)}}
@keyframes gl{0%,100%{box-shadow:0 0 15px ${th.accentDim}}50%{box-shadow:0 0 35px ${th.accent}66}}
@keyframes pl{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes ldA{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}
.ld{display:inline-block;width:9px;height:9px;border-radius:50%;background:${th.gold};margin:0 5px;animation:ldA 1.2s ease-in-out infinite}
.tl{font-family:'Tajawal',sans-serif;font-weight:800;color:${th.accent};letter-spacing:1px;text-align:center;font-size:clamp(26px,5vw,34px);margin-bottom:12px}
.cat-grid{display:grid;gap:18px;grid-template-columns:repeat(2,1fr);flex:1;min-height:min(54dvh,480px);max-height:calc(100dvh - 260px);overflow-y:auto;padding-bottom:10px;-webkit-overflow-scrolling:touch}
@media(min-width:520px){.cat-grid{grid-template-columns:repeat(3,1fr);gap:20px;min-height:min(50dvh,520px)}}
@media(min-width:720px){.cat-grid{grid-template-columns:repeat(3,1fr);gap:22px}}
.gc{background:${th.card};border:1px solid ${th.cardBd};border-radius:18px;padding:18px;backdrop-filter:blur(8px);box-shadow:0 4px 16px rgba(0,0,0,.09)}
.hov{transition:all .3s;border:2px solid ${th.cardBd}!important;cursor:pointer}.hov:hover{border-color:${th.accent}!important;transform:translateY(-2px)}
.bg{background:${th.btnBg};color:${th.btnText};border:2px solid ${th.accent};padding:16px 32px;font-family:'Tajawal',sans-serif;font-weight:800;font-size:17px;border-radius:14px;cursor:pointer;transition:all .3s;letter-spacing:1px}
.bg:hover{transform:translateY(-2px);box-shadow:0 8px 28px ${th.accentDim}}.bg:active{transform:translateY(0)}
.bs{background:${th.btn2Bg};color:${th.accent};border:1.5px solid ${th.accentDim};padding:14px 26px;font-family:'Tajawal',sans-serif;font-weight:600;font-size:14px;border-radius:14px;cursor:pointer;transition:all .3s;letter-spacing:0.5px}
.bs:hover{background:${th.btn2Hover};border-color:${th.accent}}
.sm{padding:10px 16px;font-size:13px}
.lb{font-size:12px;color:${th.accent};font-weight:600;margin-bottom:6px;display:block;letter-spacing:1px}
.inp{width:100%;background:${th.input};border:1px solid ${th.inputBd};border-radius:14px;padding:15px 18px;color:${th.text};font-size:17px;outline:none;transition:border .3s}
.inp:focus{border-color:${th.accent}!important;box-shadow:0 0 10px ${th.accentDim}}
.inp::placeholder{color:${th.placeholder}}
.gcl{transition:all .3s;cursor:pointer}.gcl:hover{transform:scale(1.08)!important;box-shadow:0 0 14px ${th.accentDim}!important;z-index:2}
.ob{transition:all .3s;cursor:pointer}.ob:hover{transform:translateY(-2px);box-shadow:0 4px 14px ${th.accentDim}}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${th.accentDim};border-radius:2px}
.catsSteps{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.catsStepBtn{background:transparent;border:none;cursor:pointer;padding:4px 4px}
.catsStepCircle{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;margin:0 auto 4px;border:2px solid transparent;transition:background .2s,box-shadow .2s,border-color .2s}
.catsStepLbl{display:block;font-size:9px;font-family:'Tajawal',sans-serif;line-height:1.2;max-width:72px}
.catsBody{max-width:920px;margin:0 auto;width:100%}
.catsTitle{font-family:'Tajawal',sans-serif;font-size:clamp(22px,5.2vw,30px);font-weight:900;text-align:center;margin:0 0 6px}
.catsSub{text-align:center;font-size:13px;margin-bottom:14px;font-family:'Tajawal',sans-serif}
.catsSearchRow{display:flex;direction:rtl;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:18px}
.catsSearchInp{flex:1;border:none;font-size:16px;padding:14px 16px;font-family:'Tajawal',sans-serif;outline:none}
.catsSearchBtn{width:52px;min-width:52px;border:none;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:filter .15s,opacity .15s}
.catsSearchBtn:hover{filter:brightness(1.06)}
.catsSection{border-radius:18px;padding:14px 12px 16px;margin-bottom:16px}
.catsSectionTag{display:inline-block;font-size:11px;font-weight:800;padding:6px 12px;border-radius:10px;margin-bottom:12px;font-family:'Tajawal',sans-serif}
.catsCardGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}
@media(min-width:520px){.catsCardGrid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:800px){.catsCardGrid{grid-template-columns:repeat(4,1fr)}}
.catsCard{position:relative;border-radius:14px;overflow:hidden;cursor:pointer;text-align:center;padding:0;transition:transform .15s,box-shadow .15s,border-color .15s;font-family:'Tajawal',sans-serif}
.catsCard:not(.catsCardLocked):hover{transform:translateY(-2px)}
.catsCardLocked{opacity:.34!important;pointer-events:none!important;filter:grayscale(.4) brightness(.92);cursor:default!important;transform:none!important}
.catsCardLocked .catsCardInfo{pointer-events:none;opacity:.5}
.catsCardInfo{position:absolute;top:7px;inset-inline-end:7px;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:900;line-height:22px;font-style:italic;font-family:Georgia,serif;z-index:2;border:none;cursor:pointer;padding:0}
.catsCardBody{padding:16px 10px 14px;min-height:clamp(124px,28vw,158px);display:flex;flex-direction:column;align-items:center;justify-content:center}
.catsCardEmoji,.catsChipEmoji,.catEmojiSolo{font-family:"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",system-ui,sans-serif;line-height:1}
.catsCardEmoji{font-size:clamp(64px,18vw,102px);display:block;-webkit-filter:drop-shadow(0 2px 5px rgba(15,23,42,.22));filter:drop-shadow(0 2px 5px rgba(15,23,42,.22))}
.catsCardBody .emj{font-size:clamp(48px,12vw,68px);line-height:1}
.catsChipEmoji{font-size:clamp(44px,11vw,64px);display:block;-webkit-filter:drop-shadow(0 2px 3px rgba(15,23,42,.16));filter:drop-shadow(0 2px 3px rgba(15,23,42,.16))}
.catsCardFoot{font-size:11px;font-weight:800;padding:10px 6px;line-height:1.35;min-height:42px;display:flex;align-items:center;justify-content:center}
.catsChipRow{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:14px 0;min-height:48px}
.catsChip{border-radius:14px;padding:12px 14px 14px;min-width:76px;min-height:82px;cursor:pointer;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;transition:border-color .15s,box-shadow .15s}
.catsChipSlot{width:76px;height:82px;border-radius:14px;border-width:2px;border-style:dashed}
.catsStepCircle{background:${th.gridCell};border-color:${th.cardBd}}
.catsStepBtn:hover .catsStepCircle{background:${th.accentDim}}
.catsStepBtn.catsStepOn .catsStepCircle{background:${th.accentDim};border-color:${th.accent};box-shadow:0 0 0 2px ${th.accentDim}}
.catsStepLbl{color:${th.textDim}}
.catsStepBtn.catsStepOn .catsStepLbl{color:${th.accent};font-weight:800}
.catsTitle{color:${th.text}}
.catsSub{color:${th.textDim}}
.catsSearchRow{background:${th.input};border:1px solid ${th.inputBd}}
.catsSearchInp{background:${th.input};color:${th.text}}
.catsSearchInp::placeholder{color:${th.placeholder}}
.catsSearchBtn{background:${th.btnBg};color:${th.btnText}}
.catsSection{background:${th.card};border:1px solid ${th.cardBd}}
.catsSectionTag{background:${th.btnBg};color:${th.btnText};box-shadow:0 2px 14px ${th.accentDim}}
.catsCard{background:${th.card};border:1px solid ${th.cardBd}}
.catsCard.catsCardSel{border-color:${th.accent}!important;box-shadow:0 0 0 4px ${th.accentDim},0 8px 28px ${th.accentDim}!important;background:linear-gradient(165deg,rgba(${th.accentRgb},.14),rgba(${th.accentRgb},.04))!important;transform:scale(1.02)}
.catsNextReady{animation:pl .55s ease 2;box-shadow:0 0 0 3px ${th.accentDim},0 8px 28px ${th.accentDim}!important}
.catsCardInfo{background:rgba(${th.accentRgb},.9);color:${th.btnText}}
.catsCardFoot{background:${th.btnBg};color:${th.btnText}}
.catsChip{background:${th.card};border:2px solid ${th.cardBd}}
.catsChip:hover{border-color:${th.accent}}
.catsChip.catsChipOn{border-color:${th.accent}!important;box-shadow:0 0 0 3px ${th.accentDim},inset 0 0 20px rgba(${th.accentRgb},.12)!important;transform:scale(1.06)}
.catsChipSlot{border-color:${th.textDim2}}
.catGroupTabBar{display:flex;gap:8;overflow-x:auto;padding:4px 2px 14px;margin-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.catGroupTab{flex-shrink:0;padding:10px 14px;border-radius:14px;font-size:12px;font-weight:700;font-family:'Tajawal',sans-serif;cursor:pointer;white-space:nowrap;border:1px solid ${th.cardBd};background:${th.card};color:${th.textDim};transition:background .2s,border-color .2s,color .2s}
.catGroupTab:hover{color:${th.accent};border-color:${th.accentDim}}
.catGroupTabOn{background:${th.accentDim};border-color:${th.accent};color:${th.accent};box-shadow:0 0 0 2px ${th.accentDim}}
@media (max-width:520px){.qadha-below-badge{padding-top:calc(env(safe-area-inset-top,0px) + 56px)!important}}
@media (max-width:480px) and (orientation:portrait){
.cat-grid{min-height:min(36dvh,300px);max-height:calc(100dvh - 175px);gap:12px;padding-bottom:max(12px,env(safe-area-inset-bottom))}
.catsCardBody{min-height:clamp(92px,22vw,128px);padding:12px 8px 10px}
.catsCardEmoji{font-size:clamp(48px,14vw,76px)}
.catsCardFoot{font-size:10px;min-height:36px;padding:8px 4px}
.catsStepLbl{font-size:10px;max-width:88px}
.catsStepCircle{width:42px;height:42px;font-size:16px}
.grid-cat-lbl{font-size:8px!important;line-height:1.2!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
.grid-header-row{flex-wrap:wrap;gap:6px}
.grid-header-row>div{min-width:0}
}
@media (max-width:420px){.qadha-hard-row{flex-direction:column!important;align-items:stretch!important}.qadha-hard-row .bg{width:100%;box-sizing:border-box}}
`}</style>
      {sc!=="splash"&&sc!=="online"&&!loading&&<div style={{position:"fixed",top:"max(10px, env(safe-area-inset-top, 0px))",[rtl?"left":"right"]:10,zIndex:999,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",maxWidth:"min(96vw,420px)",background:th.badge,border:`1px solid ${th.cardBd}`,borderRadius:24,padding:"12px 16px"}}><span style={{fontSize:28,lineHeight:1}}>{country.flag}</span><span style={{fontSize:12,color:th.accent,fontWeight:700}}>{BI.langBadge}</span><div style={{display:"flex",gap:6,marginInlineStart:8}} role="group" aria-label={BI.themeAria}>{[{k:"calm",i:"🌿",t:BI.themeCalm},{k:"night",i:"🌙",t:BI.themeNight},{k:"light",i:"☀️",t:BI.themeLight}].map(({k,i,t})=>(<button key={k} type="button" title={t} onClick={()=>{sfx.click();setThemeMode(k)}} style={{background:themeMode===k?`rgba(${th.accentRgb},.2)`:"transparent",border:`1px solid ${themeMode===k?th.accent:th.cardBd}`,borderRadius:14,padding:"10px 12px",fontSize:24,cursor:"pointer",lineHeight:1}}>{i}</button>))}</div></div>}

      {sc==="splash"&&<div style={{...W,paddingLeft:"max(16px,env(safe-area-inset-left))",paddingRight:"max(16px,env(safe-area-inset-right))",paddingBottom:"max(24px,env(safe-area-inset-bottom))"}}><div style={{textAlign:"center",width:"100%",maxWidth:420}}><div style={{fontSize:"clamp(56px,22vw,92px)",animation:"cb 2s ease-in-out infinite",lineHeight:1}}>👑</div><h1 style={{fontFamily:"'Tajawal',sans-serif",fontSize:"clamp(40px,12vw,96px)",fontWeight:900,color:th.gold,textShadow:th.goldGlow,lineHeight:1.05,margin:"12px 0 0"}}>قدها؟</h1><p style={{fontFamily:"'Tajawal',sans-serif",fontSize:"clamp(14px,3.8vw,16px)",color:th.textDim,letterSpacing:2,marginTop:10,lineHeight:1.5}}>لعبة أسئلة وثقافة</p><div style={{margin:"clamp(24px,8vw,36px) auto",width:96,maxWidth:"40%",height:3,background:`linear-gradient(90deg,transparent,${th.gold},transparent)`}}/><div><span className="ld"/><span className="ld" style={{animationDelay:".2s"}}/><span className="ld" style={{animationDelay:".4s"}}/></div></div></div>}

      {sc==="online"&&(
        <OnlineLobby
          th={th}
          onBack={()=>go("menu")}
          onStartGame={(sess)=>{
            sfx.click();
            if(sess&&typeof sess.code==="string"){
              setOnlineSession({
                code:sess.code.toUpperCase().trim(),
                isHost:!!sess.isHost,
                hostToken:sess.hostToken||null,
                playerId:sess.playerId||(sess.isHost?"host":""),
                voiceToken:sess.voiceToken||"",
              });
            }else{setOnlineSession(null);}
            setSelCats([]);
            go("cats");
          }}
        />
      )}

      {sc==="menu"&&<div style={W} className="qadha-below-badge"><div style={P}>
        <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:"clamp(64px,15vw,100px)",animation:"cb 2s ease-in-out infinite",lineHeight:1}}>👑</div><h1 style={{fontFamily:"'Tajawal',sans-serif",fontSize:"clamp(44px,10vw,64px)",fontWeight:900,color:th.gold,margin:"12px 0 28px"}}>قدها؟</h1><p style={{fontSize:15,color:th.textDim,lineHeight:1.5,maxWidth:400,margin:"0 auto"}}>تطوير: فريق Bojrmakh Q8 — الكويت</p></div>
        <button className="bg" style={{width:"100%",padding:"clamp(20px,4.5vw,26px)",fontSize:"clamp(18px,4vw,22px)",animation:"gl 2s ease-in-out infinite",marginBottom:14,borderRadius:18}} onClick={()=>{sfx.click();setOnlineSession(null);setSelCats([]);go("cats")}}>{tx.start}</button>
        <button type="button" className="bs" style={{width:"100%",padding:16,marginTop:4}} onClick={()=>{sfx.click();go("online")}}>اللعب الجماعي عبر الشبكة</button>
      </div></div>}

      {sc==="country"&&<div style={WScroll} className="qadha-below-badge"><div style={{...PScroll,width:"100%",maxWidth:"min(820px,100%)"}}>
        <h2 className="tl" style={{marginTop:6}}>{tx.country}</h2>
        <input className="inp" placeholder={tx.search} value={countryQ} onChange={e=>setCountryQ(e.target.value)} style={{margin:"16px 0",padding:"18px 20px",fontSize:18,borderRadius:18}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14,flex:1,overflowY:"auto",maxHeight:"calc(100dvh - 240px)",paddingBottom:10}}>{fCountries.map(c=>(<button key={c.id} className="gc hov" style={{display:"flex",alignItems:"center",gap:20,width:"100%",textAlign:rtl?"right":"left",border:country.id===c.id?`3px solid ${th.accent}`:`2px solid ${th.cardBd}`,borderRadius:22,minHeight:112,padding:"20px 22px"}} onClick={()=>{sfx.click();setCountry(c);setSelCats([]);go("cats")}}><span style={{fontSize:"clamp(44px,12vw,58px)",lineHeight:1}}>{c.flag}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:19,color:th.accent,fontWeight:800,lineHeight:1.35}}>{c.native}</div></div></button>))}</div>
        <button className="bs" style={{width:"100%",marginTop:16,padding:16,fontSize:16}} onClick={()=>go("cats")}>{tx.back}</button>
      </div></div>}

      {sc==="setup"&&<div style={WScroll} className="qadha-below-badge"><div style={{...PScroll,maxWidth:"min(580px,100%)"}}>
        <nav className="catsSteps" aria-label="خطوات اللعبة" style={{marginBottom:18}}>
          {flowSteps.map(s=>(<button key={s.sc} type="button" className={`catsStepBtn${sc===s.sc?" catsStepOn":""}`} onClick={()=>{if(s.sc===sc)return;if(s.sc==="setup"&&selCats.length!==8){sfx.click();return;}sfx.click();go(s.sc)}}>
            <div className="catsStepCircle">{s.ic}</div>
            <span className="catsStepLbl">{s.lb}</span>
          </button>))}
        </nav>
        <h2 className="tl">{tx.setup}</h2>
        {selCats.length!==8&&<p style={{textAlign:"center",fontSize:14,color:th.accent,marginBottom:12,fontFamily:"'Tajawal',sans-serif"}}>ارجع واختر ٨ فئات للمتابعة</p>}
        <p className="lb" style={{marginTop:12,marginBottom:8}}>{tx.mode}</p>
        <div style={{display:"grid",gap:12,marginBottom:18}}>{[["1v1","⚡",tx.duel],["team","👥",tx.teamVs]].map(([m,ic,nm])=>(<button key={m} type="button" className="gc hov" style={{display:"flex",gap:16,alignItems:"center",width:"100%",textAlign:rtl?"right":"left",padding:"18px 20px",borderRadius:20,minHeight:88,border:mode===m?`2px solid ${th.accent}`:undefined}} onClick={()=>{sfx.click();setMode(m)}}><div style={{fontSize:36,width:56,height:56,background:`rgba(${th.accentRgb},.14)`,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{ic}</div><div style={{fontFamily:"'Tajawal',sans-serif",color:th.accent,fontSize:17,fontWeight:800}}>{nm}</div></button>))}</div>
        <div className="gc" style={{display:"flex",alignItems:"center",gap:10,margin:"0 0 16px",padding:"14px 18px"}}><span style={{fontSize:26}}>{country.flag}</span><span style={{fontSize:15,color:th.accent,fontWeight:600}}>{country.native}</span></div>
        <div style={{marginBottom:14}}><label className="lb">{tx.matchN}</label><input className="inp" value={matchName} onChange={e=>setMatchName(e.target.value)}/></div>
        {mode==="1v1"?<div style={{display:"flex",gap:10,marginBottom:14}}><div style={{flex:1}}><label className="lb">{tx.player} 1</label><input className="inp" value={p1} onChange={e=>setP1(e.target.value)}/></div><div style={{flex:1}}><label className="lb">{tx.player} 2</label><input className="inp" value={p2} onChange={e=>setP2(e.target.value)}/></div></div>:<div style={{display:"flex",gap:10,marginBottom:14}}><div style={{flex:1}}><label className="lb">{tx.team} 1</label><input className="inp" value={t1} onChange={e=>setT1(e.target.value)}/></div><div style={{flex:1}}><label className="lb">{tx.team} 2</label><input className="inp" value={t2} onChange={e=>setT2(e.target.value)}/></div></div>}
        <div style={{marginBottom:18}}><label className="lb">{BI.difficulty}</label><div style={{display:"flex",gap:6,marginTop:6}}><button className={!hard?"bg sm":"bs sm"} style={{flex:1}} onClick={()=>setHard(false)}>{BI.normal}</button><button className={hard?"bg sm":"bs sm"} style={{flex:1}} onClick={()=>setHard(true)}>{BI.hard}</button></div></div>
        <button className="bg" style={{width:"100%",padding:18,opacity:selCats.length!==8?0.45:1}} disabled={selCats.length!==8} onClick={()=>{sfx.click();startGame()}}>{tx.startM}</button>
        <button className="bs" style={{width:"100%",marginTop:10}} onClick={()=>go("cats")}>{tx.back}</button>
      </div></div>}

      {sc==="cats"&&<div style={WScroll} className="qadha-below-badge"><div className="catsBody" style={{...PwideScroll,maxWidth:"min(920px,100%)"}}>
        <nav className="catsSteps" aria-label="خطوات اللعبة" style={{marginBottom:16}}>
          {flowSteps.map(s=>(<button key={s.sc} type="button" className={`catsStepBtn${sc===s.sc?" catsStepOn":""}`} onClick={()=>{if(s.sc===sc)return;if(isOnlineGuest&&(s.sc==="setup"||s.sc==="country")){sfx.click();return;}if(s.sc==="setup"&&selCats.length!==8){sfx.click();return;}sfx.click();go(s.sc)}}>
            <div className="catsStepCircle">{s.ic}</div>
            <span className="catsStepLbl">{s.lb}</span>
          </button>))}
        </nav>
        <h2 className="tl" style={{marginBottom:14,textAlign:"center"}}>{tx.country}</h2>
        {onlineSession&&(
          <div className="gc" style={{marginBottom:14,padding:"14px 16px",borderRadius:18,background:isOnlineHost?`rgba(${th.accentRgb},.12)`:th.gridCell,border:`1px solid ${th.cardBd}`}}>
            <p style={{fontSize:13,color:th.text,lineHeight:1.55,textAlign:"center",fontFamily:"'Tajawal',sans-serif"}}>
              {isOnlineHost
                ?"أنت من يختار الدولة والثمان فئات؛ من معك يراها مباشرة."
                :"من معك يختار الدولة والفئات؛ عندما ينتهي يمرّ الجميع لإعداد الفريق."}
            </p>
          </div>
        )}
        {onlineSession&&(
          <div className="gc" style={{position:"relative",marginBottom:16,padding:"14px 16px",borderRadius:18,border:`1px solid ${th.accentDim}`}}>
            <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:12,justifyContent:"center"}}>
              <span style={{fontSize:22}}>🎙️</span>
              <span style={{fontSize:13,color:th.textDim,flex:1,minWidth:200,textAlign:"center",lineHeight:1.5}}>
                تحدث مع من في الغرفة أثناء اختيار الفئات. فعّل المايك على كل جهاز يريد أن يُسمع.
              </span>
              <button type="button" className="bs sm" onClick={()=>{sfx.click();void toggleCatsMic()}}>{micOn?"إيقاف المايك":"تشغيل المايك"}</button>
            </div>
            {micOn&&voiceRemoteList.length>0&&(
              <p style={{fontSize:12,color:th.accent,textAlign:"center",marginTop:10,fontFamily:"'Tajawal',sans-serif"}}>
                صوت من {voiceRemoteList.length} {voiceRemoteList.length===1?"جهاز":"أجهزة"}
              </p>
            )}
            <div aria-hidden="true" style={{position:"absolute",width:0,height:0,overflow:"hidden"}}>
              {voiceRemoteList.map(([rid,stream])=>(
                <audio key={rid} ref={el=>{if(el){el.srcObject=stream;void el.play().catch(()=>{})}}} autoPlay playsInline/>
              ))}
            </div>
          </div>
        )}
        <div className="gc" style={{marginBottom:20,padding:"16px 18px",borderRadius:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:10}}>
            <span style={{fontSize:15,color:th.accent,fontWeight:700}}>{country.native}</span>
            <button type="button" className="bs sm" disabled={isOnlineGuest} style={{opacity:isOnlineGuest?0.45:1}} onClick={()=>{if(isOnlineGuest)return;sfx.click();go("country")}}>{tx.change}</button>
          </div>
          <input className="inp" placeholder={tx.search} value={countryQ} onChange={e=>setCountryQ(e.target.value)} style={{marginBottom:12,padding:"14px 16px"}}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,maxHeight:220,overflowY:"auto"}}>{fCountries.map(c=>(<button key={c.id} type="button" disabled={isOnlineGuest} className="gc hov" style={{padding:"12px 10px",borderRadius:14,border:country.id===c.id?`2px solid ${th.accent}`:`1px solid ${th.cardBd}`,display:"flex",flexDirection:"column",alignItems:"center",gap:6,minHeight:88,opacity:isOnlineGuest?0.55:1,cursor:isOnlineGuest?"not-allowed":"pointer"}} onClick={()=>{if(isOnlineGuest)return;sfx.click();setCountry(c);setSelCats([])}}><span style={{fontSize:32}}>{c.flag}</span><span style={{fontSize:12,fontWeight:700,color:th.text,textAlign:"center",lineHeight:1.2}}>{c.native}</span></button>))}</div>
        </div>
        <h2 className="catsTitle">{tx.cats}</h2>
        <p className="catsSub">{selCats.length}/8 {tx.sel} · {CATS.length} {tx.catWord}</p>
        <div className="catsSearchRow">
          <input className="catsSearchInp" placeholder={tx.search} value={catQ} onChange={e=>setCatQ(e.target.value)} aria-label={tx.search}/>
          <button type="button" className="catsSearchBtn" aria-label="بحث" onClick={()=>sfx.click()}>🔍</button>
        </div>
        {catRows.length>0&&(
          <>
            {catRows.length>1&&<div className="catGroupTabBar" role="tablist" aria-label="أقسام الفئات">
              {catRows.map((row,i)=>(<button key={row.label} type="button" role="tab" aria-selected={i===openCatGroupIdx} className={`catGroupTab${i===openCatGroupIdx?" catGroupTabOn":""}`} onClick={()=>{sfx.click();setOpenCatGroupIdx(i)}}>{row.label}</button>))}
            </div>}
            {(catRows.length===1?catRows:[catRows[Math.min(openCatGroupIdx,catRows.length-1)]]).map(row=>(
              <section key={row.label} className="catsSection">
                <div className="catsSectionTag">{row.label}</div>
                <div className="catsCardGrid">
                  {row.cats.map(cat=>{
                    const sel=selSet.has(cat.id);
                    return(
                      <div key={cat.id} role="button" tabIndex={(selCats.length===8&&!sel)||(isOnlineGuest&&!sel)?-1:0} className={`catsCard${sel?" catsCardSel":""}${(selCats.length===8&&!sel)||(isOnlineGuest&&!sel)?" catsCardLocked":""}`} onPointerDown={()=>togCat(cat)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();togCat(cat)}}}>
                        <button type="button" className="catsCardInfo" title={cat.ar} aria-label="معلومات" onClick={e=>{e.stopPropagation();sfx.click()}}>i</button>
                        <div className="catsCardBody">
                          <span className="catsCardEmoji" aria-hidden>{cat.icon}</span>
                        </div>
                        <div className="catsCardFoot">{cat.ar}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
        <div className="catsChipRow">{selCats.map(cat=><button key={cat.id} type="button" disabled={isOnlineGuest} className={`catsChip${selSet.has(cat.id)?" catsChipOn":""}`} style={{opacity:isOnlineGuest?0.85:1}} onClick={()=>togCat(cat)}><span className="catsChipEmoji" aria-hidden>{cat.icon}</span></button>)}{Array.from({length:8-selCats.length}).map((_,i)=><div key={`e${i}`} className="catsChipSlot"/>)}
        </div>
        <button ref={nextSetupBtnRef} type="button" tabIndex={0} className={`bg${selCats.length===8?" catsNextReady":""}`} style={{width:"100%",padding:18,marginTop:6,opacity:selCats.length!==8||isOnlineGuest?0.45:1}} disabled={selCats.length!==8||isOnlineGuest} onClick={async()=>{sfx.click();if(isOnlineHost&&onlineSession?.hostToken){try{const data=await getRoom(onlineSession.code);const prev=data.gameState&&typeof data.gameState==="object"?data.gameState:{};const gameState={...prev,phase:"setup",countryId:country.id,selCatIds:selCats.map(c=>c.id)};try{await putRoomState(onlineSession.code,onlineSession.hostToken,{clientRev:data.rev,gameState});}catch(e){const m=String(e.message||e);if(m==="rev_conflict"||m.includes("409")){const d2=await getRoom(onlineSession.code);await putRoomState(onlineSession.code,onlineSession.hostToken,{clientRev:d2.rev,gameState:{...(d2.gameState&&typeof d2.gameState==="object"?d2.gameState:{}),phase:"setup",countryId:country.id,selCatIds:selCats.map(c=>c.id)}});}}}catch{/* ignore */}}go("setup")}}>{tx.nextSetup}</button>
        <button type="button" className="bs" style={{width:"100%",marginTop:10}} onClick={()=>{sfx.click();setOnlineSession(null);go("menu")}}>{tx.back}</button>
      </div></div>}

      {loading&&<div style={W} className="qadha-below-badge"><div style={{textAlign:"center",padding:"clamp(28px,8vw,48px) clamp(16px,5vw,48px)"}}><div style={{fontSize:58,animation:"cb 1.5s ease-in-out infinite",marginBottom:20}}>🧠</div><h2 style={{fontFamily:"'Tajawal',sans-serif",color:th.accent,fontSize:22}}>{tx.loading}</h2><div style={{width:"70%",maxWidth:320,height:7,background:th.gridCell,borderRadius:4,margin:"24px auto",overflow:"hidden"}}><div style={{width:`${loadProg}%`,height:"100%",background:`linear-gradient(90deg,${th.accent},${th.gold})`,borderRadius:4,transition:"width .3s"}}/></div><div style={{display:"flex",justifyContent:"center",gap:10,marginTop:16}}><span style={{fontSize:28}}>{country.flag}</span><span style={{fontSize:16,color:th.accent}}>{country.native}</span></div></div></div>}

      {sc==="grid"&&!loading&&<div style={{...W,justifyContent:"flex-start",alignItems:"center",paddingTop:14,width:"100%"}} className="qadha-below-badge"><div style={{width:"100%",maxWidth:"min(1080px,100%)",padding:"12px min(18px,4.5vw) max(16px,env(safe-area-inset-bottom))"}}>
        <div className="grid-header-row" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{textAlign:"center",flex:1}}><div style={{fontSize:15,color:active===1?th.accent:th.textDim2,fontWeight:700}}>{tn(1)}</div><div style={{fontSize:"clamp(32px,7.5vw,42px)",fontWeight:900,fontFamily:"'Tajawal',sans-serif",color:th.scoreTxt}}>{scores[0]}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontFamily:"'Tajawal',sans-serif",fontSize:"clamp(17px,4.2vw,21px)",color:th.accent,fontWeight:700}}>قدها؟ {country.flag}</div><div style={{fontSize:12,color:th.textDim}}>◀ {turnLabel(active)} ▶</div></div>
          <div style={{textAlign:"center",flex:1}}><div style={{fontSize:15,color:active===2?th.accent:th.textDim2,fontWeight:700}}>{tn(2)}</div><div style={{fontSize:"clamp(32px,7.5vw,42px)",fontWeight:900,fontFamily:"'Tajawal',sans-serif",color:th.scoreTxt}}>{scores[1]}</div></div>
        </div>
        <p style={{fontSize:11,color:th.textDim2,textAlign:"center",marginBottom:12,fontFamily:"'Tajawal',sans-serif",lineHeight:1.45}}>{BI.gridTierHint}</p>
        <div style={{display:"grid",gridTemplateColumns:`minmax(46px,auto) repeat(${selCats.length},1fr)`,gap:6,alignItems:"stretch"}}>
          <div aria-hidden style={{minHeight:1}} />
          {selCats.map(cat=>(<div key={cat.id} style={{textAlign:"center",padding:"8px 2px",borderBottom:`2px solid ${cat.c}`,marginBottom:4}}><div style={{display:"flex",justifyContent:"center",alignItems:"center",minHeight:"clamp(52px,16vw,68px)"}}><CatIcon cat={cat} sz={56}/></div><div className="grid-cat-lbl" style={{fontSize:9,fontWeight:900,color:isNight?cat.c:th.catMuted,marginTop:3,lineHeight:1.2}}>{catBi(cat)}</div></div>))}
          {PTS.map((pts,ri)=>(
            <Fragment key={`row-${ri}`}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 4px",textAlign:"center",fontFamily:"'Tajawal',sans-serif",borderRadius:12,background:th.gridCell,border:`1px solid ${th.cardBd}`}}>
                <span style={{fontSize:9,fontWeight:800,color:th.accent,lineHeight:1.2}}>{ptsTierLabelAr(pts)}</span>
                <span style={{fontSize:11,fontWeight:900,color:th.gridPts,marginTop:4}}>{pts}</span>
              </div>
              {selCats.map((cat,ci)=>{const k=`${ci}-${ri}`;const u=used[k];return(<button key={k} type="button" onClick={()=>!u&&openQ(ci,ri)} className={u?"":"gcl"} style={{background:u?th.gridCell:`linear-gradient(135deg,${cat.c}12,${cat.c}06)`,border:`1px solid ${u?th.cardBd:cat.c+"44"}`,borderRadius:12,padding:"15px 5px",cursor:u?"default":"pointer",fontFamily:"'Tajawal',sans-serif",fontSize:"clamp(14px,3.4vw,18px)",fontWeight:900,color:u?th.textDim2:th.gridPts,opacity:u?.25:1}}>{u?"✓":pts}</button>)})}
            </Fragment>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"center",marginTop:12}}><button className="bs sm" onClick={()=>{sfx.click();wipeQuestionCachesAfterGame();scores[0]>scores[1]?sfx.victory():sfx.defeat();go("results")}}>{tx.end}</button></div>
      </div></div>}

      {sc==="question"&&curQ&&<div style={W} className="qadha-below-badge"><div style={{width:"100%",maxWidth:"min(640px,100%)",padding:"14px min(22px,5.5vw) max(20px,env(safe-area-inset-bottom))"}}>
        {bRef.current&&!answered&&<div style={{textAlign:"center",marginBottom:16}}><div style={{display:"inline-block",background:isNight?"rgba(255,138,92,.14)":"rgba(234,88,12,.1)",border:"1px solid rgba(255,138,92,.3)",borderRadius:24,padding:"12px 26px",fontSize:17,color:"#EA580C",fontWeight:700}}>{stealBanner}</div></div>}
        <div style={{display:"flex",justifyContent:"center",marginBottom:20}}><div style={{width:"clamp(92px,24vw,112px)",height:"clamp(92px,24vw,112px)",borderRadius:"50%",background:timer<=10?"linear-gradient(135deg,#EF4444,#DC2626)":timer<=20?"linear-gradient(135deg,#F59E0B,#D97706)":"linear-gradient(135deg,#8E44AD,#A855F7)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Tajawal',sans-serif",fontSize:"clamp(34px,8.5vw,42px)",fontWeight:900,animation:timer<=10?"pl .4s infinite":"none",boxShadow:timer<=10?"0 0 30px rgba(255,59,92,.5)":"0 0 15px rgba(168,85,247,.3)"}}>{timer}</div></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,padding:"0 4px",flexWrap:"wrap",gap:8}}><span style={{fontFamily:"'Tajawal',sans-serif",fontSize:"clamp(20px,4.8vw,26px)",fontWeight:900,color:th.accent}}>{curPts} {tx.pts} · {ptsTierLabelAr(curPts)}</span><span style={{fontSize:15,color:th.textDim}}>{turnLabel(active)}</span></div>
        <div className="gc" style={{textAlign:"center",padding:"clamp(22px,5.5vw,32px) clamp(20px,4.5vw,28px)",marginBottom:20,borderColor:th.cardBd,borderRadius:22}}><p style={{fontSize:"clamp(19px,4.5vw,24px)",fontWeight:800,lineHeight:1.75,color:th.scoreTxt}}>{curQ.q}</p></div>
        {revealed&&selA!==null&&selA!==curQ.a&&!hard&&<div style={{textAlign:"center",marginBottom:12}}><span style={{fontSize:14,color:"#FF8A5C",fontWeight:600}}>{tx.nobody}</span></div>}
        {revealed&&hard&&<div style={{textAlign:"center",marginBottom:12}}><span style={{fontSize:14,color:"#FF8A5C",fontWeight:600}}>{tx.nobody}</span><div style={{fontSize:18,color:"#4ADE80",fontWeight:700,marginTop:8}}>{curQ.o[curQ.a]}</div></div>}
        
        {!hard&&<div style={{display:"flex",flexDirection:"column",gap:16,marginBottom:20,width:"100%"}}>
          {curQ.o.map((opt,i)=>{
            const ic=i===curQ.a;const isSel=i===selA;const isFirst=i===firstWrong;
            let bg=AB[i],bd=AC[i]+"55",col=th.text;
            if(answered){if(ic&&revealed){bg="rgba(74,222,128,.3)";bd="#4ADE80"}else if(isSel&&!ic){bg="rgba(255,59,92,.3)";bd="#FF3B5C"}else if(isFirst&&revealed){bg="rgba(255,59,92,.15)";bd="rgba(255,59,92,.4)"}else if(revealed){bg=th.gridCell;bd=th.cardBd}}
            return(<button key={i} type="button" onClick={()=>doAns(i)} disabled={answered} className={!answered?"ob":""} style={{background:bg,border:`3px solid ${bd}`,borderRadius:20,padding:"20px 22px",fontSize:"clamp(17px,4.2vw,21px)",fontWeight:800,color:col,cursor:answered?"default":"pointer",transition:"all .3s",width:"100%",textAlign:rtl?"right":"left",display:"flex",alignItems:"center",gap:14,minHeight:64}}><span style={{fontWeight:900,color:!answered?AC[i]:undefined,flexShrink:0,fontSize:17,width:32,height:32,borderRadius:11,background:!answered?`${AC[i]}22`:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{["A","B","C","D"][i]}</span><span style={{flex:1,lineHeight:1.35,fontWeight:800}}>{opt}{answered&&ic&&revealed&&<span style={{color:"#16A34A",fontWeight:900}}> ✓</span>}{answered&&isSel&&!ic&&<span style={{color:"#FF3B5C",fontWeight:900}}> ✗</span>}{answered&&isFirst&&revealed&&!isSel&&<span style={{color:"#FF3B5C",opacity:.6}}> ✗</span>}</span></button>)
          })}
        </div>}
        
        {hard&&<div style={{marginBottom:18}}>
          <div className="qadha-hard-row" style={{display:"flex",gap:10}}>
            <input className="inp" style={{flex:1,fontSize:18,padding:"16px 18px"}} placeholder={BI.placeholderAns} value={typedAns} onChange={e=>setTypedAns(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")checkTyped()}} disabled={answered} autoFocus/>
            <button className="bg" style={{padding:"16px 22px",fontSize:16,opacity:answered?.4:1}} onClick={checkTyped} disabled={answered}>✓</button>
          </div>
          {answered&&!revealed&&<div style={{textAlign:"center",marginTop:12,fontSize:15,color:"#FF8A5C"}}>{BI.wrongAns}</div>}
          <div style={{textAlign:"center",marginTop:10,fontSize:12,color:th.textDim}}>🔥 {BI.hardBanner}</div>
        </div>}
      </div></div>}

      {sc==="results"&&<div style={W} className="qadha-below-badge"><div style={P}>
        <div style={{textAlign:"center"}}><div style={{fontSize:76,animation:scores[0]!==scores[1]?"cb 1s ease-in-out infinite":"none",marginBottom:10}}>{scores[0]===scores[1]?"🤝":"🏆"}</div><h1 className="tl" style={{fontSize:28}}>{scores[0]===scores[1]?tx.tie:tx.wins}</h1><p style={{fontFamily:"'Tajawal',sans-serif",fontSize:32,color:th.accent,fontWeight:900,marginBottom:6}}>{scores[0]!==scores[1]?(scores[0]>scores[1]?tn(1):tn(2)):""}</p>        <p style={{fontFamily:"'Tajawal',sans-serif",fontSize:24,color:th.accent,marginBottom:20}}>{scores[0]!==scores[1]?"!قدها":"🤝"}</p></div>
        <div className="gc" style={{marginBottom:20,border:`2px solid ${th.accent}`,borderRadius:20,padding:24,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:4,background:`linear-gradient(90deg,${th.accent},rgba(${th.accentRgb},.5),${th.accent})`}}/><div style={{textAlign:"center",fontSize:11,color:th.textDim,letterSpacing:4,marginBottom:16}}>{tx.vCard}</div><div style={{display:"flex",justifyContent:"space-around",marginBottom:12}}><div style={{textAlign:"center"}}><div style={{fontSize:13,color:th.accent,marginBottom:6}}>{tn(1)}</div><div style={{fontFamily:"'Tajawal',sans-serif",fontSize:46,fontWeight:900,color:scores[0]>=scores[1]?th.accent:th.textDim2}}>{scores[0]}</div></div><div style={{fontFamily:"'Tajawal',sans-serif",fontSize:22,color:th.textDim2,alignSelf:"center"}}>ضد</div><div style={{textAlign:"center"}}><div style={{fontSize:13,color:th.accent,marginBottom:6,opacity:.85}}>{tn(2)}</div><div style={{fontFamily:"'Tajawal',sans-serif",fontSize:46,fontWeight:900,color:scores[1]>=scores[0]?th.accent:th.textDim2}}>{scores[1]}</div></div></div><div style={{textAlign:"center",fontFamily:"'Tajawal',sans-serif",fontSize:14,color:th.textDim2,marginTop:10}}>قدها؟ 👑 {country.flag}</div></div>
        <button className="bg" style={{width:"100%",padding:18,marginBottom:10}} onClick={async()=>{sfx.click();sfx.stop();matchQHashesRef.current=new Map();setLoading(true);setLoadProg(0);const pi=setInterval(()=>setLoadProg(p=>Math.min(p+Math.random()*6+2,92)),400);const r=await genQs(selCats,country);clearInterval(pi);setLoadProg(100);const questions=getQuestions(selCats,country.id,r,remoteOverlay);setQBank(questions);setTimeout(()=>{setLoading(false);setUsed({});setUsedQI({});setScores([0,0]);setActive(1);go("grid")},500)}}>{tx.rematch}</button>
        <button className="bs" style={{width:"100%",padding:16,marginBottom:8}} onClick={()=>{sfx.click();setSelCats([]);go("cats")}}>{tx.newCats}</button>
        <button className="bs" style={{width:"100%",padding:16}} onClick={()=>{setSelCats([]);go("menu")}}>{tx.menu}</button>
      </div></div>}
    </div>
  );
}

