
import { GoogleGenAI } from "@google/genai";
import { getStoredStory, saveStoryToStore } from "../utils/storage";

const storyCache = new Map<string, string>();

/**
 * 核心请求封装
 */
const generateContentWithRetry = async (prompt: string, useSearch = false): Promise<any> => {
  if (!process.env.API_KEY) throw new Error("API_KEY_MISSING");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = useSearch ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  
  const config: any = { temperature: 0.7 };
  if (useSearch) config.tools = [{ googleSearch: {} }];

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config
  });

  return response;
};

/**
 * 获取歌曲背景解读（带缓存）
 */
export const getTrackStory = async (trackName: string, artist: string) => {
  const cacheKey = `${artist}-${trackName}`;
  if (storyCache.has(cacheKey)) return storyCache.get(cacheKey)!;

  const storedStory = await getStoredStory(artist, trackName);
  if (storedStory) {
    storyCache.set(cacheKey, storedStory);
    return storedStory;
  }

  if (!process.env.API_KEY) return "添加 API Key 解锁 AI 深度音乐解析。";

  try {
    const prompt = `你是一位专业的乐评人。请简洁、感性地解读歌曲《${trackName}》（演唱：${artist}）。结合歌词意境和风格，控制在80字内，不要包含无关废话。`;
    const response = await generateContentWithRetry(prompt, false);
    const result = response.text || "每一段旋律都是一个故事。";
    
    storyCache.set(cacheKey, result);
    saveStoryToStore(artist, trackName, result); 
    return result;
  } catch (e: any) {
    if (e?.status === 429) return "AI 休息中，稍后为您解读。";
    return "音乐在指尖，故事在心间。";
  }
};

/**
 * 智能元数据修正：利用 AI 补全残缺的专辑、年份信息
 */
export const repairMetadata = async (fileName: string) => {
  if (!process.env.API_KEY) return null;
  try {
    const prompt = `分析文件名 "${fileName}"，搜索并返回准确的歌曲信息。
    必须返回 JSON 格式：
    {
      "title": "歌名",
      "artist": "歌手",
      "album": "所属专辑",
      "year": 2023,
      "genre": "流派"
    }`;
    const response = await generateContentWithRetry(prompt, true);
    return JSON.parse(response.text.replace(/```json|```/g, '').trim());
  } catch (e) {
    return null;
  }
};
