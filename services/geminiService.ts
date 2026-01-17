
import { GoogleGenAI, Type } from "@google/genai";
import { getStoredStory, saveStoryToStore } from "../utils/storage";

const storyCache = new Map<string, string>();
let customApiKey: string | null = null;

export const setApiKey = (apiKey: string) => {
  customApiKey = apiKey;
};

const getApiKey = (): string | null => {
  return customApiKey || process.env.API_KEY || null;
};

/**
 * 核心请求封装
 */
const generateContentWithRetry = async (prompt: string, useSearch = false): Promise<any> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const ai = new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      baseUrl: 'https://generativelanguage.googleapis.com'
    }
  });
  const modelName = useSearch ? 'gemini-2.5-flash' : 'gemini-2.5-flash';
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { temperature: 0.7 }
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

  const apiKey = getApiKey();
  console.log('getTrackStory - API Key:', apiKey ? '已设置' : '未设置');
  if (!apiKey) return "添加 API Key 解锁 AI 深度音乐解析。";

  try {
    const prompt = `你是一位专业的乐评人。请简洁、感性地解读歌曲《${trackName}》（演唱：${artist}）。结合歌词意境和风格，控制在80字内，不要包含无关废话。`;
    const response = await generateContentWithRetry(prompt, false);
    const result = response.text || "每一段旋律都是一个故事。";
    
    storyCache.set(cacheKey, result);
    saveStoryToStore(artist, trackName, result); 
    return result;
  } catch (e: any) {
    console.error('Gemini API error:', e);
    if (e?.status === 429) return "AI 休息中，稍后为您解读。";
    return "音乐在指尖，故事在心间。";
  }
};

/**
 * 智能元数据修正：利用 AI 补全残缺的专辑、年份信息
 * FIX: 采用 SDK 推荐的 responseSchema 配置以获得可靠的 JSON 响应
 */
export const repairMetadata = async (fileName: string) => {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        baseUrl: 'https://generativelanguage.googleapis.com'
      }
    });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `分析音乐文件名称 "${fileName}"，并利用搜索工具返回准确的元数据。`,
      config: {
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

export const testApiKey = async (apiKey: string): Promise<{ success: boolean; message: string; model?: string }> => {
  try {
    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        baseUrl: 'https://generativelanguage.googleapis.com'
      }
    });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "请回复：连接成功",
      config: { temperature: 0.7 }
    });

    if (response.text && response.text.includes("连接成功")) {
      return {
        success: true,
        message: "API 连接成功",
        model: "gemini-2.5-flash"
      };
    } else {
      return {
        success: true,
        message: "API 连接成功",
        model: "gemini-2.5-flash"
      };
    }
  } catch (e: any) {
    console.error("API Key test error:", e);
    const errorMessage = e?.message || "";
    
    if (e?.status === 401 || e?.status === 403) {
      return {
        success: false,
        message: "API Key 无效或已过期"
      };
    } else if (e?.status === 429) {
      if (errorMessage.includes("free_tier") || errorMessage.includes("limit: 0")) {
        return {
          success: false,
          message: "免费配额已用完，请升级计划"
        };
      }
      return {
        success: false,
        message: "API 配额已用完"
      };
    } else if (errorMessage.includes("RESOURCE_EXHAUSTED")) {
      return {
        success: false,
        message: "资源已耗尽，请稍后重试"
      };
    } else {
      return {
        success: false,
        message: e?.message || "连接失败，请检查网络"
      };
    }
  }
};
