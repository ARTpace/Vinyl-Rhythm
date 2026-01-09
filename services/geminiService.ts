
import { GoogleGenAI } from "@google/genai";

// 简单的内存缓存
const storyCache = new Map<string, string>();
const metadataCache = new Map<string, any>();

/**
 * 封装带有指数退避重试机制的内容生成函数
 */
const generateContentWithRetry = async (prompt: string, useSearch = false, maxRetries = 3): Promise<any> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const config: any = {
        temperature: 0.5,
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
      if ((error?.status === 429 || error?.status >= 500) && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw error;
    }
  }
};

export const getTrackStory = async (trackName: string, artist: string) => {
  const cacheKey = `story-${artist}-${trackName}`;
  if (storyCache.has(cacheKey)) return storyCache.get(cacheKey)!;
  if (!process.env.API_KEY) return "音乐是心灵的避风港。";

  try {
    const prompt = `请简要介绍歌曲《${trackName}》，演唱者是${artist}。字数100字以内。`;
    const response = await generateContentWithRetry(prompt);
    const result = response.text || "每一首歌都有它的灵魂。";
    storyCache.set(cacheKey, result);
    return result;
  } catch (e) {
    return "音乐在指尖流转，带来片刻安宁。";
  }
};

/**
 * 智能刮削：获取更准确的元数据
 */
export const scrapeTrackMetadata = async (trackName: string, artist: string, album: string) => {
  const cacheKey = `meta-${artist}-${trackName}-${album}`;
  if (metadataCache.has(cacheKey)) return metadataCache.get(cacheKey);

  try {
    const prompt = `作为音乐专家，请搜索并提供歌曲《${trackName}》（歌手：${artist}，参考专辑：${album}）的准确元数据。
    请必须以 JSON 格式返回，不要包含任何 Markdown 标记，格式如下：
    {
      "title": "准确歌名",
      "artist": "准确歌手名",
      "album": "最知名的专辑名",
      "year": "发行年份(数字)",
      "genre": "音乐流派",
      "bpm": "大概BPM(数字，未知填0)",
      "description": "一句话介绍内容"
    }`;

    const response = await generateContentWithRetry(prompt, true);
    // 尝试解析 JSON，Gemini 有时会返回包含 ```json 的字符串
    let cleanText = response.text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(cleanText);
    metadataCache.set(cacheKey, data);
    return data;
  } catch (e) {
    console.error("[Scraper Error]", e);
    return null;
  }
};
