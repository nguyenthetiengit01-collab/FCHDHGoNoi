"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  Award,
  CalendarDays,
  Camera,
  Flame,
  HeartHandshake,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { FANPAGE_URL, type FullAppData, type Player } from "@/types/app";
import {
  getMatchStatistics,
  getPlayerStatistics,
  isActivePlayer,
  isCompletedMatch,
  isUpcomingMatch,
} from "@/lib/teamStatistics";
import { shouldShowBannerAt } from "@/lib/sponsors";
import {
  CLUB_ACTIVITIES_POSTS,
  type ActivityCategory,
} from "@/data/clubActivities";
import {
  ImageLightboxModal,
  type LightboxImage,
} from "./ImageLightboxModal";
import { getPlayerPositionBadge } from "./BroadcastAthleteCard";
import { MatchdayRosterPosterModal } from "./MatchdayRosterPoster";
import { useDialogA11y } from "./useDialogA11y";
import { HERO_PHOTOS } from "./guest/shared";
import { GuestHeaderNav } from "./guest/GuestHeaderNav";
import { HeroBanner } from "./guest/HeroBanner";
import { MatchdaySection } from "./guest/MatchdaySection";
import { RosterShowcase } from "./guest/RosterShowcase";
import { ActivitiesMagazine } from "./guest/ActivitiesMagazine";
import { SponsorsFooter } from "./guest/SponsorsFooter";

interface PublicGuestPortalProps {
  data: FullAppData;
  onOpenLogin: () => void;
}

export function PublicGuestPortal({
  data,
  onOpenLogin,
}: PublicGuestPortalProps) {
  const [scrolled, setScrolled] = useState(false);
  const [matchTab, setMatchTab] = useState<"fixtures" | "results">("fixtures");
  const [squadFilter, setSquadFilter] = useState<
    "all" | "GK" | "DF" | "MF" | "FW" | "ĐN"
  >("all");
  const [heroIdx, setHeroIdx] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [activeActivityCategory, setActiveActivityCategory] =
    useState<ActivityCategory>("all");
  const [selectedTimelineYear, setSelectedTimelineYear] =
    useState<string>("all");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [posterModalOpen, setPosterModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  const mobileNavRef = useRef<HTMLDivElement>(null);
  const mobileNavCloseRef = useRef<HTMLButtonElement>(null);
  const mobileNavTitleId = useId();
  const mobileNavDrawerId = useId();

  useDialogA11y({
    isOpen: mobileNavOpen,
    onClose: () => setMobileNavOpen(false),
    containerRef: mobileNavRef,
    initialFocusRef: mobileNavCloseRef,
  });

  const handleOpenLightbox = (images: LightboxImage[], startIndex = 0) => {
    setLightboxImages(images);
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const t = setInterval(
      () => setHeroIdx((i) => (i + 1) % HERO_PHOTOS.length),
      8000
    );
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearInterval(t);
    };
  }, []);

  const players = data.players || [];
  const matches = data.matches || [];
  const attendances = data.attendances || [];
  const fanpageUrl = data.settings?.fanpage_url || FANPAGE_URL;
  const encodedFanpage = encodeURIComponent(fanpageUrl);

  const playerStats = data.statistics?.players ?? getPlayerStatistics(players);
  const matchStats = data.statistics?.matches ?? getMatchStatistics(matches);
  const upcomingMatches = matches.filter(isUpcomingMatch);
  const pastMatches = matches.filter(isCompletedMatch).slice().reverse();
  const nextMatch = upcomingMatches[0] || matches[matches.length - 1];

  const wins = pastMatches.filter(
    (m) =>
      m.team_score !== null &&
      m.opponent_score !== null &&
      m.team_score > m.opponent_score
  ).length;

  const activePlayers: Player[] = players.filter(isActivePlayer);
  const squad = activePlayers
    .filter((p) => {
      if (squadFilter === "all") return true;
      return getPlayerPositionBadge(p).code === squadFilter;
    })
    .slice()
    .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999));

  const displayedSquad = squad.filter((p) => {
    if (!playerSearchQuery.trim()) return true;
    const q = playerSearchQuery.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(q) ||
      p.short_name?.toLowerCase().includes(q) ||
      (p.jersey_number !== null &&
        p.jersey_number !== undefined &&
        p.jersey_number.toString().includes(q)) ||
      (p.position && p.position.toLowerCase().includes(q))
    );
  });

  const selectedPlayer =
    squad.find((p) => p.id === selectedPlayerId) ||
    displayedSquad[0] ||
    squad[0] ||
    null;

  const allActivityPosts =
    data.posts && data.posts.length > 0 ? data.posts : CLUB_ACTIVITIES_POSTS;
  const filteredActivityPosts = allActivityPosts.filter((p) => {
    const matchCat =
      activeActivityCategory === "all" ? true : p.category === activeActivityCategory;
    const matchYear =
      selectedTimelineYear === "all"
        ? true
        : (p.eventYear || p.publishedDate?.slice(0, 4)) === selectedTimelineYear;
    return matchCat && matchYear;
  });

  const go = (id: string) => {
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const totalPlayerCount = playerStats.total;
  const navLinks = [
    { id: "banner-hero", label: "Trang chủ", icon: Sparkles, badge: "CLB" },
    { id: "match-center", label: "Trận đấu", icon: Trophy, badge: "Hot" },
    { id: "activities", label: "Hoạt động", icon: Flame, badge: "Tin mới" },
    {
      id: "squad-section",
      label: `Cầu thủ (${totalPlayerCount})`,
      icon: Users,
      badge: `${totalPlayerCount}+`,
    },
    { id: "join-us", label: "Gia nhập đội", icon: HeartHandshake, badge: "Đón nhận" },
    { id: "fixtures-section", label: "Lịch đấu", icon: CalendarDays, badge: "Tuần này" },
    { id: "gallery", label: "Khoảnh khắc", icon: Camera, badge: "Ảnh" },
    { id: "partners-section", label: "Đồng hành", icon: Award, badge: "Tri ân" },
  ];

  const homeBanners = (data.sponsors || []).filter(
    (sp) => shouldShowBannerAt(sp, "home_banner") && Boolean(sp.banner_url)
  );

  useEffect(() => {
    if (homeBanners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % homeBanners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [homeBanners.length]);

  const ticker = [
    `${totalPlayerCount}+ Cầu thủ nòng cốt • Mở rộng chào đón tất cả anh em Gò Nổi`,
    "Điện Quang • Điện Trung • Điện Phong chung một mái nhà",
    "Đá phủi hết mình • Đoàn kết • Nghĩa tình",
    "Hướng đến toàn bộ con em quê hương Gò Nổi tại Sài Gòn",
  ];

  const matchRows =
    matchTab === "fixtures" ? upcomingMatches : pastMatches.slice(0, 8);

  return (
    <div className="w-full font-sans text-white overflow-x-clip bg-navy-800">
      <GuestHeaderNav
        scrolled={scrolled}
        navLinks={navLinks}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        mobileNavRef={mobileNavRef}
        mobileNavCloseRef={mobileNavCloseRef}
        mobileNavTitleId={mobileNavTitleId}
        mobileNavDrawerId={mobileNavDrawerId}
        fanpageUrl={fanpageUrl}
        totalPlayerCount={totalPlayerCount}
        go={go}
        onOpenLogin={onOpenLogin}
      />

      <HeroBanner
        heroIdx={heroIdx}
        totalPlayerCount={totalPlayerCount}
        matchStats={matchStats}
        wins={wins}
        ticker={ticker}
        go={go}
        onOpenLogin={onOpenLogin}
      />

      <MatchdaySection
        data={data}
        fanpageUrl={fanpageUrl}
        navLinks={navLinks}
        totalPlayerCount={totalPlayerCount}
        homeBanners={homeBanners}
        activeBannerIdx={activeBannerIdx}
        setActiveBannerIdx={setActiveBannerIdx}
        nextMatch={nextMatch}
        upcomingMatches={upcomingMatches}
        pastMatches={pastMatches}
        matchTab={matchTab}
        setMatchTab={setMatchTab}
        matchRows={matchRows}
        go={go}
        setPosterModalOpen={setPosterModalOpen}
        onOpenLogin={onOpenLogin}
      />

      <RosterShowcase
        data={data}
        totalPlayerCount={totalPlayerCount}
        squadFilter={squadFilter}
        setSquadFilter={setSquadFilter}
        playerSearchQuery={playerSearchQuery}
        setPlayerSearchQuery={setPlayerSearchQuery}
        displayedSquad={displayedSquad}
        selectedPlayer={selectedPlayer}
        setSelectedPlayerId={setSelectedPlayerId}
        handleOpenLightbox={handleOpenLightbox}
      />

      <ActivitiesMagazine
        fanpageUrl={fanpageUrl}
        encodedFanpage={encodedFanpage}
        activeActivityCategory={activeActivityCategory}
        setActiveActivityCategory={setActiveActivityCategory}
        selectedTimelineYear={selectedTimelineYear}
        setSelectedTimelineYear={setSelectedTimelineYear}
        allActivityPosts={allActivityPosts}
        filteredActivityPosts={filteredActivityPosts}
        handleOpenLightbox={handleOpenLightbox}
      />

      <SponsorsFooter
        data={data}
        fanpageUrl={fanpageUrl}
        totalPlayerCount={totalPlayerCount}
        onOpenLogin={onOpenLogin}
      />

      <ImageLightboxModal
        isOpen={lightboxOpen}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onNavigate={setLightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />

      <MatchdayRosterPosterModal
        isOpen={posterModalOpen}
        onClose={() => setPosterModalOpen(false)}
        match={nextMatch}
        players={players}
        attendances={attendances}
      />
    </div>
  );
}
