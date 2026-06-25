# Faz 1 — Ordered case-aware string/identifier replace (perl -p ile satır-satır).
# SIRA KRİTİK: önce bileşik/uzun/özel token'lar, sonra jenerik çekirdek token'lar.
# Byte-level (use utf8 YOK) — TR karakterli literaller dosyayla aynı UTF-8 byte dizisi olarak eşleşir.

# 1) Bileşik/özel (uzundan kısaya) — domain/email/yasal-marka önce
s/info\@yodijital\.com/info\@dijimagic.com/g;
s/yoai\.yodijital\.com/dijimagic.com/g;
s/YO Dijital Medya Anonim Şirketi/DijiMagic/g;
s/YO Dijital Medya A\.Ş\./DijiMagic/g;
s/YO Dijital Medya/DijiMagic/g;
s/YO Dijital/DijiMagic/g;

# 2) Algoritma ailesi (yoai'den önce — çakışma yok ama uzun-önce kuralı)
s/YoAlgoritma/DijiAlgoritma/g;
s/yoAlgoritma/dijiAlgoritma/g;
s/Yoalgoritma/Dijialgoritma/g;
s/YOALGORITMA/DIJIALGORITMA/g;
s/yoalgoritma/dijialgoritma/g;
s/YoAlgorithm/DijiAlgorithm/g;
s/yoAlgorithm/dijiAlgorithm/g;
s/yoalgorithm/dijialgorithm/g;

# 3) Kalan yodijital (yoai.yodijital.com + info@ zaten yukarıda işlendi)
s/yodijital/dijimagic/g;

# 4) Çekirdek marka (case-sensitive, her varyant ayrı)
s/YoAI/DijiMagic/g;
s/YoAi/DijiMagic/g;
s/Yoai/DijiMagic/g;
s/YOAI/DIJIMAGIC/g;
s/yoai/dijimagic/g;
