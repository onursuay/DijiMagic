/* Dedike özellik sayfaları içeriği — /tr/ozellikler/<slug> (iyzads tarzı, her modül ayrı tam sayfa).
   Slug = TR slug (URL). İçerik cookie locale'e göre TR/EN. Görsel: FeatureVisual slug eşleşmesi (varsa).
   NOT: Bu dosya kısmen scripts/assemble ile üretildi (içerik), metadata elle. */

export type FeatureContent = {
  title: string
  sub: string
  intro: string
  benefits: { title: string; desc: string }[]
  steps: { title: string; desc: string }[]
  ctaTitle: string
}

export type FeaturePage = {
  slug: string
  group: 'reklam' | 'ai' | 'icerik' | 'yonetim'
  icon: string
  soon?: boolean
  name: { tr: string; en: string }
  tr: FeatureContent
  en: FeatureContent
}

export const GROUP_LABEL: Record<FeaturePage['group'], { tr: string; en: string }> = {
  reklam: { tr: 'Reklam Yönetimi', en: 'Ad Management' },
  ai: { tr: 'Yapay Zeka & Strateji', en: 'AI & Strategy' },
  icerik: { tr: 'İçerik & Üretim', en: 'Content & Creation' },
  yonetim: { tr: 'Yönetim & Büyüme', en: 'Management & Growth' },
}

export const FEATURE_PAGES: FeaturePage[] = [
  {
    "slug": "meta",
    "group": "reklam",
    "icon": "meta",
    "name": {
      "tr": "Meta",
      "en": "Meta"
    },
    "tr": {
      "title": "Meta reklamlarını tek panelden yönet",
      "sub": "DijiMagic; Facebook, Instagram ve WhatsApp kampanyalarını yapay zekâ destekli kurulumla tek panelden başlatmanı ve yönetmeni sağlar. Reklam hesaplarını arasında gezinmek yerine, her şeyi tek yerden kontrol edersin.",
      "intro": "Meta reklamlarını ayrı ayrı uygulamalarda kovalamak zorunda değilsin. DijiMagic; Facebook, Instagram ve WhatsApp kampanyalarını yapay zekâ destekli bir kurulumla tek panelde toplar. Yeni kampanyanı adım adım yönlendirilerek kurar, mevcut reklamlarını aynı yerden izleyip düzenlersin. Karmaşık reklam yöneticisi ekranlarıyla boğuşmadan, hızlıca yayına geçersin.",
      "benefits": [
        {
          "title": "Tek panelden kontrol",
          "desc": "Facebook, Instagram ve WhatsApp kampanyalarını ayrı uygulamalar arasında gezmeden tek ekrandan yönetirsin."
        },
        {
          "title": "Yapay zekâ destekli kurulum",
          "desc": "Kampanyanı adım adım yönlendirilerek kurarsın; teknik ayarlarla tek başına boğuşmazsın."
        },
        {
          "title": "Üç platform bir arada",
          "desc": "Facebook, Instagram ve WhatsApp reklamlarını ayrı hesaplara girip çıkmadan aynı yerden başlatırsın."
        },
        {
          "title": "Başlat ve yönet",
          "desc": "Yeni kampanya açmaktan mevcut reklamlarını düzenlemeye kadar her şeyi tek akışta yaparsın."
        }
      ],
      "steps": [
        {
          "title": "Meta hesabını bağla",
          "desc": "Facebook, Instagram ve WhatsApp reklam hesaplarını DijiMagic paneline güvenle bağlarsın."
        },
        {
          "title": "Kampanyanı kur",
          "desc": "Yapay zekâ destekli kurulum seni adım adım yönlendirir; hedefini, kitleni ve bütçeni belirlersin."
        },
        {
          "title": "Başlat ve yönet",
          "desc": "Kampanyanı yayına alır, performansını izler ve gerektiğinde aynı panelden düzenlersin."
        }
      ],
      "ctaTitle": "Meta kampanyanı dakikalar içinde başlat"
    },
    "en": {
      "title": "Manage Meta ads from one panel",
      "sub": "DijiMagic lets you launch and manage Facebook, Instagram and WhatsApp campaigns from a single panel with AI-guided setup. Instead of jumping between ad accounts, you control everything in one place.",
      "intro": "You don't have to chase Meta ads across separate apps. DijiMagic brings your Facebook, Instagram and WhatsApp campaigns together in one panel with an AI-guided setup. It walks you through building a new campaign step by step, and lets you monitor and edit your existing ads from the same place. You go live fast — without wrestling with complex ad manager screens.",
      "benefits": [
        {
          "title": "One panel control",
          "desc": "Manage Facebook, Instagram and WhatsApp campaigns from a single screen instead of switching between apps."
        },
        {
          "title": "AI-guided setup",
          "desc": "Build your campaign with step-by-step guidance, so you're not stuck wrestling with technical settings alone."
        },
        {
          "title": "Three platforms together",
          "desc": "Launch Facebook, Instagram and WhatsApp ads from one place without logging in and out of separate accounts."
        },
        {
          "title": "Launch and manage",
          "desc": "Do everything in one flow, from creating a new campaign to editing your existing ads."
        }
      ],
      "steps": [
        {
          "title": "Connect your Meta account",
          "desc": "Securely link your Facebook, Instagram and WhatsApp ad accounts to the DijiMagic panel."
        },
        {
          "title": "Set up your campaign",
          "desc": "The AI-guided setup walks you through choosing your goal, audience and budget step by step."
        },
        {
          "title": "Launch and manage",
          "desc": "Take your campaign live, track its performance and adjust it from the same panel whenever needed."
        }
      ],
      "ctaTitle": "Launch your Meta campaign in minutes"
    }
  },
  {
    "slug": "google",
    "group": "reklam",
    "icon": "google",
    "name": {
      "tr": "Google",
      "en": "Google"
    },
    "tr": {
      "title": "Google ve YouTube reklamların tek panelde",
      "sub": "DijiMagic; Google Ads ve YouTube reklamlarını Arama, Görüntülü ve Performance Max kampanyaları dahil tek yerden yönetmeni sağlar. Farklı ekranlar arasında kaybolmadan, tüm Google reklamcılığını aynı kontrol panelinden yürütürsün.",
      "intro": "Google'ın reklam dünyası geniştir: arama sonuçları, web sitelerindeki görüntülü reklamlar, YouTube videoları ve hepsini birden kapsayan Performance Max kampanyaları. DijiMagic bu kampanya türlerinin tamamını sade ve anlaşılır tek bir panelde toplar. Böylece teknik karmaşaya boğulmadan, hangi reklamın nerede yayınlandığını görür ve tek yerden kontrol edersin.",
      "benefits": [
        {
          "title": "Tek panelde kontrol",
          "desc": "Arama, Görüntülü, Performance Max ve YouTube kampanyalarını ayrı ekranlar arasında gezinmeden aynı yerden yönetirsin."
        },
        {
          "title": "YouTube reklamcılığı",
          "desc": "Video reklamlarını da Google kampanyalarınla birlikte tek akışta planlar ve takip edersin."
        },
        {
          "title": "Performance Max kolaylığı",
          "desc": "Google'ın tüm yayın yerlerini kapsayan Performance Max kampanyalarını uzman bilgisi gerektirmeden yönetirsin."
        },
        {
          "title": "Sade ve anlaşılır",
          "desc": "Karmaşık Google Ads arayüzü yerine, herkesin anlayabileceği temiz bir kontrol paneliyle çalışırsın."
        }
      ],
      "steps": [
        {
          "title": "Hesabını bağla",
          "desc": "Google reklam hesabını birkaç tıklamayla DijiMagic'e güvenle bağlarsın."
        },
        {
          "title": "Kampanyaları gör",
          "desc": "Arama, Görüntülü, Performance Max ve YouTube kampanyalarının tamamı tek panelde karşına gelir."
        },
        {
          "title": "Tek yerden yönet",
          "desc": "Kampanyalarını aynı ekrandan izler, düzenler ve kontrol altında tutarsın."
        }
      ],
      "ctaTitle": "Google reklamlarını tek panelde yönetmeye bugün başla"
    },
    "en": {
      "title": "All your Google and YouTube ads in one panel",
      "sub": "DijiMagic lets you manage your Google Ads and YouTube advertising, including Search, Display and Performance Max campaigns, from a single place. Run all of your Google advertising from one control panel without getting lost across different screens.",
      "intro": "Google's advertising world is vast: search results, display ads across websites, YouTube videos and Performance Max campaigns that span them all. DijiMagic brings every one of these campaign types together in a single, clear and easy-to-read panel. So instead of drowning in technical complexity, you can see where each ad runs and control everything from one place.",
      "benefits": [
        {
          "title": "One unified panel",
          "desc": "Manage your Search, Display, Performance Max and YouTube campaigns from the same place without jumping between separate screens."
        },
        {
          "title": "YouTube advertising",
          "desc": "Plan and track your video ads in the same flow as the rest of your Google campaigns."
        },
        {
          "title": "Effortless Performance Max",
          "desc": "Manage Performance Max campaigns that cover all of Google's placements without needing expert knowledge."
        },
        {
          "title": "Clear and simple",
          "desc": "Work with a clean control panel anyone can understand instead of the complex Google Ads interface."
        }
      ],
      "steps": [
        {
          "title": "Connect your account",
          "desc": "Securely link your Google advertising account to DijiMagic in just a few clicks."
        },
        {
          "title": "See your campaigns",
          "desc": "All of your Search, Display, Performance Max and YouTube campaigns appear together in one panel."
        },
        {
          "title": "Manage from one place",
          "desc": "Monitor, edit and keep your campaigns under control from a single screen."
        }
      ],
      "ctaTitle": "Start managing your Google ads from a single panel today"
    }
  },
  {
    "slug": "tiktok",
    "group": "reklam",
    "icon": "tiktok",
    "soon": true,
    "name": {
      "tr": "TikTok",
      "en": "TikTok"
    },
    "tr": {
      "title": "TikTok reklamların aynı panele geliyor",
      "sub": "DijiMagic; Meta ve Google reklamlarını yönettiğin panele TikTok reklamlarını da ekliyor. Tüm kampanyalarını tek yerden yönetmeni sağlayacak bu modül çok yakında açılıyor.",
      "intro": "TikTok reklamları çok yakında DijiMagic paneline entegre oluyor. Onay süreci tamamlandığında TikTok hesabını bağlayıp kampanyalarını, tıpkı Meta ve Google'da olduğu gibi aynı yerden yönetebileceksin; ayrı paneller arasında gezmene gerek kalmayacak. Hazırlıklar sürüyor, yayına çok az kaldı.",
      "benefits": [
        {
          "title": "Tek panel, tüm reklamlar",
          "desc": "TikTok kampanyalarını Meta ve Google reklamlarınla aynı yerden yönetebileceksin; her platform için ayrı araç kullanmana gerek kalmayacak."
        },
        {
          "title": "Tanıdık akış",
          "desc": "DijiMagic'te alıştığın kampanya kurulum ve yönetim deneyimi, TikTok tarafında da seni karşılayacak."
        },
        {
          "title": "Bütünleşik raporlama",
          "desc": "TikTok performansını diğer kanallarınla yan yana göreceğin tek bir görünüm hazırlanıyor."
        },
        {
          "title": "Kurulumdan sen sorumlu değilsin",
          "desc": "Modül açıldığında hesabını birkaç tıkla bağlayacaksın; teknik entegrasyon işini DijiMagic üstlenecek."
        }
      ],
      "steps": [
        {
          "title": "Geliştirme tamamlanıyor",
          "desc": "TikTok reklam entegrasyonunun panele eklenmesi üzerinde çalışıyoruz."
        },
        {
          "title": "Onay süreci ilerliyor",
          "desc": "Entegrasyonun yayına alınabilmesi için gerekli onay aşamaları sürüyor."
        },
        {
          "title": "Yakında kullanımda",
          "desc": "Modül açıldığında TikTok hesabını bağlayıp kampanyalarını oluşturmaya başlayabileceksin."
        }
      ],
      "ctaTitle": "TikTok reklamları çok yakında. Şimdi DijiMagic'i ücretsiz dene, hazır olduğunda ilk sen kullan."
    },
    "en": {
      "title": "TikTok ads are coming to the same panel",
      "sub": "DijiMagic is bringing TikTok ads into the same panel where you manage Meta and Google. This module, which lets you run every campaign from one place, is launching very soon.",
      "intro": "TikTok ads are coming to the DijiMagic panel very soon. Once the approval process is complete, you'll connect your TikTok account and manage your campaigns right alongside Meta and Google, with no need to jump between separate dashboards. Work is underway and launch is just around the corner.",
      "benefits": [
        {
          "title": "One panel, every ad",
          "desc": "You'll manage your TikTok campaigns in the same place as your Meta and Google ads, with no separate tool for each platform."
        },
        {
          "title": "Familiar workflow",
          "desc": "The campaign setup and management experience you already know in DijiMagic will greet you on the TikTok side too."
        },
        {
          "title": "Unified reporting",
          "desc": "A single view that shows your TikTok performance side by side with your other channels is on the way."
        },
        {
          "title": "Setup handled for you",
          "desc": "When the module goes live you'll connect your account in a few clicks; DijiMagic takes care of the technical integration."
        }
      ],
      "steps": [
        {
          "title": "Development wrapping up",
          "desc": "We're building the TikTok ads integration into the panel right now."
        },
        {
          "title": "Approval in progress",
          "desc": "The approval steps needed to take the integration live are underway."
        },
        {
          "title": "Available soon",
          "desc": "Once the module opens you'll connect your TikTok account and start creating campaigns."
        }
      ],
      "ctaTitle": "TikTok ads are coming very soon. Try DijiMagic free now and be the first to use it when it's ready."
    }
  },
  {
    "slug": "strateji",
    "group": "ai",
    "icon": "target",
    "name": {
      "tr": "Strateji",
      "en": "Strategy"
    },
    "tr": {
      "title": "Reklam stratejini yapay zeka kursun",
      "sub": "DijiMagic; siteni, sosyal medyanı ve ürünlerini inceleyip işletmene özel bir reklam stratejisi oluşturur. Hangi platformda, hangi kitleye, hangi bütçeyle çıkacağını senin yerine planlar.",
      "intro": "Reklama nereden başlayacağını bilmek zorunda değilsin. DijiMagic markanı uçtan uca analiz eder; ürünlerini, rakiplerini ve hedef kitleni anlar, ardından platform, bütçe ve mesaj dağılımını içeren net bir strateji çıkarır. Sen onayla, gerisini sistem yürütsün.",
      "benefits": [
        {
          "title": "Markana özel plan",
          "desc": "Sektörüne, ürünlerine ve hedeflerine göre kişiselleştirilmiş bir strateji; jenerik şablon değil."
        },
        {
          "title": "Doğru platform dağılımı",
          "desc": "Bütçenin Meta ve Google arasında nasıl bölüneceğini veriye dayalı belirler."
        },
        {
          "title": "Bütçe önerisi",
          "desc": "Hedeflediğin sonuç için gereken gerçekçi bütçeyi ve beklenen getiriyi gösterir."
        },
        {
          "title": "Sürekli güncel",
          "desc": "Performans değiştikçe stratejini yeniden değerlendirir, önerilerini tazeler."
        }
      ],
      "steps": [
        {
          "title": "Markanı analiz eder",
          "desc": "Siteni, sosyal hesaplarını ve ürünlerini tarar; konumunu ve rakiplerini anlar."
        },
        {
          "title": "Stratejini kurar",
          "desc": "Hedef kitle, platform, bütçe ve mesaj planını tek bir akış halinde oluşturur."
        },
        {
          "title": "Sen onayla, yayına geçsin",
          "desc": "Planı incele, dilersen düzenle; tek tıkla kampanyalara dönüştür."
        }
      ],
      "ctaTitle": "Stratejini birkaç dakikada çıkar"
    },
    "en": {
      "title": "Let AI build your ad strategy",
      "sub": "DijiMagic reviews your site, social media and products to build an ad strategy tailored to your business. It plans which platform, which audience and which budget to go with — for you.",
      "intro": "You don’t need to know where to start with advertising. DijiMagic analyzes your brand end to end — understanding your products, competitors and audience — then produces a clear strategy covering platform, budget and message split. You approve, and the system runs the rest.",
      "benefits": [
        {
          "title": "Tailored to your brand",
          "desc": "A strategy personalized to your industry, products and goals — not a generic template."
        },
        {
          "title": "Right platform split",
          "desc": "Decides how your budget should divide across Meta and Google, based on data."
        },
        {
          "title": "Budget guidance",
          "desc": "Shows the realistic budget needed for your target outcome and the expected return."
        },
        {
          "title": "Always current",
          "desc": "Re-evaluates your strategy as performance shifts and refreshes its recommendations."
        }
      ],
      "steps": [
        {
          "title": "Analyzes your brand",
          "desc": "Scans your site, social accounts and products; understands your position and competitors."
        },
        {
          "title": "Builds your strategy",
          "desc": "Creates your audience, platform, budget and message plan in one flow."
        },
        {
          "title": "You approve, it goes live",
          "desc": "Review the plan, edit if you like, and turn it into campaigns in one click."
        }
      ],
      "ctaTitle": "Build your strategy in minutes"
    }
  },
  {
    "slug": "optimizasyon",
    "group": "ai",
    "icon": "trending",
    "name": {
      "tr": "Optimizasyon",
      "en": "Optimization"
    },
    "tr": {
      "title": "Bütçeni kazandıran reklamlara yapay zeka yönlendirsin",
      "sub": "DijiMagic, her reklamın getirisini (ROAS) anlık izler. Para kaybettireni kısar veya durdurur, en çok kazandırana otomatik bütçe ekleyerek bütçeni kendiliğinden en verimli yere taşır.",
      "intro": "Reklamlarını gün boyu tek tek takip etmek zorunda değilsin. DijiMagic her reklamın getirisini sürekli ölçer; düşük performans gösteren reklamı zamanında kısar veya durdurarak israfı önler, en çok dönüşüm getireni fark edip ona otomatik bütçe ekler. Böylece harcadığın her lira en yüksek geri dönüşü sağlayan reklama akar, sen de kararları senin yerine sistemin verdiğini bilerek rahat edersin.",
      "benefits": [
        {
          "title": "Anlık getiri takibi",
          "desc": "Her reklamın getirisini (ROAS) gün içinde sürekli izler; performansı gözden kaçırmazsın."
        },
        {
          "title": "İsrafı durdurur",
          "desc": "Para kaybettiren düşük performanslı reklamı zamanında kısar veya tamamen durdurur."
        },
        {
          "title": "Kazandırana bütçe ekler",
          "desc": "En çok dönüşüm getiren reklamı fark edip ona otomatik bütçe aktararak kârı büyütür."
        },
        {
          "title": "Tam otomatik çalışır",
          "desc": "Kararları senin yerine alır; bütçeni manuel takip etme ve elle ayarlama derdinden kurtulursun."
        }
      ],
      "steps": [
        {
          "title": "Getiriyi izler",
          "desc": "Tüm reklamlarının getirisini (ROAS) anlık olarak ölçer ve hangisinin kazandırıp hangisinin kaybettirdiğini görür."
        },
        {
          "title": "Zayıfı kısar",
          "desc": "Düşük performanslı reklama harcamayı azaltır veya o reklamı tamamen durdurur."
        },
        {
          "title": "Güçlüye bütçe ekler",
          "desc": "En yüksek dönüşümü getiren reklama otomatik bütçe aktararak getirini büyütür."
        }
      ],
      "ctaTitle": "Bütçeni en verimli reklamlara yapay zekayla taşı"
    },
    "en": {
      "title": "Let AI steer your budget to the ads that earn",
      "sub": "DijiMagic tracks each ad's return (ROAS) in real time. It trims or stops the ones losing money and automatically adds budget to your top converter, shifting your spend to where it works best.",
      "intro": "You don't have to watch your ads one by one all day. DijiMagic continuously measures every ad's return; it trims or stops low performers in time to prevent waste, spots your best-converting ad and automatically adds budget to it. That way every lira you spend flows to the ad with the highest return, and you can relax knowing the system makes the calls for you.",
      "benefits": [
        {
          "title": "Real-time return tracking",
          "desc": "Continuously monitors each ad's return (ROAS) throughout the day so performance never slips past you."
        },
        {
          "title": "Stops the waste",
          "desc": "Trims or fully stops low-performing ads that are losing money, right when it matters."
        },
        {
          "title": "Funds the winners",
          "desc": "Detects your highest-converting ad and automatically shifts budget to it to grow profit."
        },
        {
          "title": "Runs fully automatically",
          "desc": "Makes the decisions for you, so you skip manual tracking and constant by-hand adjustments."
        }
      ],
      "steps": [
        {
          "title": "Tracks the return",
          "desc": "Measures every ad's return (ROAS) in real time and sees which ones earn and which ones lose."
        },
        {
          "title": "Trims the weak",
          "desc": "Cuts spend on a low-performing ad or stops that ad entirely."
        },
        {
          "title": "Funds the strong",
          "desc": "Automatically shifts budget to the highest-converting ad to grow your return."
        }
      ],
      "ctaTitle": "Move your budget to the ads that work, with AI"
    }
  },
  {
    "slug": "dijialgoritma",
    "group": "ai",
    "icon": "sparkle",
    "name": {
      "tr": "DijiAlgoritma",
      "en": "DijiAlgorithm"
    },
    "tr": {
      "title": "İşletmene özel yapay zekâ asistanın",
      "sub": "DijiAlgoritma; markanı tanıyan, reklam ve pazarlama sorularını yanıtlayan, içerik üreten ve performansına bakarak büyüme önerileri sunan kişisel yapay zekâ asistanındır. Aklına takılanı sor, gerisini birlikte çözün.",
      "intro": "Pazarlamayı tek başına çözmek zorunda değilsin. DijiAlgoritma işletmeni, ürünlerini ve reklam performansını tanır; sorularını sade bir dille yanıtlar, ihtiyacın olan içeriği üretir ve verilerine dayanarak büyüme için somut adımlar önerir. Bir uzmanla konuşur gibi yaz, işletmene özel cevaplar al.",
      "benefits": [
        {
          "title": "Markanı tanır",
          "desc": "İşletmeni, ürünlerini ve hedeflerini bildiği için cevapları sana özeldir, jenerik değildir."
        },
        {
          "title": "Anında içerik üretir",
          "desc": "Reklam metni, başlık, açıklama ya da fikir; ihtiyacın olanı saniyeler içinde hazırlar."
        },
        {
          "title": "Veriye dayalı öneriler",
          "desc": "Reklam performansını analiz eder ve büyümen için somut, uygulanabilir adımlar sunar."
        },
        {
          "title": "7 gün 24 saat yanında",
          "desc": "Pazarlamayla ilgili her sorunu istediğin an sorarsın, beklemeden yanıt alırsın."
        }
      ],
      "steps": [
        {
          "title": "Sorunu yaz",
          "desc": "Reklam, içerik ya da büyümeyle ilgili aklına takılanı sade bir dille sor."
        },
        {
          "title": "Markana göre yanıtlar",
          "desc": "İşletmeni ve performans verini dikkate alarak sana özel cevabını veya içeriğini üretir."
        },
        {
          "title": "Öneriyi uygula",
          "desc": "Beğendiğin içeriği ve önerileri tek tıkla kullan; karar her zaman sende kalır."
        }
      ],
      "ctaTitle": "Asistanına ilk sorunu hemen sor"
    },
    "en": {
      "title": "Your business's own AI assistant",
      "sub": "DijiAlgoritma is your personal AI assistant that knows your brand, answers your advertising and marketing questions, creates content and offers growth advice based on your performance. Ask anything, and solve it together.",
      "intro": "You don't have to figure out marketing on your own. DijiAlgoritma knows your business, products and ad performance; it answers your questions in plain language, creates the content you need and suggests concrete growth steps grounded in your own data. Type like you're talking to an expert and get answers made for your business.",
      "benefits": [
        {
          "title": "Knows your brand",
          "desc": "Because it knows your business, products and goals, its answers are made for you — never generic."
        },
        {
          "title": "Instant content",
          "desc": "Ad copy, headlines, descriptions or ideas — it prepares what you need in seconds."
        },
        {
          "title": "Data-driven advice",
          "desc": "It analyzes your ad performance and offers concrete, actionable steps to help you grow."
        },
        {
          "title": "By your side 24/7",
          "desc": "Ask any marketing question whenever you like and get an answer without the wait."
        }
      ],
      "steps": [
        {
          "title": "Ask your question",
          "desc": "Type whatever's on your mind about ads, content or growth in plain language."
        },
        {
          "title": "It answers for your brand",
          "desc": "It creates your tailored answer or content, taking your business and performance data into account."
        },
        {
          "title": "Use the suggestion",
          "desc": "Put the content and advice you like to work in one click; the decision always stays with you."
        }
      ],
      "ctaTitle": "Ask your assistant your first question now"
    }
  },
  {
    "slug": "hedef-kitle",
    "group": "ai",
    "icon": "users",
    "name": {
      "tr": "Hedef Kitle",
      "en": "Audience"
    },
    "tr": {
      "title": "Doğru kitleni yapay zeka bulsun",
      "sub": "DijiMagic, işletmene en çok kazandıracak kitleleri keşfeder, mevcut müşterilerine benzeyen yeni kitleler oluşturur ve hedeflemeni makine öğrenmesiyle giderek keskinleştirir.",
      "intro": "Reklamını kimin göreceğini tahminle değil, veriyle belirle. DijiMagic; işletme profilini, sektörünü ve müşteri davranışlarını analiz ederek yüksek değerli kitle segmentlerini ortaya çıkarır. En iyi müşterilerine benzeyen yeni kitleler kurar, performans biriktikçe hedeflemeni otomatik olarak iyileştirir. Böylece bütçen, dönüşme ihtimali en yüksek kişilere gider.",
      "benefits": [
        {
          "title": "Yüksek değerli segmentler",
          "desc": "İşletmene en çok getiri sağlayacak kitle gruplarını veriye dayalı olarak keşfeder."
        },
        {
          "title": "Benzer kitle gücü",
          "desc": "Mevcut müşterilerine benzeyen yeni kitleler oluşturarak erişimini doğru kişilere büyütür."
        },
        {
          "title": "Akıllı keskinleştirme",
          "desc": "Makine öğrenmesiyle hedeflemeni sürekli daraltır, boşa giden gösterimi azaltır."
        },
        {
          "title": "Verimli bütçe kullanımı",
          "desc": "Reklam harcamanı dönüşme olasılığı en yüksek kişilere yönlendirir."
        }
      ],
      "steps": [
        {
          "title": "Kitleni analiz eder",
          "desc": "İşletme profilini, sektörünü ve müşteri davranışlarını inceleyerek en değerli kitle sinyallerini çıkarır."
        },
        {
          "title": "Segmentleri ve benzer kitleleri kurar",
          "desc": "Yüksek potansiyelli segmentleri belirler ve müşterilerine benzeyen yeni kitleler oluşturur."
        },
        {
          "title": "Hedeflemeyi keskinleştirir",
          "desc": "Performans verisiyle kitleleri sürekli iyileştirir; sen onayla, kampanyalarında kullanılsın."
        }
      ],
      "ctaTitle": "Doğru kitleni dakikalar içinde keşfet"
    },
    "en": {
      "title": "Let AI find your right audience",
      "sub": "DijiMagic discovers the audiences most likely to drive results for your business, builds new audiences that resemble your existing customers, and sharpens your targeting with machine learning over time.",
      "intro": "Stop guessing who should see your ads and decide with data instead. DijiMagic analyzes your business profile, industry and customer behavior to surface high-value audience segments. It builds new audiences that look like your best customers and keeps refining your targeting automatically as performance builds. That way your budget reaches the people most likely to convert.",
      "benefits": [
        {
          "title": "High-value segments",
          "desc": "Discovers the audience groups most likely to deliver returns for your business, based on data."
        },
        {
          "title": "Lookalike power",
          "desc": "Builds new audiences resembling your existing customers to grow reach among the right people."
        },
        {
          "title": "Smart sharpening",
          "desc": "Continuously narrows your targeting with machine learning and cuts wasted impressions."
        },
        {
          "title": "Efficient budget use",
          "desc": "Directs your ad spend toward the people most likely to convert."
        }
      ],
      "steps": [
        {
          "title": "Analyzes your audience",
          "desc": "Reviews your business profile, industry and customer behavior to extract your most valuable audience signals."
        },
        {
          "title": "Builds segments and lookalikes",
          "desc": "Identifies high-potential segments and creates new audiences that resemble your customers."
        },
        {
          "title": "Sharpens your targeting",
          "desc": "Keeps improving audiences with performance data; you approve, then use them in your campaigns."
        }
      ],
      "ctaTitle": "Discover your right audience in minutes"
    }
  },
  {
    "slug": "tasarim",
    "group": "icerik",
    "icon": "image",
    "name": {
      "tr": "Tasarım",
      "en": "Design"
    },
    "tr": {
      "title": "Reklama hazır görselleri yapay zeka üretsin",
      "sub": "DijiMagic markanın rengini, tonunu ve ürünlerini öğrenir; saniyeler içinde reklama hazır görseller oluşturur. Arka planı temizler, başlığını yazar ve her platform ölçüsüne dışa aktarır.",
      "intro": "Tasarımcı beklemeden, pahalı stüdyolara ihtiyaç duymadan reklam görsellerini tek panelden üretirsin. DijiMagic markanı tanıdığı için ürettiği her görsel senin renk ve tonuna uygun çıkar; kampanyaya hazır görseli dakikalar değil saniyeler içinde elde edersin.",
      "benefits": [
        {
          "title": "Markana uygun görsel",
          "desc": "Yapay zeka markanın rengini, tonunu ve ürünlerini öğrenir; ürettiği her görsel sana benzer, jenerik stok görsel değil."
        },
        {
          "title": "Saniyeler içinde hazır",
          "desc": "Tasarımcı veya stüdyo beklemeden reklama hazır görselleri saniyeler içinde oluşturursun."
        },
        {
          "title": "Temiz arka plan",
          "desc": "Ürün görsellerinin arka planını otomatik temizler, dağınık fotoğrafı reklama uygun temiz bir görsele çevirir."
        },
        {
          "title": "Her platforma uygun ölçü",
          "desc": "Aynı görseli Meta, Google ve sosyal medyanın her ölçüsüne tek tıkla dışa aktarır."
        }
      ],
      "steps": [
        {
          "title": "Markanı öğrenir",
          "desc": "DijiMagic markanın rengini, tonunu ve ürünlerini inceleyip görsel diline uygun bir başlangıç oluşturur."
        },
        {
          "title": "Görseli üretir",
          "desc": "Saniyeler içinde reklama hazır görselleri oluşturur, arka planı temizler ve başlığını yazar."
        },
        {
          "title": "Platforma aktarır",
          "desc": "Hazır görseli Meta, Google ve sosyal medyanın her ölçüsüne tek tıkla dışa aktarır."
        }
      ],
      "ctaTitle": "İlk reklam görselini saniyeler içinde üret"
    },
    "en": {
      "title": "Let AI create ad-ready visuals",
      "sub": "DijiMagic learns your brand's colors, tone and products, then creates ad-ready visuals in seconds. It cleans up the background, writes the headline and exports to every platform size.",
      "intro": "Produce your ad visuals from a single panel, without waiting on a designer or paying for expensive studios. Because DijiMagic knows your brand, every visual it creates matches your colors and tone, so you get campaign-ready creative in seconds instead of days.",
      "benefits": [
        {
          "title": "On-brand visuals",
          "desc": "The AI learns your brand's colors, tone and products, so every visual looks like you, not a generic stock image."
        },
        {
          "title": "Ready in seconds",
          "desc": "Create ad-ready visuals in seconds, without waiting on a designer or a studio."
        },
        {
          "title": "Clean backgrounds",
          "desc": "It automatically removes the background from your product photos, turning a cluttered shot into a clean, ad-ready visual."
        },
        {
          "title": "Every platform size",
          "desc": "Export the same visual to every Meta, Google and social media size with a single click."
        }
      ],
      "steps": [
        {
          "title": "Learns your brand",
          "desc": "DijiMagic studies your brand's colors, tone and products to build a starting point that fits your visual language."
        },
        {
          "title": "Creates the visual",
          "desc": "It generates ad-ready visuals in seconds, cleans up the background and writes the headline."
        },
        {
          "title": "Exports to platforms",
          "desc": "Export the finished visual to every Meta, Google and social media size with a single click."
        }
      ],
      "ctaTitle": "Create your first ad visual in seconds"
    }
  },
  {
    "slug": "sosyal-medya",
    "group": "icerik",
    "icon": "share",
    "name": {
      "tr": "Sosyal Medya",
      "en": "Social Media"
    },
    "tr": {
      "title": "Tüm sosyal medyan tek panelden",
      "sub": "DijiMagic; tüm sosyal medya hesaplarını tek panele bağlar, gönderilerini planlar, takvimler ve yayınlar. Yapay zekâ içerik fikri üretir, en aktif saatte senin yerine paylaşır.",
      "intro": "Her platform için ayrı uygulama açıp tek tek paylaşım yapmak zorunda değilsin. DijiMagic bütün sosyal hesaplarını tek bir panelde toplar; gönderilerini önceden hazırlar, takvime dizer ve doğru anda otomatik yayınlar. Ne paylaşacağını düşünmekte zorlanırsan, yapay zekâ markana uygun içerik fikirleri çıkarır.",
      "benefits": [
        {
          "title": "Tek panel kontrolü",
          "desc": "Bütün sosyal medya hesaplarını tek bir yerden bağlar ve yönetirsin; platform platform dolaşmaya son."
        },
        {
          "title": "Yapay zekâ içerik fikri",
          "desc": "Ne paylaşacağını bilemediğinde markana uygun gönderi fikirlerini saniyeler içinde önerir."
        },
        {
          "title": "En aktif saatte yayın",
          "desc": "Gönderini takipçilerinin en çok çevrimiçi olduğu saatte otomatik paylaşarak erişimini artırır."
        },
        {
          "title": "Takvimli planlama",
          "desc": "Tüm gönderilerini önceden hazırlayıp takvime dizersin; ardından sistem zamanı gelince yayınlar."
        }
      ],
      "steps": [
        {
          "title": "Hesaplarını bağla",
          "desc": "Sosyal medya hesaplarını tek tıkla DijiMagic paneline bağlarsın."
        },
        {
          "title": "Gönderini planla",
          "desc": "İçeriğini hazırlar veya yapay zekânın fikirlerinden seçer, takvimde tarih ve saatini belirlersin."
        },
        {
          "title": "Yayına geçsin",
          "desc": "DijiMagic gönderini en aktif saatte otomatik paylaşır; sen tek elden takip edersin."
        }
      ],
      "ctaTitle": "Sosyal medyanı tek panelden yönetmeye başla"
    },
    "en": {
      "title": "All your social media in one panel",
      "sub": "DijiMagic connects all your social media accounts to a single panel, then plans, schedules and publishes your posts. AI generates content ideas and shares them for you at peak activity time.",
      "intro": "You no longer need to open a separate app and post on each platform one by one. DijiMagic brings all your social accounts into a single panel — preparing your posts in advance, lining them up on a calendar and publishing them automatically at the right moment. And when you’re stuck on what to share, AI suggests content ideas that fit your brand.",
      "benefits": [
        {
          "title": "One-panel control",
          "desc": "Connect and manage all your social media accounts from a single place — no more jumping between platforms."
        },
        {
          "title": "AI content ideas",
          "desc": "When you don’t know what to post, it suggests on-brand post ideas in seconds."
        },
        {
          "title": "Publish at peak time",
          "desc": "Shares your post automatically when your followers are most online, boosting your reach."
        },
        {
          "title": "Calendar planning",
          "desc": "Prepare all your posts ahead and line them up on a calendar; the system publishes each when its time comes."
        }
      ],
      "steps": [
        {
          "title": "Connect your accounts",
          "desc": "Link your social media accounts to the DijiMagic panel in one click."
        },
        {
          "title": "Plan your post",
          "desc": "Prepare your content or pick from AI’s ideas, then set its date and time on the calendar."
        },
        {
          "title": "Let it go live",
          "desc": "DijiMagic publishes your post automatically at peak time while you track everything from one place."
        }
      ],
      "ctaTitle": "Start managing your social media from one panel"
    }
  },
  {
    "slug": "seo-plus",
    "group": "icerik",
    "icon": "search",
    "name": {
      "tr": "SEO Plus",
      "en": "SEO Plus"
    },
    "tr": {
      "title": "Arama sıralamanı yapay zeka yükseltsin",
      "sub": "DijiMagic sitenin arama performansını derinlemesine tarar; teknik hataları, eksik anahtar kelimeleri ve rakip boşluklarını ortaya çıkarır. Ardından doğru içerikle seni Google'da daha üst sıralara taşır.",
      "intro": "Sitenin neden aranmadığını tahmin etmek zorunda değilsin. DijiMagic siteni baştan sona tarar; arama performansını düşüren teknik hataları, kaçırdığın anahtar kelimeleri ve rakiplerinin önde olduğu konuları tek tek ortaya koyar. Sonra bu boşlukları kapatan SEO odaklı içerikle sıralamanı sürekli yukarı taşır.",
      "benefits": [
        {
          "title": "Derinlemesine tarama",
          "desc": "Sitenin arama performansını uçtan uca inceler; gözden kaçan sorunları net bir tabloya dönüştürür."
        },
        {
          "title": "Teknik hata tespiti",
          "desc": "Sıralamanı düşüren teknik aksaklıkları bulur ve nasıl düzelteceğini anlaşılır şekilde gösterir."
        },
        {
          "title": "Eksik anahtar kelimeler",
          "desc": "Müşterilerinin aradığı ama sitende yer almayan kelimeleri tespit eder, fırsatları önüne serer."
        },
        {
          "title": "Rakip boşlukları",
          "desc": "Rakiplerinin sıralandığı, senin kaçırdığın konuları çıkarır; öne geçeceğin alanları gösterir."
        }
      ],
      "steps": [
        {
          "title": "Siteni tarar",
          "desc": "Sitenin arama performansını derinlemesine inceler; teknik durumunu ve içerik yapısını çözümler."
        },
        {
          "title": "Fırsatları ortaya çıkarır",
          "desc": "Teknik hataları, eksik anahtar kelimeleri ve rakip boşluklarını öncelik sırasıyla listeler."
        },
        {
          "title": "İçerikle sıralamanı yükseltir",
          "desc": "Tespit edilen boşlukları kapatan SEO odaklı içeriği üretir ve seni üst sıralara taşır."
        }
      ],
      "ctaTitle": "Sitenin arama gücünü dakikalar içinde keşfet"
    },
    "en": {
      "title": "Let AI lift your search rankings",
      "sub": "DijiMagic deeply scans your site's search performance, surfacing technical errors, missing keywords and competitor gaps. Then it moves you higher on Google with the right content.",
      "intro": "You don't have to guess why your site isn't getting found. DijiMagic scans your site end to end — surfacing the technical errors dragging down your search performance, the keywords you're missing and the topics where competitors are ahead. Then it steadily lifts your rankings with SEO-focused content that closes those gaps.",
      "benefits": [
        {
          "title": "In-depth scan",
          "desc": "Examines your site's search performance end to end and turns overlooked issues into a clear picture."
        },
        {
          "title": "Technical error detection",
          "desc": "Finds the technical problems lowering your rankings and shows you how to fix them in plain terms."
        },
        {
          "title": "Missing keywords",
          "desc": "Spots the terms your customers search for but your site is missing, laying the opportunities out for you."
        },
        {
          "title": "Competitor gaps",
          "desc": "Surfaces the topics competitors rank for and you've missed, showing where you can pull ahead."
        }
      ],
      "steps": [
        {
          "title": "Scans your site",
          "desc": "Deeply reviews your site's search performance and analyzes its technical state and content structure."
        },
        {
          "title": "Surfaces the opportunities",
          "desc": "Lists technical errors, missing keywords and competitor gaps in priority order."
        },
        {
          "title": "Lifts rankings with content",
          "desc": "Produces the SEO-focused content that closes the identified gaps and moves you up the rankings."
        }
      ],
      "ctaTitle": "Discover your site's search power in minutes"
    }
  },
  {
    "slug": "web-site-yoneticisi",
    "group": "icerik",
    "icon": "globe",
    "name": {
      "tr": "Web Site Yöneticisi",
      "en": "Website Manager"
    },
    "tr": {
      "title": "Web siteni yapay zeka kursun",
      "sub": "DijiMagic, işletmen için modern bir web sitesini kod yazmadan oluşturur. Markana uygun içeriği ve düzeni hazırlar; sen ince ayar yapar, tek tıkla yayına alırsın.",
      "intro": "Web sitesi kurmak için tasarımcı ya da yazılımcı aramak zorunda değilsin. DijiMagic işletmenin bilgilerine göre içeriği ve sayfa düzenini hazırlar, modern bir tasarım çıkarır. Beğenmediğin yeri kolayca düzenler, hazır olduğunda tek tıkla yayına alırsın.",
      "benefits": [
        {
          "title": "Kod gerektirmez",
          "desc": "Tek satır kod yazmadan, teknik bilgi olmadan işletmene yakışan bir web sitesine sahip olursun."
        },
        {
          "title": "Hazır içerik ve düzen",
          "desc": "Yapay zeka, markana uygun metinleri ve sayfa düzenini senin yerine hazırlar."
        },
        {
          "title": "Kolay ince ayar",
          "desc": "Metinleri, görselleri ve bölümleri istediğin gibi sade bir arayüzden düzenlersin."
        },
        {
          "title": "Tek tıkla yayın",
          "desc": "Sitene son halini verdiğinde tek tıklamayla canlıya alır, anında erişilebilir kılarsın."
        }
      ],
      "steps": [
        {
          "title": "İçeriğini hazırlar",
          "desc": "İşletmeni anlar; markana uygun metinleri, bölümleri ve modern bir düzeni otomatik oluşturur."
        },
        {
          "title": "Sen ince ayar yaparsın",
          "desc": "Metin, görsel ve renkleri sade bir arayüzden düzenleyip siteyi tam istediğin hale getirirsin."
        },
        {
          "title": "Tek tıkla yayınla",
          "desc": "Hazır olduğunda tek tıklamayla siteni canlıya alır, müşterilerinle buluşturursun."
        }
      ],
      "ctaTitle": "Web siteni birkaç dakikada yayına al"
    },
    "en": {
      "title": "Let AI build your website",
      "sub": "DijiMagic creates a modern website for your business without any code. It prepares on-brand content and layout; you fine-tune, then publish in one click.",
      "intro": "You don’t need a designer or developer to launch a website. DijiMagic prepares the content and page layout based on your business and produces a modern design. You easily adjust anything you’d like, then publish in a single click when you’re ready.",
      "benefits": [
        {
          "title": "No code needed",
          "desc": "Get a website that fits your business without writing a single line of code or any technical know-how."
        },
        {
          "title": "Ready content and layout",
          "desc": "AI prepares on-brand copy and a clean page layout on your behalf."
        },
        {
          "title": "Easy fine-tuning",
          "desc": "Adjust text, images and sections exactly how you want from a simple interface."
        },
        {
          "title": "One-click publish",
          "desc": "Once your site is ready, take it live in a single click and make it instantly available."
        }
      ],
      "steps": [
        {
          "title": "Prepares your content",
          "desc": "Understands your business and automatically creates on-brand copy, sections and a modern layout."
        },
        {
          "title": "You fine-tune",
          "desc": "Edit text, images and colors from a simple interface to make the site exactly yours."
        },
        {
          "title": "Publish in one click",
          "desc": "When you’re ready, take your site live in a single click and put it in front of customers."
        }
      ],
      "ctaTitle": "Launch your website in minutes"
    }
  },
  {
    "slug": "raporlar",
    "group": "yonetim",
    "icon": "chart",
    "name": {
      "tr": "Raporlar",
      "en": "Reports"
    },
    "tr": {
      "title": "Tüm reklam performansın tek panoda",
      "sub": "DijiMagic; Meta ve Google performansını tek bir birleşik panoda toplar ve senin yerine zamanlanmış, otomatik raporlar üretir. Verilerini takip etmek için artık farklı ekranlar arasında dolaşman gerekmez.",
      "intro": "Reklamlarının nasıl gittiğini anlamak için saatlerce farklı panolar arasında gidip gelme. DijiMagic, Meta ve Google performansını tek bir birleşik panoda yan yana getirir; harcama, dönüşüm, getiri ve kampanya sonuçlarını aynı yerde gösterir. Üstelik raporlarını zamanlayabilir, böylece her dönem güncel performans tablon otomatik olarak hazır gelir.",
      "benefits": [
        {
          "title": "Birleşik pano",
          "desc": "Meta ve Google verilerini tek ekranda bir araya getirir; platformlar arasında geçiş yapmana gerek kalmaz."
        },
        {
          "title": "Otomatik raporlar",
          "desc": "Raporlarını zamanlarsın, DijiMagic her dönem güncel performans tablonu senin için kendiliğinden hazırlar."
        },
        {
          "title": "Net karşılaştırma",
          "desc": "Mevcut dönemi önceki dönemle yan yana koyarak performansının yükseldiğini mi düştüğünü mü anında görürsün."
        },
        {
          "title": "Doğru metrikler",
          "desc": "Harcama, dönüşüm, getiri ve kampanya sonuçlarını sade, anlaşılır bir dilde sunar; karmaşık tablolarla boğuşmazsın."
        }
      ],
      "steps": [
        {
          "title": "Platformlarını bağla",
          "desc": "Meta ve Google hesaplarını birkaç tıkla bağlarsın; veriler tek panoya akmaya başlar."
        },
        {
          "title": "Performansını izle",
          "desc": "Birleşik panoda harcama, dönüşüm, getiri ve günlük trendleri tek bakışta takip edersin."
        },
        {
          "title": "Raporların hazır gelsin",
          "desc": "Raporlarını zamanlarsın; her dönem güncel performans tablon otomatik olarak oluşturulur."
        }
      ],
      "ctaTitle": "Tüm reklam verilerini tek panoda topla"
    },
    "en": {
      "title": "All your ad performance in one dashboard",
      "sub": "DijiMagic brings your Meta and Google performance together in a single unified dashboard and produces scheduled, automatic reports for you. No more jumping between screens to track your data.",
      "intro": "Stop bouncing between different dashboards for hours to understand how your ads are doing. DijiMagic places your Meta and Google performance side by side in one unified dashboard — showing spend, conversions, return and campaign results in the same place. You can also schedule your reports, so an up-to-date performance view is ready for you automatically every period.",
      "benefits": [
        {
          "title": "Unified dashboard",
          "desc": "Brings your Meta and Google data together on one screen, so you never have to switch between platforms."
        },
        {
          "title": "Automatic reports",
          "desc": "You schedule your reports, and DijiMagic prepares an up-to-date performance view for you every period on its own."
        },
        {
          "title": "Clear comparison",
          "desc": "Places the current period next to the previous one so you instantly see whether your performance is rising or falling."
        },
        {
          "title": "The right metrics",
          "desc": "Presents spend, conversions, return and campaign results in plain, readable language — no wrestling with complex tables."
        }
      ],
      "steps": [
        {
          "title": "Connect your platforms",
          "desc": "Link your Meta and Google accounts in a few clicks, and your data starts flowing into one dashboard."
        },
        {
          "title": "Track your performance",
          "desc": "Follow spend, conversions, return and daily trends at a glance in the unified dashboard."
        },
        {
          "title": "Get reports ready for you",
          "desc": "Schedule your reports, and an up-to-date performance view is generated automatically every period."
        }
      ],
      "ctaTitle": "Bring all your ad data into one dashboard"
    }
  },
  {
    "slug": "crm-sistemi",
    "group": "yonetim",
    "icon": "crm",
    "name": {
      "tr": "CRM Sistemi",
      "en": "CRM"
    },
    "tr": {
      "title": "Müşterilerini ve satışlarını tek yerden yönet",
      "sub": "DijiMagic CRM; gelen müşteri adaylarını ve mevcut müşterilerini tek panelde toplar, ilk temastan satışa kadar tüm süreci senin için takip eder. Hangi müşterinin hangi aşamada olduğunu bir bakışta görürsün.",
      "intro": "DijiMagic'in CRM modülü, müşteri ilişkilerini ve müşteri adaylarını dağınık not defterleri ile tablolar arasında kaybetmeden tek bir yerden yönetmeni sağlar. Satış sürecini baştan sona görünür kılar; her adayın hangi aşamada olduğunu, kiminle ne zaman ilgilenmen gerektiğini net olarak gösterir. Böylece tek bir fırsat bile gözden kaçmaz, satışların düzene girer.",
      "benefits": [
        {
          "title": "Tek panelde toplanır",
          "desc": "Tüm müşteri adayların ve müşterilerin dağınık dosyalar yerine tek bir ekranda, derli toplu durur."
        },
        {
          "title": "Uçtan uca satış takibi",
          "desc": "İlk temastan kapanan satışa kadar her aşamayı net bir akış üzerinde izlersin."
        },
        {
          "title": "Hiçbir fırsat kaçmaz",
          "desc": "Hangi adayla ne zaman ilgilenmen gerektiğini görür, sıcak fırsatları soğumadan değerlendirirsin."
        },
        {
          "title": "Düzenli müşteri geçmişi",
          "desc": "Her müşterinin geçmişi ve süreçteki konumu kayıtlı kalır; ekibin aynı bilgiyle çalışır."
        }
      ],
      "steps": [
        {
          "title": "Adayların toplanır",
          "desc": "Gelen müşteri adayların ve mevcut müşterilerin tek bir yerde kayıt altına alınır."
        },
        {
          "title": "Sürece yerleşir",
          "desc": "Her aday satış aşamalarından oluşan akışta doğru konuma yerleştirilir."
        },
        {
          "title": "Satışa kadar izlenir",
          "desc": "Adaylar aşama aşama ilerletilir; süreç kapanan satışa kadar tek panelden takip edilir."
        }
      ],
      "ctaTitle": "Müşterilerini ve satışlarını düzene sokmaya bugün başla"
    },
    "en": {
      "title": "Manage customers and sales in one place",
      "sub": "DijiMagic CRM brings your new leads and existing customers together in a single panel and tracks the entire process from first contact to closed sale. You see which customer is at which stage at a glance.",
      "intro": "DijiMagic's CRM module lets you manage customer relationships and leads from one place, without losing them across scattered notes and spreadsheets. It makes your sales process visible from start to finish, clearly showing which stage each lead is in and who needs your attention and when. As a result, not a single opportunity slips through and your sales stay organized.",
      "benefits": [
        {
          "title": "All in one panel",
          "desc": "Every lead and customer stays neat and organized on a single screen instead of scattered files."
        },
        {
          "title": "End-to-end sales tracking",
          "desc": "You follow every stage on a clear flow, from first contact to the closed sale."
        },
        {
          "title": "No opportunity missed",
          "desc": "You see who needs your attention and when, acting on hot leads before they go cold."
        },
        {
          "title": "Organized customer history",
          "desc": "Each customer's history and position in the process stays on record, so your team works with the same information."
        }
      ],
      "steps": [
        {
          "title": "Leads are gathered",
          "desc": "Your incoming leads and existing customers are recorded together in one place."
        },
        {
          "title": "Placed in the process",
          "desc": "Each lead is positioned at the right point in a flow made up of your sales stages."
        },
        {
          "title": "Tracked to the sale",
          "desc": "Leads are moved forward stage by stage and the process is followed from a single panel until the sale closes."
        }
      ],
      "ctaTitle": "Start organizing your customers and sales today"
    }
  },
  {
    "slug": "email-marketing",
    "group": "yonetim",
    "icon": "mail",
    "name": {
      "tr": "Email Marketing",
      "en": "Email Marketing"
    },
    "tr": {
      "title": "E-postayla müşterilerinle bağını güçlendir",
      "sub": "DijiMagic; e-posta kampanyalarını hazırlamandan göndermene, otomatik akışlar kurmandan sonuçları izlemene kadar tüm süreci tek yerden yönetir. Kişilerinle düzenli, anlamlı ve doğru zamanlı bir iletişim kurar.",
      "intro": "Müşterilerinle iletişimi kopmasın diye tek tek e-posta yazmana gerek yok. DijiMagic kampanyalarını ve otomasyonlarını birlikte yönetir; kime, ne zaman ve hangi mesajla ulaşacağını planlar, gönderimleri yürütür ve açılma ile tıklama gibi sonuçları sade bir şekilde gösterir. Sen mesajını belirle, gerisini sistem akıcı hâle getirsin.",
      "benefits": [
        {
          "title": "Kampanyalarını kolayca hazırla",
          "desc": "E-posta kampanyalarını birkaç adımda oluşturup kişilerine gönder; teknik bilgiye ihtiyaç duymadan."
        },
        {
          "title": "Otomatik akışlar",
          "desc": "Belirlediğin tetikleyicilere göre çalışan otomasyonlarla müşterilerine doğru anda kendiliğinden ulaş."
        },
        {
          "title": "Kişilerine göre mesaj",
          "desc": "Kişi listeni segmentlere ayır; her gruba ilgisini çekecek doğru içeriği gönder."
        },
        {
          "title": "Sonuçları takip et",
          "desc": "Açılma ve tıklama gibi sonuçları izleyerek hangi mesajın işe yaradığını net biçimde gör."
        }
      ],
      "steps": [
        {
          "title": "Kampanyanı oluştur",
          "desc": "Mesajını yaz, göndereceğin kişileri seç ve kampanyanı birkaç adımda hazır hâle getir."
        },
        {
          "title": "Otomasyonunu kur",
          "desc": "Hangi durumda hangi e-postanın gideceğini belirle; sistem akışı senin yerine yürütsün."
        },
        {
          "title": "Gönder ve sonuçları izle",
          "desc": "Kampanyanı yayına al, açılma ve tıklama sonuçlarını tek ekrandan takip et."
        }
      ],
      "ctaTitle": "Müşterilerinle bağını e-postayla güçlendir"
    },
    "en": {
      "title": "Strengthen customer ties with email",
      "sub": "DijiMagic manages your entire email process in one place — from creating and sending campaigns to building automated flows and tracking results. It keeps your communication with contacts consistent, relevant and well timed.",
      "intro": "You don’t have to write emails one by one to stay in touch with your customers. DijiMagic manages your campaigns and automations together; it plans who to reach, when and with which message, runs the sends, and shows results like opens and clicks in a clear way. You set the message, and the system keeps it flowing.",
      "benefits": [
        {
          "title": "Build campaigns easily",
          "desc": "Create email campaigns in a few steps and send them to your contacts — no technical knowledge needed."
        },
        {
          "title": "Automated flows",
          "desc": "Reach customers at the right moment automatically with automations that run on the triggers you set."
        },
        {
          "title": "Messages by contact",
          "desc": "Split your contact list into segments and send each group the content that fits their interest."
        },
        {
          "title": "Track your results",
          "desc": "Follow results like opens and clicks to clearly see which message is working."
        }
      ],
      "steps": [
        {
          "title": "Create your campaign",
          "desc": "Write your message, choose your recipients and get your campaign ready in a few steps."
        },
        {
          "title": "Set up automation",
          "desc": "Define which email goes out in which situation and let the system run the flow for you."
        },
        {
          "title": "Send and track results",
          "desc": "Launch your campaign and follow open and click results from a single screen."
        }
      ],
      "ctaTitle": "Strengthen customer ties with email"
    }
  },
  {
    "slug": "entegrasyon",
    "group": "yonetim",
    "icon": "plug",
    "name": {
      "tr": "Entegrasyon",
      "en": "Integration"
    },
    "tr": {
      "title": "Tüm hesaplarını tek noktadan bağla",
      "sub": "DijiMagic; Meta, Google, Google Analytics, Search Console ve daha fazlasını tek bir merkeze bağlar. Reklam, veri ve raporlama hesaplarını dağıtık panellerde aramak yerine hepsini güvenle aynı yerden yönetirsin.",
      "intro": "Her platform için ayrı ekran, ayrı şifre ve ayrı sekmeyle uğraşmana gerek yok. DijiMagic; Meta (Facebook, Instagram, WhatsApp), Google Ads, Google Analytics, Search Console ve Google Tag Manager gibi hesaplarını birkaç tıkla güvenli yetkilendirmeyle bağlar. Böylece reklam yönetiminden analize ve raporlamaya kadar her işin tek bir merkezden, eksiksiz veriyle yürür.",
      "benefits": [
        {
          "title": "Tek merkez",
          "desc": "Reklam, analiz ve site hesaplarını tek panelde toplar; sekme sekme dolaşmana son verir."
        },
        {
          "title": "Güvenli yetkilendirme",
          "desc": "Bağlantılar resmi yetkilendirme akışıyla kurulur; erişim bilgilerin güvenle saklanır ve hiçbir zaman dışarı sızdırılmaz."
        },
        {
          "title": "Dilediğin an kaldır",
          "desc": "Her entegrasyonu tek tıkla bağlar, istediğin an aynı kolaylıkla kaldırabilirsin."
        },
        {
          "title": "Birleşik veri akışı",
          "desc": "Bağladığın tüm hesapların verisi tek yerde buluşur; strateji, optimizasyon ve raporlar bu bütün resimden beslenir."
        }
      ],
      "steps": [
        {
          "title": "Platformunu seç",
          "desc": "Bağlamak istediğin hesabı (Meta, Google, Google Analytics, Search Console ve daha fazlası) listeden seçersin."
        },
        {
          "title": "Güvenle yetkilendir",
          "desc": "Resmi yetkilendirme ekranından onay verirsin; DijiMagic yalnızca işin için gereken erişimi alır."
        },
        {
          "title": "Hepsi tek panelde",
          "desc": "Bağlantı tamamlanır; tüm hesaplarını ve verilerini bundan sonra tek merkezden yönetirsin."
        }
      ],
      "ctaTitle": "Hesaplarını birkaç dakikada bağla"
    },
    "en": {
      "title": "Connect every account from one hub",
      "sub": "DijiMagic connects Meta, Google, Google Analytics, Search Console and more in a single hub. Instead of hunting through scattered panels, you manage all your ad, data and reporting accounts securely from one place.",
      "intro": "You no longer have to juggle a separate screen, password and tab for every platform. DijiMagic connects your accounts — Meta (Facebook, Instagram, WhatsApp), Google Ads, Google Analytics, Search Console and Google Tag Manager — in a few clicks with secure authorization. From ad management to analytics and reporting, every task runs from one hub with complete data.",
      "benefits": [
        {
          "title": "One hub",
          "desc": "Brings your ad, analytics and site accounts into a single panel, so you stop tab-hopping."
        },
        {
          "title": "Secure authorization",
          "desc": "Connections are made through official authorization flows; your access details are stored securely and never exposed."
        },
        {
          "title": "Disconnect anytime",
          "desc": "Connect each integration in one click and remove it just as easily whenever you want."
        },
        {
          "title": "Unified data flow",
          "desc": "Data from every connected account meets in one place, feeding your strategy, optimization and reports from a single complete picture."
        }
      ],
      "steps": [
        {
          "title": "Pick your platform",
          "desc": "Choose the account you want to connect — Meta, Google, Google Analytics, Search Console and more — from the list."
        },
        {
          "title": "Authorize securely",
          "desc": "Approve through the official authorization screen; DijiMagic takes only the access your work needs."
        },
        {
          "title": "All in one panel",
          "desc": "The connection completes, and from then on you manage all your accounts and data from a single hub."
        }
      ],
      "ctaTitle": "Connect your accounts in minutes"
    }
  }
]
