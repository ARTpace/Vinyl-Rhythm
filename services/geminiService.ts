
import { GoogleGenAI } from "@google/genai";

// 简单的内存缓存，避免重复请求同一首歌
const storyCache = new Map<string, string>();

export const getTrackStory = async (trackName: string, artist: string) => {
  const cacheKey = `${artist}-${trackName}`;
  
  if (storyCache.has(cacheKey)) {
    return storyCache.get(cacheKey)!;
  }

  // Use process.env.API_KEY directly for initialization as per guidelines
  if (!process.env.API_KEY) {
    console.warn("[Gemini] API_KEY 无效或缺失，跳过故事生成");
    return "音乐是心灵的避风港。正在播放您的本地收藏。";
  }

  try {
    // Initialization: Must use new GoogleGenAI({ apiKey: process.env.API_KEY })
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `请简要介绍一下歌曲《${trackName}》，演唱者是${artist}。如果是一首著名的歌，请提供一些背景故事或情感内涵；如果是普通文件，请生成一段关于音乐与宁静的描述。字数100字以内。`,
      config: {
        temperature: 0.7,
      }
    });
    // Extracting Text: Use response.text directly (property, not a method)
    const text = response.text || "每一首歌都有它的灵魂，静静聆听。";
    
    // 写入缓存
    storyCache.set(cacheKey, text);
    
    return text;
  } catch (error: any) {
    // 特定处理额度耗尽错误 (429)
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
       console.warn("[Gemini] API 配额已耗尽，使用默认文案。");
       const fallback = "今日灵感已耗尽，请专心享受音乐本身的旋律。";
       storyCache.set(cacheKey, fallback); // 缓存降级文案，防止反复触发错误
       return fallback;
    }

    console.error("[Gemini API Error]:", error);
    return "音乐在指尖流转，带来片刻安宁。";
  }
};
