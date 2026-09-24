const SUPPORTED_LANGUAGES = new Set([
  "en",
  "hi",
  "mr",
  "ja",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "zh",
  "ar",
  "bn",
  "bg",
  "ca",
  "cs",
  "da",
  "el",
  "et",
  "fa",
  "fi",
  "he",
  "hr",
  "hu",
  "id",
  "ko",
  "lt",
  "lv",
  "ms",
  "nl",
  "no",
  "pl",
  "ro",
  "ru",
  "sk",
  "sl",
  "sr",
  "sv",
  "ta",
  "te",
  "th",
  "tr",
  "uk",
  "ur",
  "vi",
]);

const detectLanguage = (text) => {
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(text)) return "ja";
  if (/\p{Script=Han}/u.test(text)) return "zh";
  if (
    /\b(namaskar|ahe|mala|tumhi|kasa|kashi)\b|नमस्कार|आहे|मला|तुम्ही|कसा|कशी/i.test(
      text,
    )
  )
    return "mr";
  if (/\p{Script=Devanagari}/u.test(text)) return "hi";
  if (/\b(der|die|das|und|nicht|ist)\b/i.test(text)) return "de";
  if (/\b(bonjour|merci|comment|vous|le|la|les|des|une|est|et)\b/i.test(text))
    return "fr";
  if (/\b(el|la|los|las|una|es|que)\b/i.test(text)) return "es";
  if (/\b(il|lo|gli|una|che|non)\b/i.test(text)) return "it";
  if (/\b(o|a|os|as|uma|que|não)\b/i.test(text)) return "pt";
  if (/\b(hello|how|what|are|the|this|is|you)\b/i.test(text)) return "en";
  return "en";
};

const translateText = async (text, sourceLanguage, targetLanguage) => {
  const endpoint = process.env.TRANSLATION_API_URL;
  if (!endpoint) {
    throw new Error("Translation provider is not configured");
  }

  const isMyMemory = endpoint.includes("mymemory.translated.net");
  const requestUrl = isMyMemory
    ? `${endpoint}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${sourceLanguage}|${targetLanguage}`)}`
    : endpoint;
  const response = await fetch(requestUrl, {
    method: isMyMemory ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.TRANSLATION_API_KEY
        ? { Authorization: `Bearer ${process.env.TRANSLATION_API_KEY}` }
        : {}),
    },
    ...(isMyMemory
      ? {}
      : {
          body: JSON.stringify({
            q: text,
            source: sourceLanguage,
            target: targetLanguage,
            format: "text",
            api_key: process.env.TRANSLATION_API_KEY,
          }),
        }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok)
    throw new Error(`Translation provider returned ${response.status}`);
  const data = await response.json();
  const translatedText = isMyMemory
    ? data.responseData?.translatedText
    : data.translatedText;
  if (!translatedText) throw new Error("Translation provider returned no text");
  return translatedText;
};

module.exports = { SUPPORTED_LANGUAGES, detectLanguage, translateText };
