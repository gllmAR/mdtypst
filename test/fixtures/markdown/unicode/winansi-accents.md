# Accent & Diacritics Stress Test (Latin-1 / ISO-8859-1)

This document is designed to stress rendering, shaping, and copy/paste of **Latin-1 accented characters**.
It intentionally mixes languages, punctuation, casing, and dense diacritic sequences.

> Scope: **Only characters representable in ISO-8859-1 (Latin-1)**.

---

## 1) Quick “Wall of Accents” (dense)

ÀÁÂÃÄÅ  àáâãäå  
ÈÉÊË  èéêë  
ÌÍÎÏ  ìíîï  
ÒÓÔÕÖ  òóôõö  
ÙÚÛÜ  ùúûü  
Ýÿ  ýÿ  
Çç  Ññ  
Ææ  Øø  Åå  
Ðð  Þþ  ß

---

## 2) Character-by-character inventory

### Uppercase vowels
- A: À Á Â Ã Ä Å
- E: È É Ê Ë
- I: Ì Í Î Ï
- O: Ò Ó Ô Õ Ö
- U: Ù Ú Û Ü
- Y: Ý

### Lowercase vowels
- a: à á â ã ä å
- e: è é ê ë
- i: ì í î ï
- o: ò ó ô õ ö
- u: ù ú û ü
- y: ý ÿ

### Consonants and special letters
- C: Ç / ç
- N: Ñ / ñ
- Ligatures: Æ / æ
- Eszett: ß
- Nordic: Ø / ø, Å / å
- Icelandic/Old Norse letters: Ð / ð, Þ / þ

---

## 3) Mixed-case torture lines (same base letter, many marks)

- aA: àÀ áÁ âÂ ãÃ äÄ åÅ
- eE: èÈ éÉ êÊ ëË
- iI: ìÌ íÍ îÎ ïÏ
- oO: òÒ óÓ ôÔ õÕ öÖ
- uU: ùÙ úÚ ûÛ üÜ
- yY: ýÝ ÿ

---

## 4) Wordlists (weird + multilingual + punctuation)

### French-ish
- l’été, Noël, déjà-vu, voilà, crème brûlée, garçon, façade, naïveté, coïncidence
- où, là-bas, rôti, hôtel, hélas, sûr, mûr, goûter, île

### German-ish
- Übergröße, München, Düsseldorf, Straße, äußerlich, fröhlich, Fußgänger, süß, heißen
- Maß, groß, Grüße, weiß, äußerst

### Spanish-ish
- señor, mañana, jalapeño, piñata, España, corazón, canción, acción, ilusión
- año, niño, soñé, cañón, muñoz

### Portuguese-ish
- São, João, coração, ação, nação, irmão, bênção, órgão, pão
- avô, avó, você, também, vovô, incrível

### Nordic / Icelandic-ish
- smörgåsbord, Malmö, Ångström, Øresund, bløt, blåbær, færøsk
- Þingvellir, þjóð, ráð, við, fjörður, æðislegt

---

## 5) “Looks-similar” traps (visual confusables)

- a á à â ã ä å
- n ñ   N Ñ
- o ó ò ô õ ö  ø
- AE Æ / ae æ
- ss ß (NOT “B”): ß ≠ B
- D Ð / d ð (NOT normal D/d)

---

## 6) Quotes, dashes, and punctuation around accents

- “Café”—‘résumé’—(naïve)—[façade]—{garçon}—<Señor>—¿mañana?—¡España!
- À l’hôtel: « déjà-vu »; Über-alles? São—Paulo; Malmö… Reykjavík!

---

## 7) Pathological repetition (copy/paste + line-wrapping stress)

Café Café Café Café Café Café Café Café Café Café  
résumé résumé résumé résumé résumé résumé résumé résumé  
mañana mañana mañana mañana mañana mañana mañana mañana  
Düsseldorf Düsseldorf Düsseldorf Düsseldorf Düsseldorf  
Þjóð Þjóð Þjóð Þjóð Þjóð Þjóð Þjóð Þjóð Þjóð Þjóð  
Ææ Ææ Ææ Ææ Ææ Ææ Ææ Ææ Ææ Ææ  
Øø Øø Øø Øø Øø Øø Øø Øø Øø Øø  
Åå Åå Åå Åå Åå Åå Åå Åå Åå Åå

---

## 8) Table stress (alignment + width + diacritics)

| Language | Example | Dense |
|---|---|---|
| FR | Café, résumé, naïve, façade | ÀÁÂÃÄÅ èéêë îï ôõö ùúûü ç |
| DE | Über, München, Düsseldorf, Straße | ÄÖÜ äöü ß Ðð Þþ |
| ES | Señor, mañana, España, jalapeño | ñ Ñ áéíóú ü ¿¡ |
| PT | São Paulo, João, coração, nação | ãõ áàâ éê í óô ú ç |
| NO/SE/IS | Malmö, Ångström, Øresund, þjóð | Åå Øø Ææ Ðð Þþ |

---

## 9) Code blocks (should be verbatim; no smart substitutions)

Plain:
    Café résumé naïve façade señor mañana España São Malmö Øresund Þjóð Ðað

Fenced:
```txt
ÀÁÂÃÄÅ àáâãäå
ÈÉÊË èéêë
ÌÍÎÏ ìíîï
ÒÓÔÕÖ òóôõö
ÙÚÛÜ ùúûü
Çç Ññ Ææ Øø Åå ß Ðð Þþ Ýý ÿ
