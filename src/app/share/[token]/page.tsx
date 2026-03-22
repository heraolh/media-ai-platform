import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareView } from "./ShareView";

const API_BASE = process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

async function fetchShareData(token: string) {
  try {
    const res = await fetch(`${API_BASE}/api/share/${token}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(
  props: PageProps<"/share/[token]">
): Promise<Metadata> {
  const { token } = await props.params;
  const data = await fetchShareData(token);
  if (!data) return { title: "分享内容 — Media AI Platform" };

  const typeLabels: Record<string, string> = {
    image: "AI 生成图片", video: "AI 生成视频", speech: "AI 语音合成",
    workflow: "AI 工作流成果", image_understand: "图片理解结果", speech_to_text: "语音转文字结果",
  };
  const label = typeLabels[data.content_type] ?? "AI 创作内容";
  const description = `来自 Media AI Platform 的${label}，有效期剩余 ${data.expires_in} 小时`;
  const imageUrl = data.content?.image_url || data.content?.input_image_url || data.content?.results?.image || undefined;
  const videoUrl = data.content?.video_url || data.content?.results?.video || undefined;

  return {
    title: `${label} — Media AI Platform`,
    description,
    openGraph: {
      title: `${label} — Media AI Platform`,
      description,
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
      ...(videoUrl ? { videos: [{ url: videoUrl }] } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: `${label} — Media AI Platform`,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function SharePage(props: PageProps<"/share/[token]">) {
  const { token } = await props.params;
  const data = await fetchShareData(token);
  if (!data) notFound();
  return <ShareView data={data} />;
}
