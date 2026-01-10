
import { GoogleGenAI, Type } from "@google/genai";
import { getStoredStory, saveStoryToStore } from "../utils/storage";

const storyCache = new Map<string, string>();

/**
 * 核心请求封装
 */
const generateContentWithRetry = async (prompt: string, useSearch = false): Promise<any> => {
  if (!process.env.API_KEY) throw new Error("API_KEY_MISSING");

  // FIX: 始终使用命名参数对象初始化实例
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = useSearch ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  
  const config: any = { temperature: 0.7 };
  if (useSearch) config.tools = [{ googleSearch: {} }];

  // FIX: 调用 generateContent 时直接传入模型名称和内容
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
    // FIX: 使用 .text 属性直接提取文本内容
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
 * FIX: 采用 SDK 推荐的 responseSchema 配置以获得可靠的 JSON 响应
 */
export const repairMetadata = async (fileName: string) => {
  if (!process.env.API_KEY) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `分析音乐文件名称 "${fileName}"，并利用搜索工具返回准确的元数据。`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "歌曲标题" },
            artist: { type: Type.STRING, description: "歌手或艺人" },
            album: { type: Type.STRING, description: "所属专辑" },
            year: { type: Type.INTEGER, description: "发行年份" },
            genre: { type: Type.STRING, description: "音乐流派" }
          },
          required: ["title", "artist", "album"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    return null;
  } catch (e) {
    console.error("Gemini repair metadata error:", e);
    return null;
  }
};
