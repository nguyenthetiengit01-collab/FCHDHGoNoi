"use client";

import React, { useEffect, useState } from "react";
import { BarChart3, Info } from "lucide-react";
import { Badge, Card, LoadingState } from "@/components/ui";
import type { AnalyticsEnvelope, MyInsightsData } from "@/lib/analytics/types";

export function PlayerInsights() {
  const [preset, setPreset] = useState<"90d" | "12m" | "all">("90d");
  const [loading, setLoading] = useState(true);
  const [envelope, setEnvelope] = useState<AnalyticsEnvelope<MyInsightsData> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analytics?section=my-insights&preset=${preset}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled) setEnvelope(json);
      })
      .catch(() => {
        if (!cancelled) setEnvelope(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preset]);

  if (loading) {
    return <LoadingState label="Đang tải thống kê cá nhân..." />;
  }

  if (!envelope || !envelope.enabled || !envelope.data) {
    return null;
  }

  const d = envelope.data;
  const attendanceText =
    d.attendanceRate !== null
      ? `${Math.round(d.attendanceRate * 1000) / 10}%`
      : "Chưa đủ dữ liệu";
  const rsvpText =
    d.rsvpResponseRate !== null
      ? `${Math.round(d.rsvpResponseRate * 1000) / 10}%`
      : "Chưa đủ dữ liệu";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-navy-700" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-navy-900">
            Thống kê chuyên cần cá nhân
          </h3>
        </div>
        <div className="flex gap-1.5">
          {(["90d", "12m", "all"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                preset === p
                  ? "bg-navy-800 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {p === "90d" ? "90 ngày" : p === "12m" ? "12 tháng" : "Tất cả"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 tabular-nums">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Trận đủ ĐK</p>
          <p className="text-lg font-extrabold text-navy-900">{d.eligibleCompletedMatches}</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Thực tế ra sân</p>
          <p className="text-lg font-extrabold text-emerald-700">{d.attendedMatches}</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Tỷ lệ chuyên cần</p>
          <p className="text-lg font-extrabold text-navy-900">{attendanceText}</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Phản hồi RSVP</p>
          <p className="text-lg font-extrabold text-navy-900">{rsvpText}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1" title="Chỉ tính các trận đã hoàn thành mà bạn ở trạng thái đủ điều kiện; bỏ qua các trận thiếu dữ liệu điểm danh.">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          Kỳ: {envelope.period.from} → {envelope.period.to}
          {d.missingAttendanceRecords > 0 && ` • Thiếu dữ liệu: ${d.missingAttendanceRecords} trận`}
        </span>
        {envelope.coverage.isLowCoverage && (
          <Badge variant="warning">Dữ liệu chưa đầy đủ</Badge>
        )}
      </div>
    </Card>
  );
}
