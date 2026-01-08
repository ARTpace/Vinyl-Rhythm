
import { GoogleGenAI } from "@google/genai";

// 简单的内存缓存，避免重复请求同一首歌
const storyCache = new Map<string, string>();

/**
 * 封装带有指数退避重试机制的内容生成函数
 * 遵循 API Error Handling 准则，应对 500/503 等暂时性后端错误
 */
const generateContentWithRetry = async (prompt: string, maxRetries = 3): Promise<string> => {
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 每次调用创建新实例以确保状态最新
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        // 使用稳定版别名，避免预览版可能出现的后端同步问题
        model: 'gemini-flash-latest', 
        contents: prompt,
        config: {
          temperature: 0.7,
          // 基础文本生成任务禁用思考预算，减少 Rpc 复杂度
          thinkingConfig: { thinkingBudget: 0 }
        },
      });

      // 提取结果并返回
      return response.text || "";
    } catch (error: any) {
      lastError = error;
      const status = error?.status;
      const message = error?.message || "";

      // 确定错误是否可重试：速率限制 (429)、服务器错误 (5xx) 或网络 XHR 错误
      const isRetryable = 
        status === 429 || 
        status >= 500 || 
        message.includes('500') || 
        message.includes('UNKNOWN') || 
        message.includes('xhr error');

      if (isRetryable && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
        console.warn(`[Gemini] 第 ${attempt + 1} 次尝试失败: ${message.substring(0, 100)}。正在 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // 如果不可重试或已达最大次数，抛出错误
      throw error;
    }
  }
  return "";
};

export const getTrackStory = async (trackName: string, artist: string) => {
  const cacheKey = `${artist}-${trackName}`;
  
  if (storyCache.has(cacheKey)) {
    return storyCache.get(cacheKey)!;
  }

  if (!process.env.API_KEY) {
    console.warn("[Gemini] API_KEY 无效或缺失，跳过故事生成");
    return "音乐是心灵的避风港。正在播放您的本地收藏。";
  }

  try {
    const prompt = `请简要介绍一下歌曲《${trackName}》，演唱者是${artist}。如果是一首著名的歌，请提供一些背景故事或情感内涵；如果是普通文件，请生成一段关于音乐与宁静的描述。字数100字以内。`;
    
    // 执行带重试的调用
    const text = await generateContentWithRetry(prompt);
    const result = text || "每一首歌都有它的灵魂，静静聆听。";
    
    // 写入缓存
    storyCache.set(cacheKey, result);
    return result;
  } catch (error: any) {
    // 处理特定的配额错误
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
       console.warn("[Gemini] API 配额已耗尽，使用静默降级。");
       const fallback = "今日灵感已耗尽，请专心享受音乐本身的旋律。";
       storyCache.set(cacheKey, fallback); 
       return fallback;
    }

    console.error("[Gemini API Final Error]:", error);
    return "音乐在指尖流转，带来片刻安宁。";
  }
};
