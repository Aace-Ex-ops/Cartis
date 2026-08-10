"use client";

import { useEffect, useState } from "react";
import { PersonalDashboard } from "@/components/consumer/personal-dashboard";
import { BusinessDashboard } from "@/components/seller/business-dashboard";
import { SkeletonHeading, SkeletonCard } from "@/components/shared/dashboard-skeleton";
import { gql } from "@/lib/gql";

export default function DashboardPage() {
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void gql<{ me?: { userType?: string } | null }>("{ me { userType } }")
      .then((d) => {
        if (!cancelled) setUserType(d.me?.userType ?? "personal");
      })
      .catch(() => {
        if (!cancelled) setUserType("personal");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!userType) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonHeading />
        <div className="grid gap-4 lg:grid-cols-3">
          <SkeletonCard className="h-[190px] lg:col-span-2" />
          <SkeletonCard className="h-[190px]" />
        </div>
      </div>
    );
  }

  return userType === "business" || userType === "seller" ? (
    <BusinessDashboard />
  ) : (
    <PersonalDashboard />
  );
}
