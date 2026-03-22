"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ImageIcon, Music, Film, Upload, Trash2, RefreshCw, Play, Pause, Loader2, X } from "lucide-react";

interface Asset {
  id: string; name: string; type: "image" | "audio" | "video";
  url: string; r2_key: string; size: number | null;
  mime_type: string | null; created_at: string;
}
type AssetTab = "image" | "audio" | "video";

function formatBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function ConfirmDialog({message,onConfirm,onCancel,loading}:{message:string;onConfirm:()=>void;onCancel:()=>void;loading:boolean}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-6 max-w-sm w-full">
        <p className="text-sm text-slate-200 mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors disabled:opacity-50">取消</button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

function Lightbox({url,onClose}:{url:string;onClose:()=>void}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90" onClick={onClose}>
      <div className="relative max-w-5xl w-full" onClick={(e)=>e.stopPropagation()}>
        <img src={url} alt="preview" className="w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" />
        <button onClick={onClose} className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
function UploadZone({tab,onUploaded}:{tab:AssetTab;onUploaded:(a:Asset)=>void}) {
  const [uploading,setUploading]=useState(false);
  const [err,setErr]=useState<string|null>(null);
  const acceptMap:Record<AssetTab,Record<string,string[]>>={
    image:{"image/*":[".png",".jpg",".jpeg",".gif",".webp"]},
    audio:{"audio/*":[".mp3",".wav",".ogg",".aac"]},
    video:{"video/*":[".mp4",".mov",".avi",".webm"]},
  };
  const onDrop=useCallback(async(files:File[])=>{
    if(!files.length)return;
    setUploading(true);setErr(null);
    const file=files[0];
    try{
      const fd=new FormData();fd.append("file",file);
      const res=await fetch("/api/upload",{method:"POST",body:fd});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"上传失败");
      if(!data.id)throw new Error("未返回资产 ID，请确认数据库迁移 004 已在 Supabase 中执行");
      onUploaded({id:data.id,name:file.name,type:data.type??tab,url:data.url,r2_key:data.path,size:file.size,mime_type:file.type,created_at:new Date().toISOString()});
    }catch(e){setErr(e instanceof Error?e.message:"上传失败");}
    finally{setUploading(false);}
  },[tab,onUploaded]);
  const {getRootProps,getInputProps,isDragActive}=useDropzone({onDrop,accept:acceptMap[tab],maxSize:200*1024*1024,multiple:false,disabled:uploading});
  const hints:Record<AssetTab,string>={image:"PNG/JPG/GIF/WebP 最大200MB",audio:"MP3/WAV/OGG/AAC 最大200MB",video:"MP4/MOV/AVI/WebM 最大200MB"};
  return (
    <div className="mb-5">
      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${isDragActive?"border-teal-400 bg-teal-500/10":uploading?"border-slate-600 opacity-60 cursor-not-allowed":"border-slate-600 hover:border-teal-500/60 hover:bg-teal-500/5"}`}>
        <input {...getInputProps()} />
        {uploading?(
          <div className="flex flex-col items-center gap-2 py-2"><Loader2 className="w-7 h-7 animate-spin text-teal-400" /><span className="text-sm text-slate-400">上传中...</span></div>
        ):(
          <div className="flex flex-col items-center gap-2 py-2">
            <Upload className="w-7 h-7 text-teal-500/70" />
            <span className="text-sm font-medium text-slate-300">{isDragActive?"放开以上传":"拖拽或点击上传"}</span>
            <span className="text-xs text-slate-500">{hints[tab]}</span>
          </div>
        )}
      </div>
      {err&&<p className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{err}</p>}
    </div>
  );
}
function ImagePanel() {
  const [items,setItems]=useState<Asset[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [confirmId,setConfirmId]=useState<string|null>(null);
  const [lightbox,setLightbox]=useState<string|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{const res=await fetch("/api/assets?type=image");const data=await res.json();if(!res.ok)throw new Error(data.error||"获取失败");setItems(data.assets??[]);}
    catch(e){setError(e instanceof Error?e.message:"获取失败");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  async function handleDelete(id:string){
    setDeletingId(id);
    try{const res=await fetch(`/api/assets?id=${encodeURIComponent(id)}`,{method:"DELETE"});const data=await res.json();if(!res.ok)throw new Error(data.error||"删除失败");setItems(prev=>prev.filter(a=>a.id!==id));}
    catch(e){setError(e instanceof Error?e.message:"删除失败");}
    finally{setDeletingId(null);setConfirmId(null);}
  }
  return (
    <div>
      {confirmId&&<ConfirmDialog message="确定删除这张图片？此操作不可撤销。" onConfirm={()=>handleDelete(confirmId)} onCancel={()=>setConfirmId(null)} loading={deletingId===confirmId}/>}
      {lightbox&&<Lightbox url={lightbox} onClose={()=>setLightbox(null)}/>}
      <UploadZone tab="image" onUploaded={(a)=>setItems(prev=>[a,...prev])}/>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">{items.length} 张图片</span>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${loading?"animate-spin":""}`}/></button>
      </div>
      {error&&<p className="text-xs text-red-400 mb-3">{error}</p>}
      {loading&&<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{[1,2,3,4].map(n=><div key={n} className="aspect-square rounded-lg bg-slate-700/50 animate-pulse"/>)}</div>}
      {!loading&&items.length===0&&!error&&(<div className="text-center py-12 text-slate-500"><ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30"/><p className="text-sm">暂无图片素材</p></div>)}
      {!loading&&items.length>0&&(
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map(a=>(
            <div key={a.id} className="group relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900/50 hover:border-teal-500/40 transition-colors">
              <button className="block w-full" onClick={()=>setLightbox(a.url)}><img src={a.url} alt={a.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"/></button>
              <div className="p-2">
                <p className="text-xs text-slate-300 truncate" title={a.name}>{a.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-500">{formatBytes(a.size)}</span>
                  <button onClick={()=>setConfirmId(a.id)} disabled={deletingId===a.id} className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"><Trash2 className="w-3.5 h-3.5"/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function AudioPanel() {
  const [items,setItems]=useState<Asset[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [confirmId,setConfirmId]=useState<string|null>(null);
  const [playingId,setPlayingId]=useState<string|null>(null);
  const audioRefs=useRef<Record<string,HTMLAudioElement>>({});
  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{const res=await fetch("/api/assets?type=audio");const data=await res.json();if(!res.ok)throw new Error(data.error||"获取失败");setItems(data.assets??[]);}
    catch(e){setError(e instanceof Error?e.message:"获取失败");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  function togglePlay(a:Asset){
    Object.entries(audioRefs.current).forEach(([id,audio])=>{if(id!==a.id){audio.pause();audio.currentTime=0;}});
    if(playingId===a.id){audioRefs.current[a.id]?.pause();setPlayingId(null);return;}
    if(!audioRefs.current[a.id]){const audio=new Audio(a.url);audio.onended=()=>setPlayingId(null);audioRefs.current[a.id]=audio;}
    audioRefs.current[a.id].play();setPlayingId(a.id);
  }
  async function handleDelete(id:string){
    if(audioRefs.current[id]){audioRefs.current[id].pause();delete audioRefs.current[id];}
    if(playingId===id)setPlayingId(null);
    setDeletingId(id);
    try{const res=await fetch(`/api/assets?id=${encodeURIComponent(id)}`,{method:"DELETE"});const data=await res.json();if(!res.ok)throw new Error(data.error||"删除失败");setItems(prev=>prev.filter(a=>a.id!==id));}
    catch(e){setError(e instanceof Error?e.message:"删除失败");}
    finally{setDeletingId(null);setConfirmId(null);}
  }
  return (
    <div>
      {confirmId&&<ConfirmDialog message="确定删除这条音频？此操作不可撤销。" onConfirm={()=>handleDelete(confirmId)} onCancel={()=>setConfirmId(null)} loading={deletingId===confirmId}/>}
      <UploadZone tab="audio" onUploaded={(a)=>setItems(prev=>[a,...prev])}/>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">{items.length} 条音频</span>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${loading?"animate-spin":""}`}/></button>
      </div>
      {error&&<p className="text-xs text-red-400 mb-3">{error}</p>}
      {loading&&<div className="space-y-2">{[1,2,3].map(n=><div key={n} className="h-14 bg-slate-700/50 rounded-lg animate-pulse"/>)}</div>}
      {!loading&&items.length===0&&!error&&(<div className="text-center py-12 text-slate-500"><Music className="w-10 h-10 mx-auto mb-2 opacity-30"/><p className="text-sm">暂无音频素材</p></div>)}
      {!loading&&items.length>0&&(
        <div className="space-y-2">
          {items.map(a=>(
            <div key={a.id} className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-teal-500/30 transition-colors">
              <button onClick={()=>togglePlay(a)} className="flex-shrink-0 w-9 h-9 rounded-full bg-teal-600 hover:bg-teal-500 flex items-center justify-center transition-colors">
                {playingId===a.id?<Pause className="w-4 h-4"/>:<Play className="w-4 h-4 ml-0.5"/>}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate" title={a.name}>{a.name}</p>
                <div className="flex gap-3 mt-0.5"><span className="text-xs text-slate-500">{formatBytes(a.size)}</span><span className="text-xs text-slate-500">{formatDate(a.created_at)}</span></div>
              </div>
              <button onClick={()=>setConfirmId(a.id)} disabled={deletingId===a.id} className="flex-shrink-0 p-1.5 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"><Trash2 className="w-4 h-4"/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function VideoPanel() {
  const [items,setItems]=useState<Asset[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const [confirmId,setConfirmId]=useState<string|null>(null);
  const [expandedId,setExpandedId]=useState<string|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{const res=await fetch("/api/assets?type=video");const data=await res.json();if(!res.ok)throw new Error(data.error||"获取失败");setItems(data.assets??[]);}
    catch(e){setError(e instanceof Error?e.message:"获取失败");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  async function handleDelete(id:string){
    if(expandedId===id)setExpandedId(null);
    setDeletingId(id);
    try{const res=await fetch(`/api/assets?id=${encodeURIComponent(id)}`,{method:"DELETE"});const data=await res.json();if(!res.ok)throw new Error(data.error||"删除失败");setItems(prev=>prev.filter(a=>a.id!==id));}
    catch(e){setError(e instanceof Error?e.message:"删除失败");}
    finally{setDeletingId(null);setConfirmId(null);}
  }
  return (
    <div>
      {confirmId&&<ConfirmDialog message="确定删除这条视频？此操作不可撤销。" onConfirm={()=>handleDelete(confirmId)} onCancel={()=>setConfirmId(null)} loading={deletingId===confirmId}/>}
      <UploadZone tab="video" onUploaded={(a)=>setItems(prev=>[a,...prev])}/>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">{items.length} 条视频</span>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${loading?"animate-spin":""}`}/></button>
      </div>
      {error&&<p className="text-xs text-red-400 mb-3">{error}</p>}
      {loading&&<div className="space-y-2">{[1,2,3].map(n=><div key={n} className="h-14 bg-slate-700/50 rounded-lg animate-pulse"/>)}</div>}
      {!loading&&items.length===0&&!error&&(<div className="text-center py-12 text-slate-500"><Film className="w-10 h-10 mx-auto mb-2 opacity-30"/><p className="text-sm">暂无视频素材</p></div>)}
      {!loading&&items.length>0&&(
        <div className="space-y-2">
          {items.map(a=>{
            const isExpanded=expandedId===a.id;
            return(
              <div key={a.id} className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden hover:border-teal-500/30 transition-colors">
                <div className="flex items-center gap-3 px-3" style={{height:60}}>
                  <Film className="flex-shrink-0 w-4 h-4 text-teal-500/70"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate" title={a.name}>{a.name}</p>
                    <div className="flex gap-3 mt-0.5"><span className="text-xs text-slate-500">{formatBytes(a.size)}</span><span className="text-xs text-slate-500">{formatDate(a.created_at)}</span></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={()=>setExpandedId(isExpanded?null:a.id)} className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 rounded transition-colors">{isExpanded?"收起":"播放"}</button>
                    <button onClick={()=>setConfirmId(a.id)} disabled={deletingId===a.id} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>
                {isExpanded&&(
                  <div className="border-t border-slate-700 p-3 bg-slate-950/30">
                    <video controls autoPlay src={a.url} className="w-full rounded-lg max-h-[300px] bg-black"/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export function MyAssets() {
  const [activeTab,setActiveTab]=useState<AssetTab>("image");
  const tabs=[{id:"image" as AssetTab,label:"图片",icon:<ImageIcon className="w-4 h-4"/>,color:"text-sky-400"},{id:"audio" as AssetTab,label:"音频",icon:<Music className="w-4 h-4"/>,color:"text-teal-400"},{id:"video" as AssetTab,label:"视频",icon:<Film className="w-4 h-4"/>,color:"text-violet-400"}];
  return (
    <section className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span className="text-teal-400">■</span> 我的素材库
        </h2>
      </div>
      <div className="flex gap-1 mb-5 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${activeTab===tab.id?"bg-slate-700 text-white shadow-sm":"text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"}`}>
            <span className={activeTab===tab.id?tab.color:""}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab==="image"&&<ImagePanel/>}
      {activeTab==="audio"&&<AudioPanel/>}
      {activeTab==="video"&&<VideoPanel/>}
    </section>
  );
}
