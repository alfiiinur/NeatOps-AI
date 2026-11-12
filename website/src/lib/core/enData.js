// Terjemahan Inggris untuk teks hasil simulator (kunci = teks Indonesia persis).
// Teks tersimpan di riwayat/project berbahasa Indonesia, jadi diterjemahkan saat ditampilkan.

export const EN_DATA = {
  // Status
  "Aman": "Safe",
  "Perlu Perhatian": "Needs Attention",
  "Berbahaya": "Dangerous",
  "Rak dalam kondisi baik. Tinggal jaga rutinitas perawatan.": "The rack is in good condition. Just keep up routine maintenance.",
  "Ada temuan yang sebaiknya diperbaiki sebelum jadi gangguan.": "There are findings that should be fixed before they become outages.",
  "Ada temuan kritis. Prioritaskan perbaikan secepatnya.": "There are critical findings. Prioritize fixing them as soon as possible.",

  // Kategori
  "Kabel": "Cables",
  "Daya": "Power",
  "Ventilasi": "Ventilation",
  "Grounding": "Grounding",
  "Label": "Labels",
  "Struktur": "Structure",
  "Suhu": "Temperature",

  // Hardware (merek & tipe sudah berbahasa Inggris / netral)
  "Konektivitas": "Connectivity",
  "Jaringan": "Network",
  "Server": "Servers",
  "Keamanan": "Security",
  "Storage": "Storage",
  "Manajemen": "Management",

  // Temuan
  "Kabel daya & data berserakan tanpa manajemen": "Power & data cables scattered without management",
  "Kabel menggantung bebas dan saling menyilang antar unit. Risiko tersangkut saat perawatan dan sulit dilacak saat gangguan.":
    "Cables hang loose and cross between units. They risk snagging during maintenance and are hard to trace during incidents.",
  "Kelompokkan kabel daya (kiri) dan kabel data (kanan) ke jalur terpisah.": "Group power cables (left) and data cables (right) into separate routes.",
  "Pasang cable management horizontal 1U tiap 2–3 unit perangkat.": "Install a 1U horizontal cable manager every 2–3 devices.",
  "Ikat tiap bundel dengan velcro, bukan kabel ties plastik yang menjepit.": "Bundle with velcro straps, not plastic cable ties that pinch.",
  "TIA-942-B §6 — pemisahan jalur daya & data": "TIA-942-B §6 — separation of power & data pathways",
  "±1–2 jam · Velcro + 2× cable manager 1U": "~1–2 hours · Velcro + 2× 1U cable manager",

  "Steker menumpuk pada satu stop kontak": "Plugs piled onto a single outlet",
  "Beberapa beban besar (server + switch + monitor) menumpuk pada satu titik. Satu titik longgar bisa memadamkan seluruh rak.":
    "Several large loads (server + switch + monitor) are stacked on one point. A single loose connection can shut down the whole rack.",
  "Ganti terminal rakitan dengan PDU rak 19″ yang punya sakelar per grup.": "Replace the improvised power strip with a 19″ rack PDU that has a switch per group.",
  "Sebar beban ke minimal dua sirkuit berbeda bila tersedia.": "Spread the load across at least two different circuits if available.",
  "Beri label beban pada tiap soket PDU.": "Label the load on each PDU socket.",
  "PUIL 2020 §4 — proteksi sirkuit & pembebanan": "PUIL 2020 §4 — circuit protection & loading",
  "±1 jam · 1× PDU rak + label": "~1 hour · 1× rack PDU + labels",

  "Aliran udara panas-dingin tercampur": "Hot and cold airflow mixing",
  "Slot kosong antar unit tidak tertutup blanking panel sehingga udara panas bersirkulasi kembali ke inlet perangkat.":
    "Empty slots between units are not covered by blanking panels, so hot air recirculates back to the device intakes.",
  "Tutup semua slot U kosong dengan blanking panel.": "Cover all empty U slots with blanking panels.",
  "Pastikan arah kipas konsisten: dingin depan, panas belakang.": "Make sure fan direction is consistent: cold front, hot rear.",
  "Jaga jarak minimal 15 cm di belakang rak untuk exhaust.": "Keep at least 15 cm behind the rack for exhaust.",
  "ASHRAE TC 9.9 — manajemen aliran udara rak": "ASHRAE TC 9.9 — rack airflow management",
  "±30 mnt · Blanking panel secukupnya": "~30 min · Enough blanking panels",

  "Kabel grounding rak tidak terlihat / putus": "Rack grounding cable missing / broken",
  "Tidak ada jalur bonding yang jelas antara bodi rak dan busbar ground. Berbahaya saat ada kebocoran arus ke bodi.":
    "There is no clear bonding path between the rack body and the ground busbar. Dangerous when current leaks to the body.",
  "Pasang kabel bonding 6 mm² dari bodi rak ke busbar ground ruangan.": "Install a 6 mm² bonding cable from the rack body to the room's ground busbar.",
  "Pastikan tiap rel & pintu kabinet ikut ter-bonding.": "Make sure every rail & cabinet door is bonded too.",
  "Ukur tahanan grounding, target di bawah 5 ohm.": "Measure the grounding resistance, target below 5 ohm.",
  "PUIL 2020 §3 — sistem pembumian": "PUIL 2020 §3 — earthing system",
  "Butuh teknisi listrik · ±2 jam": "Electrician needed · ~2 hours",

  "Kabel & port tanpa label sama sekali": "Cables & ports with no labels at all",
  "Tidak satu pun kabel berlabel. Teknisi harus mengurut manual tiap ada insiden — MTTR bisa berlipat.":
    "Not a single cable is labeled. Technicians must trace them manually in every incident — MTTR can multiply.",
  "Labeli kedua ujung tiap kabel: asal → tujuan + nomor port.": "Label both ends of every cable: source → destination + port number.",
  "Tempel denah port switch di pintu dalam rak.": "Attach the switch port map to the inside of the rack door.",
  "Catat pemetaan di dokumen / spreadsheet sederhana.": "Record the mapping in a simple document / spreadsheet.",
  "TIA-606-C — administrasi & pelabelan": "TIA-606-C — administration & labeling",
  "±1 jam · Label + spidol kabel": "~1 hour · Labels + cable marker",

  "Unit terberat dipasang di posisi atas": "Heaviest units mounted at the top",
  "Server/UPS berat berada di U atas. Rak jadi top-heavy dan rawan roboh saat pintu dibuka atau dipindah.":
    "Heavy servers/UPS are in the upper U positions. The rack becomes top-heavy and prone to tipping when the door is opened or it is moved.",
  "Pindahkan UPS & server berat ke U bawah (U1–U6).": "Move the UPS & heavy servers to the lower U positions (U1–U6).",
  "Pasang perangkat ringan (patch panel, switch) di U atas.": "Mount lighter devices (patch panel, switch) in the upper U positions.",
  "Baut kaki rak ke lantai / pasang anti-tip bracket.": "Bolt the rack feet to the floor / install an anti-tip bracket.",
  "Pedoman instalasi rak 19″ — distribusi beban bawah-berat": "19″ rack installation guide — bottom-heavy load distribution",
  "±2 jam · Butuh 2 orang (angkat beban)": "~2 hours · 2 people needed (heavy lifting)",

  "Debu tebal di intake & kipas": "Thick dust on intakes & fans",
  "Tumpukan debu di ventilasi menghambat aliran udara dan menaikkan suhu kerja perangkat.":
    "Dust buildup on vents blocks airflow and raises device operating temperature.",
  "Bersihkan filter & intake dengan blower / vacuum anti-statis.": "Clean filters & intakes with a blower / anti-static vacuum.",
  "Jadwalkan bersih berkala tiap 3 bulan.": "Schedule cleaning every 3 months.",
  "Pertimbangkan filter debu bila ruangan berdebu.": "Consider a dust filter if the room is dusty.",
  "Praktik O&M ruang server — housekeeping berkala": "Server room O&M practice — periodic housekeeping",
  "±30 mnt · Blower": "~30 min · Blower",

  "Kabel terjepit pintu / rel geser": "Cable pinched by door / sliding rail",
  "Ada kabel yang terjepit engsel pintu dan rel server geser. Isolasi bisa terkupas dan korsleting.":
    "A cable is pinched by the door hinge and the server slide rail. The insulation can wear off and cause a short circuit.",
  "Bebaskan kabel terjepit dan periksa isolasi yang luka.": "Free the pinched cable and check for damaged insulation.",
  "Ganti kabel yang isolasinya rusak, jangan diisolasi ulang untuk daya.": "Replace cables with damaged insulation; do not re-tape power cables.",
  "Atur radius tekuk minimal 4× diameter kabel.": "Keep a bend radius of at least 4× the cable diameter.",
  "PUIL 2020 — instalasi kabel bebas jepitan & tarikan": "PUIL 2020 — cable installation free from pinching & strain",
  "±45 mnt · Kabel pengganti": "~45 min · Replacement cable",

  "MCB / breaker tanpa identitas sirkuit": "MCB / breaker without circuit identification",
  "Panel breaker tidak berlabel sehingga teknisi menebak sirkuit saat darurat — downtime tak perlu.":
    "The breaker panel is unlabeled, so technicians guess the circuit in emergencies — unnecessary downtime.",
  "Beri label tiap MCB: nama sirkuit + nomor rak yang dilayani.": "Label each MCB: circuit name + number of the rack it serves.",
  "Tempel single-line diagram sederhana di pintu panel.": "Attach a simple single-line diagram to the panel door.",
  "Uji trip tiap MCB minimal setahun sekali.": "Trip-test each MCB at least once a year.",
  "PUIL 2020 — identifikasi gawai proteksi": "PUIL 2020 — identification of protective devices",
  "±45 mnt · Label + diagram": "~45 min · Labels + diagram",

  "Indikasi hotspot di area tengah rak": "Hotspot indication in the middle of the rack",
  "Pola penumpukan perangkat rapat di tengah tanpa spasi menghambat pembuangan panas lokal.":
    "Devices packed tightly in the middle with no spacing hinder local heat dissipation.",
  "Beri spasi 1U antar perangkat yang panas (server–server).": "Leave 1U spacing between hot devices (server–server).",
  "Pasang sensor suhu di U atas, tengah, bawah.": "Install temperature sensors at the top, middle, and bottom U.",
  "Target suhu inlet 18–27 °C sesuai kelas perangkat.": "Target inlet temperature 18–27 °C according to the device class.",
  "ASHRAE TC 9.9 — rentang suhu inlet yang dianjurkan": "ASHRAE TC 9.9 — recommended inlet temperature range",
  "±1 jam · Sensor suhu (opsional)": "~1 hour · Temperature sensor (optional)",

  "Akses perawatan terhalang barang": "Maintenance access blocked by items",
  "Ada barang / kardus menumpuk di depan rak sehingga pintu tak terbuka penuh dan teknisi sulit bekerja.":
    "Items / boxes pile up in front of the rack so the door can't open fully and technicians have trouble working.",
  "Kosongkan area kerja 1 meter di depan & belakang rak.": "Clear a 1-meter work area in front of and behind the rack.",
  "Pindahkan stok kabel/kardus ke gudang, bukan di lorong rak.": "Move cable stock/boxes to storage, not the rack aisle.",
  "Beri garis lantai area bebas halangan.": "Mark the obstruction-free area with floor lines.",
  "Praktik K3 ruang elektrikal — akses evakuasi & kerja": "Electrical room OHS practice — evacuation & work access",
  "±20 mnt · Tanpa alat": "~20 min · No tools",

  "Kabel patch melompat antar U secara acak": "Patch cables jumping randomly between U positions",
  "Patch cord panjang melintang menutupi LED status & ventilasi depan switch.":
    "Long patch cords run across and cover the status LEDs & front ventilation of the switch.",
  "Ganti dengan patch cord sesuai panjang kebutuhan (0,5 / 1 m).": "Replace with patch cords of the needed length (0.5 / 1 m).",
  "Lewatkan tiap patch cord melalui cable manager terdekat.": "Route each patch cord through the nearest cable manager.",
  "Samakan warna per fungsi: mis. biru data, kuning uplink, merah darurat.": "Standardize colors per function: e.g. blue data, yellow uplink, red emergency.",
  "TIA-942-B — manajemen patch cord": "TIA-942-B — patch cord management",
  "±1 jam · Patch cord pendek + kode warna": "~1 hour · Short patch cords + color coding",

  // Rencana perapian
  "Susun ulang per perangkat": "Rearrange by device",
  "UPS & server berat ke U1–U6, switch & patch panel ke U atas.": "Heavy UPS & servers to U1–U6, switches & patch panels to the upper U.",
  "Rapikan jalur kabel": "Tidy the cable pathways",
  "Daya lewat kanal kiri, data lewat kanal kanan + cable manager 1U tiap 2–3 unit.":
    "Power through the left channel, data through the right channel + a 1U cable manager every 2–3 units.",
  "Benahi distribusi daya": "Fix power distribution",
  "PDU rak 19″ + label tiap soket dan MCB sesuai sirkuit.": "19″ rack PDU + labels on each socket and MCB per circuit.",
  "Perbaiki aliran udara": "Improve airflow",
  "Blanking panel di slot kosong + spasi 1U antar perangkat panas.": "Blanking panels in empty slots + 1U spacing between hot devices.",
  "Perbaiki grounding": "Fix grounding",
  "Bonding 6 mm² rak → busbar ground, ukur tahanan < 5 ohm.": "6 mm² bonding rack → ground busbar, measure resistance < 5 ohm.",
  "Labeli semuanya": "Label everything",
  "Label dua ujung kabel + denah port di pintu dalam rak.": "Label both cable ends + port map on the inside of the rack door.",
  "Amankan kabel terjepit": "Secure pinched cables",
  "Bebaskan dari engsel/rel, ganti yang isolasinya luka.": "Free from hinges/rails, replace those with damaged insulation.",
  "Bebaskan area kerja": "Clear the work area",
  "Zona 1 m depan–belakang rak harus kosong dari barang.": "The 1 m zone in front of and behind the rack must be free of items.",
  "Pertahankan kondisi": "Maintain the condition",
  "Jadwalkan inspeksi visual tiap bulan agar tetap rapi.": "Schedule a monthly visual inspection to keep it tidy.",

  // Denah
  "Patch panel 24p": "Patch panel 24p",
  "Cable manager": "Cable manager",
  "Switch 24p": "Switch 24p",
  "Server aplikasi 1U": "Application server 1U",
  "Blanking + spasi": "Blanking + spacing",
  "Server database 2U": "Database server 2U",
  "↳ (lanjutan)": "↳ (continued)",
  "PDU rak 19″": "19″ rack PDU",
  "UPS 2U": "UPS 2U",
  "Baterai / stabilizer": "Battery / stabilizer",

  // Rute kabel
  "jalur data → kanal kanan": "data route → right channel",
  "patch cord pendek via manager": "short patch cord via manager",
  "jalur daya → PDU": "power route → PDU",
  "UPS → PDU": "UPS → PDU",
};
