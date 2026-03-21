"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirectedFrom);
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">登录</h1>
          <p className="text-slate-400 mt-2">使用你的 Supabase 账号开始体验</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4"
        >
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="email">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          {error ? (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? "正在登录..." : "登录"}
          </button>

          <p className="text-center text-sm text-slate-400">
            还没有账号？{" "}
            <Link href="/auth/register" className="text-blue-300 hover:underline">
              去注册
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}

