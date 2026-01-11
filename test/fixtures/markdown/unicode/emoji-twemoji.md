# Emoji Rendering

Hello 😀 world 🎉 (emoji should render).


# Emoji Torture Test 💥😵‍💫🧪

This document intentionally abuses emoji to test rendering correctness,
layout stability, wrapping behavior, and Unicode handling.

---

## 1) Basic emoji sanity check

😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇  
🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚  
😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔  

---

## 2) Emotion extremes (face stress)

😐 😑 😶 🫥 🫠  
😕 😟 🙁 ☹️ 😮 😯 😲 😳  
🥺 😢 😭 😤 😠 😡 🤬  
😱 😨 😰 😥 😓 🤯  

---

## 3) Skin tone modifiers (Fitzpatrick scale)

👍 👍🏻 👍🏼 👍🏽 👍🏾 👍🏿  
🙏 🙏🏻 🙏🏼 🙏🏽 🙏🏾 🙏🏿  
👋 👋🏻 👋🏼 👋🏽 👋🏾 👋🏿  
🤝 🤝🏻 🤝🏼 🤝🏽 🤝🏾 🤝🏿  

---

## 4) Zero-Width-Joiner (ZWJ) sequences (hard mode)

👨‍👩‍👧  
👨‍👩‍👧‍👦  
👩‍❤️‍👩  
👨‍❤️‍👨  
👩‍👩‍👦‍👦  
👨‍👨‍👧‍👧  
🧑‍💻 👩‍💻 👨‍💻  
🧑‍🚀 👩‍🚀 👨‍🚀  
🧑‍🎨 👩‍🎨 👨‍🎨  

---

## 5) Gender + profession + skin tone (combinatorial explosion)

👩🏻‍⚕️ 👩🏼‍⚕️ 👩🏽‍⚕️ 👩🏾‍⚕️ 👩🏿‍⚕️  
👨🏻‍🚒 👨🏼‍🚒 👨🏽‍🚒 👨🏾‍🚒 👨🏿‍🚒  
🧑🏻‍🏫 🧑🏼‍🏫 🧑🏽‍🏫 🧑🏾‍🏫 🧑🏿‍🏫  

---

## 6) Flags (regional indicator pairs)

🇺🇸 🇨🇦 🇫🇷 🇩🇪 🇪🇸 🇵🇹 🇮🇹 🇯🇵 🇰🇷 🇨🇳  
🇧🇷 🇦🇷 🇨🇱 🇲🇽 🇦🇺 🇳🇿 🇬🇧 🇮🇪 🇳🇴 🇸🇪  
🇮🇸 🇫🇮 🇩🇰 🇳🇱 🇧🇪 🇨🇭 🇦🇹 🇵🇱 🇨🇿 🇸🇰  

---

## 7) Emoji vs text presentation selectors

❤ ❤️  
✈ ✈️  
☀ ☀️  
⚠ ⚠️  
☎ ☎️  

(These should render **differently** depending on variation selector support.)

---

## 8) Emoji inside sentences (line-breaking stress)

The 🚀 launched at 🕒 exactly, while 👩‍🚀👨‍🚀👨‍🚀 watched from 🌍.
Please do not 🔥 the 🧪 while 🤖 is 🤯.
Payment accepted via 💳, 🪙, or 🐚 (terms apply).

---

## 9) Dense emoji wall (font fallback stress)

😀😃😄😁😆😅😂🤣😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😜🤪😝🤑🤗🤭🤫🤔  
🐶🐱🐭🐹🐰🦊🐻🐼🐻‍❄️🐨🐯🦁🐮🐷🐸🐵  
🍎🍊🍋🍌🍉🍇🍓🫐🍒🍑🥭🍍🥥🥝  

---

## 10) Emoji tables (alignment & width torture)

| Type | Example | Notes |
|---|---|---|
| Faces | 😀 😭 🤯 | Mixed widths |
| ZWJ | 👨‍👩‍👧‍👦 | Should be ONE glyph |
| Tone | 👍🏽 | Modifier applied |
| Flag | 🇨🇦 | Two codepoints |
| VS16 | ✈️ | Emoji presentation |

---

## 11) Emoji in headings

## 🚧 WARNING: 🚀🔥💣
### 🧠 Cognitive overload 😵‍💫😵‍💫😵‍💫
#### 👁️‍🗨️ ZWJ + VS + RTL? (good luck)

---

## 12) Emoji in code blocks (must be verbatim)

Inline: `😀 👨‍👩‍👧‍👦 👍🏽 🇨🇦 ❤️`

Fenced:

```txt
😀 😃 😄 😁
👨‍👩‍👧‍👦
👍 👍🏻 👍🏼 👍🏽 👍🏾 👍🏿
✈ ✈️ ❤ ❤️
🇨🇦 🇫🇷 🇩🇪
```

# PDF Emoji Rendering Torture Test
_Color vs Monochrome · Embedding vs Substitution_

> Goal: detect whether emojis are rendered as **color glyphs**, **monochrome outlines**, or **fallback boxes** in the final PDF.

---

## 1) Baseline: simple emoji (should be color if supported)

😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇  
🔥 🚀 ❤️ ⭐ ⚠️ ☎️ ✈️  

Expected:
- Color-capable PDF engines → full color glyphs
- Outline-only engines → black/gray outlines
- Broken pipelines → □ or �

---

## 2) Variation Selectors (critical for PDF engines)

Text presentation (VS15 or default):
- ❤ ✈ ⚠ ☎

Emoji presentation (VS16):
- ❤️ ✈️ ⚠️ ☎️

**Expectation**:
- These MUST render differently if VS is respected.
- Many PDF engines ignore VS → identical output (BUG).

---

## 3) ZWJ sequences (single glyph or bust)

👨‍👩‍👧  
👨‍👩‍👧‍👦  
👩‍❤️‍👩  
👨‍❤️‍👨  
🧑‍💻 👩‍💻 👨‍💻  

**Expectation**:
- Correct: one composed glyph
- Broken: visible gaps, separate emojis, or missing glyphs

---

## 4) Skin tone modifiers (glyph stacking test)

👍 👍🏻 👍🏼 👍🏽 👍🏾 👍🏿  
🙏 🙏🏻 🙏🏼 🙏🏽 🙏🏾 🙏🏿  

**Failure modes**:
- Tone missing
- Base emoji duplicated
- Modifier rendered as square

---

## 5) Flags (regional indicator pairs)

🇺🇸 🇨🇦 🇫🇷 🇩🇪 🇯🇵 🇰🇷 🇧🇷 🇦🇺  

**Expectation**:
- ONE glyph per flag
- Two-letter fallback = broken shaping

---

## 6) Emoji + text flow (line breaking in PDF)

This sentence contains emoji that must align correctly with baseline:
The 🚀 launched at 🕒 while 👩‍🚀👨‍🚀 observed from 🌍.

If emoji sit too high/low or overlap text, font metrics are wrong.

---

## 7) Font fallback stress (mixed families)

Sans-serif text 😀  
Serif text 😀  
Monospace text 😀  

Inline code: `😀 👨‍👩‍👧‍👦 👍🏽 🇨🇦 ❤️`

**Expectation**:
- Emoji should not inherit serif/mono outlines unless forced
- Color emoji often ignore surrounding font family

---

## 8) Tables (alignment + row height)

| Type | Emoji | Expected |
|---|---|---|
| Simple | 😀 | Color or outline |
| ZWJ | 👨‍👩‍👧‍👦 | Single glyph |
| Tone | 👍🏽 | Modifier applied |
| Flag | 🇨🇦 | One glyph |
| VS | ✈️ | Emoji style |

Row height explosions = emoji ascent/descent bug.

---

## 9) Headings (scale & hinting)

## 🚧 WARNING 🚧
### 🚀🔥💣 SYSTEM OVERLOAD
#### 👁️‍🗨️ Emoji at small sizes

**Expectation**:
- No pixelation
- No fallback at smaller sizes

---

## 10) Repetition (embedding deduplication)

😀😀😀😀😀😀😀😀😀😀  
👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦  
👍🏽👍🏽👍🏽👍🏽👍🏽  

PDF should **reuse glyphs**, not embed duplicates.

---

## 11) Monochrome fallback detection block

If your PDF engine does NOT support color emoji fonts,
the following will typically appear as **black outlines**:

😀 😎 🤖 🐍 🚀 ❤️ 🇨🇦

If they appear as □ or ?, the fallback font is missing.

---

## 12) Code block (must be verbatim, no substitution)

```txt
😀 😃 😄 😁
👨‍👩‍👧‍👦
👍 👍🏻 👍🏼 👍🏽 👍🏾 👍🏿
✈ ✈️ ❤ ❤️
🇨🇦 🇫🇷 🇩🇪

