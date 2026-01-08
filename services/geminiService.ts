
import { GoogleGenAI } from "@google/genai";

export const getTrackStory = async (trackName: string, artist: string) => {
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
    return response.text || "每一首歌都有它的灵魂，静静聆听。";
  } catch (error) {
    console.error("[Gemini API Error]:", error);
    return "音乐在指尖流转，带来片刻安宁。";
  }
};
