"use client";

import { useState, useEffect, useCallback } from "react";
import { Coins, X, ExternalLink, Loader2 } from "lucide-react";

interface CreditPackage {
  credits: number;
  price: number; // 元
  label: string;
  popular?: boolean;
}

const PACKAGES: CreditPackage[] = [
  { credits: 100, price: 10, label: "基础包" },
  { credits: 500, price: 45, label: "超值包", popular: true },
];

export function CreditSystem() {
  const [amount, setAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      const data = await res.json();
      if (res.ok) setAmount(data.amount ?? 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // 检查支付回调参数
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      fetchCredits();
      // 清理 URL 参数
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("credits");
      window.history.replaceState({}, "", url.toString());
    }
  }, [fetchCredits]);

  async function handlePurchase(pkg: CreditPackage) {
    setPurchasing(pkg.credits);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: pkg.credits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "结账失败");
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "结账失败");
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <>
      {/* 积分显示栏 */}
      <div className="flex items-center justify-between mb-6 p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-yellow-400" />
          <span className="text-sm text-slate-300">积分余额</span>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <span className="text-lg font-bold text-yellow-300">{amount ?? 0}</span>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 rounded-lg text-sm font-semibold transition-colors"
        >
          充值积分
        </button>
      </div>

      {/* 充值弹窗 */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                充值积分
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {PACKAGES.map((pkg) => (
                <button
                  key={pkg.credits}
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing !== null}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-colors disabled:opacity-60 ${
                    pkg.popular
                      ? "border-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20"
                      : "border-slate-600 bg-slate-700/50 hover:bg-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{pkg.credits} 积分</span>
                        {pkg.popular && (
                          <span className="text-xs bg-yellow-500 text-slate-900 px-1.5 py-0.5 rounded font-semibold">
                            推荐
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">{pkg.label}</p>
                    </div>
                    <div className="text-right">
                      {purchasing === pkg.credits ? (
                        <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                      ) : (
                        <>
                          <p className="font-bold text-yellow-300">¥{pkg.price}</p>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 ml-auto mt-0.5" />
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-400 mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                {error}
              </p>
            )}

            <p className="text-xs text-slate-500 mt-4 text-center">
              通过 Stripe 安全支付，支持信用卡
            </p>
          </div>
        </div>
      )}
    </>
  );
}
