
import { GoogleGenAI } from "@google/genai";
import { getStoredStory, saveStoryToStore } from "../utils/storage";

// 内存缓存（防止单次会话内重复读取磁盘）
const storyCache = new Map<string, string>();

/**
 * 封装带有指数退避重试机制的内容生成函数
 */
const generateContentWithRetry = async (prompt: string, useSearch = false, maxRetries = 2): Promise<any> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY_MISSING");
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config: any = {
        temperature: 0.7,
      };

      if (useSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: prompt,
        config: config,
      });

      return response;
    } catch (error: any) {
      const status = error?.status;
      // 如果是配额超出 (429)，在尝试最后一次前等待
      if ((status === 429 || status >= 500) && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(4, attempt) * 1000));
        continue;
      }
      throw error;
    }
  }
};

/**
 * 获取歌曲解读（带持久化缓存）
 */
export const getTrackStory = async (trackName: string, artist: string) => {
  const cacheKey = `${artist}-${trackName}`;
  
  // 1. 尝试从内存缓存读取
  if (storyCache.has(cacheKey)) {
    return storyCache.get(cacheKey)!;
  }

  // 2. 尝试从 IndexedDB 磁盘存储读取
  const storedStory = await getStoredStory(artist, trackName);
  if (storedStory) {
    storyCache.set(cacheKey, storedStory); // 回填内存缓存
    return storedStory;
  }

  // 3. 都没有，则调用 API
  if (!process.env.API_KEY) return "添加 API Key 即可解锁 AI 音乐深度解读。";

  try {
    const prompt = `你是一位深情的音乐评论家。请简要解读歌曲《${trackName}》，演唱者是${artist}。请结合音乐风格和歌词意境，字数控制在80字以内，语气要优美。`;
    const response = await generateContentWithRetry(prompt);
    const result = response.text || "每一首歌都有它的灵魂。";
    
    // 4. 存入内存并异步保存到磁盘
    storyCache.set(cacheKey, result);
    saveStoryToStore(artist, trackName, result); 
    
    return result;
  } catch (e: any) {
    console.error("[Gemini Service Error]", e);
    if (e?.status === 429) {
      return "AI 正在小憩（配额达到上限），稍后再为您解读这首动人的旋律。";
    }
    return "音乐在指尖流转，每一段旋律都是独一无二的故事。";
  }
};

/**
 * 智能刮削：获取更准确的元数据（此部分建议也增加类似缓存逻辑，但目前以 Story 为主）
 */
export const scrapeTrackMetadata = async (trackName: string, artist: string, album: string) => {
  try {
    const prompt = `作为音乐专家，请搜索并提供歌曲《${trackName}》（歌手：${artist}，参考专辑：${album}）的准确元数据。
    请必须以 JSON 格式返回，格式如下：
    {
      "title": "准确歌名",
      "artist": "准确歌手名",
      "album": "最知名的专辑名",
      "year": "发行年份",
      "genre": "流派"
    }`;

    const response = await generateContentWithRetry(prompt, true);
    let cleanText = response.text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    return null;
  }
};
