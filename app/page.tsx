"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import AdSlot from "./ad-slot";
import { GoogleSession, currentGoogleSession, restoreGoogleSession, signOutGoogleSession } from "./firebase-google-auth";
import GoogleLoginModal from "./google-login-modal";

type View = "owner" | "vendor" | "track" | "profile";
type Language = "hi" | "en";
type Vendor = {
  id: number | string;
  name: string;
  phone?: string;
  category: string;
  workDescription: string;
  area: string;
  pincode: string;
  experienceYears: number;
  rate: number;
  rateUnit: string;
  negotiable: boolean;
  available: boolean;
  online: boolean;
  verified: boolean;
  rating: number;
  completedJobs: number;
};
type Job = {
  id: string;
  vendorName?: string | null;
  vendorPhone?: string | null;
  ownerName: string;
  ownerPhone: string;
  category: string;
  address: string;
  area: string;
  pincode: string;
  budget?: number | null;
  rateUnit: string;
  scheduledFor: string;
  note: string;
  vendorLatitude?: number | null;
  vendorLongitude?: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  vendorDecision?: "active" | "rejected" | "accepted" | null;
  reviewRating?: number | null;
  reviewFeedback?: string;
};
type OwnerProfile = { name: string; email: string; phone: string; language: Language };

const cats = [
  ["Plumber", "🔧", "Leakage, fitting"],
  ["Electrician", "⚡", "Wiring, fan, MCB"],
  ["Painter", "🎨", "Colour, polish"],
  ["Mason", "🧱", "Civil, plaster"],
  ["Carpenter", "🪚", "Furniture, door"],
  ["Labour", "👷", "Daily labour"],
  ["Tiles & Marble", "◫", "Flooring work"],
  ["Waterproofing", "💧", "Terrace, seepage"],
  ["Welder", "⚙️", "Grill, fabrication"],
  ["AC Repair", "❄️", "Service, install"],
  ["Cleaning", "🧹", "Deep cleaning"],
  ["Appliance Repair", "🛠️", "Fridge, washer"],
  ["POP & Ceiling", "▱", "False ceiling"],
  ["Pest Control", "🛡️", "Termite, insects"],
  ["Gardener", "🌿", "Garden care"],
  ["CCTV", "📹", "Camera install"],
  ["Solar Technician", "☀️", "Solar service"],
  ["Tank Cleaning", "🫧", "Water tank"],
  ["Moving Help", "📦", "Packing, shifting"],
  ["Handyman", "🔩", "Chhote-mote kaam"],
] as const;

const categoryAliases: Record<string, string[]> = {
  labour: ["Labour", "Moving Help", "Mason", "Handyman"],
  labor: ["Labour", "Moving Help", "Mason", "Handyman"],
  majdur: ["Labour", "Moving Help", "Mason"],
  मजदूर: ["Labour", "Moving Help", "Mason"],
  technician: ["Solar Technician", "AC Repair", "Appliance Repair", "CCTV", "Electrician"],
  teknishian: ["Solar Technician", "AC Repair", "Appliance Repair", "CCTV", "Electrician"],
  mechanic: ["Appliance Repair", "AC Repair", "Handyman"],
  colour: ["Painter"],
  color: ["Painter"],
  paint: ["Painter"],
  plumbing: ["Plumber"],
  bijli: ["Electrician"],
  electrician: ["Electrician"],
  safai: ["Cleaning", "Tank Cleaning"],
  repair: ["Appliance Repair", "AC Repair", "Handyman"],
};

const units: Record<string, string> = { visit: "visit", hour: "hour", day: "day", sqft: "sq.ft.", job: "job" };
const statusByLanguage: Record<Language, Record<string, [string, string]>> = {
  hi: {
    open: ["Online vendors को भेजा", "Matching online vendors इस काम को live देख सकते हैं"],
    sent: ["चुने हुए vendor को भेजा", "Vendor के जवाब का इंतज़ार है"],
    accepted: ["Vendor ने स्वीकार किया", "अब call या WhatsApp करें"],
    on_the_way: ["Vendor रास्ते में है", "Location अपने-आप live refresh होगी"],
    arrived: ["Vendor पहुँच गया", "काम से पहले final rate confirm करें"],
    completed: ["काम पूरा हुआ", "Rating दें और फिर payment confirm करें"],
    cancelled: ["Request बंद हुई", "नई request बना सकते हैं"],
  },
  en: {
    open: ["Sent to online vendors", "Matching online vendors can see this job live"],
    sent: ["Sent to selected vendor", "Waiting for the vendor to respond"],
    accepted: ["Vendor accepted", "You can now call or WhatsApp"],
    on_the_way: ["Vendor is on the way", "Location refreshes automatically"],
    arrived: ["Vendor has arrived", "Confirm the final rate before work starts"],
    completed: ["Work completed", "Rate the vendor and confirm payment"],
    cancelled: ["Request closed", "You can create a new request"],
  },
};
const emptyBooking = {
  ownerName: "",
  ownerPhone: "",
  category: "Plumber",
  address: "",
  area: "",
  pincode: "",
  budget: "",
  rateUnit: "visit",
  scheduledFor: "आज — जल्दी",
  note: "",
};
const emptyVendor = {
  name: "",
  phone: "",
  category: "Plumber",
  workDescription: "",
  area: "",
  pincode: "",
  experienceYears: "",
  rate: "",
  rateUnit: "visit",
  negotiable: true,
};

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={"field" + (wide ? " wide" : "")}><span>{label}</span>{children}</label>;
}

const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
const isLead = (job: Job) => ["open", "sent"].includes(job.status) && job.vendorDecision !== "rejected";

function relatedCategories(query: string) {
  const normalized = query.trim().toLowerCase();
  const matches = new Set<string>();
  Object.entries(categoryAliases).forEach(([alias, categories]) => {
    if (normalized.includes(alias)) categories.forEach((category) => matches.add(category));
  });
  return matches;
}

function preferredCategory(query: string) {
  const normalized = query.trim().toLowerCase();
  const exact = cats.find((category) => category[0].toLowerCase() === normalized);
  if (exact) return exact[0];
  return Array.from(relatedCategories(query))[0] || "Handyman";
}

async function secureFetch(url: string, init: RequestInit, fallbackToken: string) {
  const current = await currentGoogleSession();
  const token = current?.token || fallbackToken;
  const headers = new Headers(init.headers);
  headers.set("authorization", "Bearer " + token);
  return fetch(url, { ...init, headers });
}

export default function Home() {
  const [view, setView] = useState<View>("owner");
  const [lang, setLang] = useState<Language>("hi");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [cat, setCat] = useState("All");
  const [area, setArea] = useState("");
  const [allCats, setAllCats] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationText, setLocationText] = useState("Location जोड़ें");
  const [notice, setNotice] = useState("");
  const [liveToast, setLiveToast] = useState<{ title: string; body: string } | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [modal, setModal] = useState(false);
  const [picked, setPicked] = useState<Vendor | null>(null);
  const [booking, setBooking] = useState(emptyBooking);
  const [bookBusy, setBookBusy] = useState(false);
  const [created, setCreated] = useState<Job | null>(null);
  const [notifiedCount, setNotifiedCount] = useState(0);

  const [vendorForm, setVendorForm] = useState(emptyVendor);
  const [vendorBusy, setVendorBusy] = useState(false);
  const [vendorProfile, setVendorProfile] = useState<Vendor | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsBusy, setJobsBusy] = useState(false);
  const [lastJobsSync, setLastJobsSync] = useState("");
  const [incomingLead, setIncomingLead] = useState<Job | null>(null);
  const [locationSharingJobId, setLocationSharingJobId] = useState("");

  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile>({ name: "", email: "", phone: "", language: "hi" });
  const [ownerJobs, setOwnerJobs] = useState<Job[]>([]);
  const [profileBusy, setProfileBusy] = useState(false);
  const [vendorEdit, setVendorEdit] = useState(emptyVendor);
  const [feedback, setFeedback] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [ratingDraft, setRatingDraft] = useState<Record<string, number>>({});
  const [reviewDraft, setReviewDraft] = useState<Record<string, string>>({});

  const [trackId, setTrackId] = useState("");
  const [tracked, setTracked] = useState<Job | null>(null);
  const [trackBusy, setTrackBusy] = useState(false);

  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState<GoogleSession | null>(null);
  const [loginPurpose, setLoginPurpose] = useState<string | null>(null);
  const pendingLoginAction = useRef<((token: string) => Promise<void>) | null>(null);
  const knownLeadIds = useRef<Set<string>>(new Set());
  const leadSetReady = useRef(false);
  const trackedRef = useRef<Job | null>(null);
  const toastTimer = useRef<number | null>(null);
  const locationSentAt = useRef(0);
  const pollJobsAction = useRef<(token: string, announceNew: boolean) => Promise<void>>(async () => {});
  const heartbeatAction = useRef<(token: string) => Promise<void>>(async () => {});
  const loadAccountAction = useRef<(token: string) => Promise<void>>(async () => {});
  const vendorProfileId = vendorProfile?.id;
  const vendorProfileAvailable = vendorProfile?.available;
  const onTheWayJobId = jobs.find((job) => job.status === "on_the_way")?.id || "";
  const status = statusByLanguage[lang];
  const tr = (hi: string, en: string) => lang === "hi" ? hi : en;
  const locationDisplay = lang === "hi" ? locationText : ({
    "Location जोड़ें": "Add location",
    "Location मिल रही है…": "Getting location…",
    "Location जुड़ी": "Location added",
    "Permission नहीं मिली": "Permission denied",
  }[locationText] || locationText);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("gharseva-language");
    if (savedLanguage === "en" || savedLanguage === "hi") window.setTimeout(() => setLang(savedLanguage), 0);
    restoreGoogleSession().then((session) => {
      if (session) {
        setAuthToken(session.token);
        setAuthUser(session);
      }
    }).catch(() => {});
    if (typeof Notification !== "undefined") {
      window.setTimeout(() => setNotificationsEnabled(Notification.permission === "granted"), 0);
    }
  }, []);

  useEffect(() => {
    if (authToken) void loadAccountAction.current(authToken);
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !["owner", "profile", "track"].includes(view)) return;
    void loadOwnerActivity(authToken);
    const timer = window.setInterval(() => void loadOwnerActivity(authToken), 3000);
    return () => window.clearInterval(timer);
  }, [authToken, view]);

  useEffect(() => {
    if (view !== "owner") return;
    let active = true;
    async function refreshVendors() {
      try {
        const response = await fetch("/api/vendors", { cache: "no-store" });
        const data = await response.json();
        if (active && response.ok) setVendors(data.vendors || []);
      } catch {
        if (active && !vendors.length) setVendors([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    void refreshVendors();
    const timer = window.setInterval(refreshVendors, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [view, vendors.length]);

  useEffect(() => {
    trackedRef.current = tracked;
  }, [tracked]);

  useEffect(() => {
    if (!tracked?.id || !authToken) return;
    const timer = window.setInterval(async () => {
      const current = trackedRef.current;
      if (!current || ["completed", "cancelled"].includes(current.status)) return;
      try {
        const response = await secureFetch("/api/requests?id=" + current.id, { cache: "no-store" }, authToken);
        const data = await response.json();
        const next = data.requests?.[0] as Job | undefined;
        if (!response.ok || !next) return;
        if (next.status !== current.status) {
          showLiveAlert("Request update", statusByLanguage[lang][next.status]?.[0] || (lang === "hi" ? "Status बदल गया" : "Status changed"));
        }
        setTracked(next);
      } catch {}
    }, 3000);
    return () => window.clearInterval(timer);
  }, [tracked?.id, authToken, lang]);

  useEffect(() => {
    if (view !== "vendor" || !authToken || !vendorProfileId) return;
    const jobsTimer = window.setInterval(() => {
      void pollJobsAction.current(authToken, true);
    }, 3000);
    const heartbeatTimer = vendorProfileAvailable ? window.setInterval(() => {
      void heartbeatAction.current(authToken);
    }, 25000) : undefined;
    return () => {
      window.clearInterval(jobsTimer);
      if (heartbeatTimer) window.clearInterval(heartbeatTimer);
    };
  }, [view, authToken, vendorProfileId, vendorProfileAvailable]);

  useEffect(() => {
    if (!authToken || !onTheWayJobId || !navigator.geolocation) {
      return;
    }
    const watchId = navigator.geolocation.watchPosition((position) => {
      setLocationSharingJobId(onTheWayJobId);
      const now = Date.now();
      if (now - locationSentAt.current < 5000) return;
      locationSentAt.current = now;
      void secureFetch("/api/requests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: onTheWayJobId,
          action: "location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      }, authToken);
    }, () => {
      setLocationSharingJobId("");
      setNotice(lang === "hi" ? "Automatic location के लिए phone location permission Allow करें." : "Allow location permission for automatic live tracking.");
    }, { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 });
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.setTimeout(() => setLocationSharingJobId(""), 0);
    };
  }, [authToken, onTheWayJobId, lang]);

  const shown = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const aliasCategories = relatedCategories(query);
    const locationTerms = area.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return vendors
      .map((vendor) => {
        if (cat !== "All" && vendor.category !== cat) return { vendor, score: -1 };
        const searchable = (vendor.category + " " + vendor.name + " " + vendor.workDescription).toLowerCase();
        const queryWords = query.split(/\s+/).filter(Boolean);
        const directMatch = !query || searchable.includes(query) || queryWords.some((word) => searchable.includes(word));
        const aliasMatch = aliasCategories.has(vendor.category);
        if (query && !directMatch && !aliasMatch) return { vendor, score: -1 };
        const locationHaystack = (vendor.area + " " + vendor.pincode).toLowerCase();
        if (locationTerms.length && !locationTerms.every((term) => locationHaystack.includes(term))) return { vendor, score: -1 };

        let score = 0;
        if (query && vendor.category.toLowerCase() === query) score += 1200;
        else if (query && vendor.category.toLowerCase().includes(query)) score += 950;
        else if (aliasMatch) score += 850;
        else if (query && searchable.includes(query)) score += 700;
        else if (query) score += 500;
        if (cat !== "All" && vendor.category === cat) score += 1000;
        if (vendor.online) score += 260;
        else if (vendor.available) score += 40;
        if (area.trim() === vendor.pincode) score += 180;
        else if (area && locationHaystack.includes(area.trim().toLowerCase())) score += 120;
        score += vendor.rating * 10 + Math.min(vendor.completedJobs, 100) / 10;
        return { vendor, score };
      })
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.vendor);
  }, [vendors, searchTerm, cat, area]);

  const onlineCount = shown.filter((vendor) => vendor.online).length;
  const openLeads = jobs.filter(isLead);
  const rejectedLeads = jobs.filter((job) => ["open", "sent"].includes(job.status) && job.vendorDecision === "rejected");
  const activeJobs = jobs.filter((job) => !isLead(job) && !["completed", "cancelled"].includes(job.status));
  const previousJobs = jobs.filter((job) => ["completed", "cancelled"].includes(job.status));

  function applyLanguage(next: Language) {
    setLang(next);
    window.localStorage.setItem("gharseva-language", next);
    setOwnerProfile((current) => ({ ...current, language: next }));
  }

  async function loadAccount(token: string) {
    try {
      const response = await secureFetch("/api/profile", { cache: "no-store" }, token);
      const data = await response.json();
      if (!response.ok) return;
      const savedLanguage: Language = data.owner?.id && data.owner.language === "en" ? "en" : data.owner?.id ? "hi" : lang;
      setOwnerProfile({
        name: data.owner?.name || authUser?.name || "",
        email: data.owner?.email || authUser?.email || "",
        phone: data.owner?.phone || "",
        language: savedLanguage,
      });
      setBooking((current) => ({ ...current, ownerName: current.ownerName || data.owner?.name || "", ownerPhone: current.ownerPhone || data.owner?.phone || "" }));
      if (data.owner?.id) applyLanguage(savedLanguage);
      if (data.vendor) {
        const vendor = { ...data.vendor, online: false } as Vendor;
        setVendorProfile((current) => current?.id === vendor.id ? current : vendor);
        setVendorEdit({
          name: vendor.name,
          phone: vendor.phone || "",
          category: vendor.category,
          workDescription: vendor.workDescription || "",
          area: vendor.area,
          pincode: vendor.pincode,
          experienceYears: String(vendor.experienceYears),
          rate: String(vendor.rate),
          rateUnit: vendor.rateUnit,
          negotiable: vendor.negotiable,
        });
      }
    } catch {}
  }

  async function loadOwnerActivity(token: string) {
    try {
      const response = await secureFetch("/api/requests?owner=1", { cache: "no-store" }, token);
      const data = await response.json();
      if (response.ok) setOwnerJobs((data.requests || []) as Job[]);
    } catch {}
  }

  async function saveProfiles(event: FormEvent) {
    event.preventDefault();
    if (!authToken) {
      withGoogleLogin(tr("profile save करने", "saving your profile"), async (token) => loadAccount(token));
      return;
    }
    setProfileBusy(true);
    try {
      const ownerResponse = await secureFetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ownerProfile),
      }, authToken);
      const ownerData = await ownerResponse.json();
      if (!ownerResponse.ok) throw new Error(ownerData.error);
      setOwnerProfile(ownerData.owner);
      applyLanguage(ownerData.owner.language === "en" ? "en" : "hi");

      if (vendorProfile) {
        const vendorResponse = await secureFetch("/api/vendors", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...vendorEdit, profile: true, rate: Number(vendorEdit.rate), experienceYears: Number(vendorEdit.experienceYears) }),
        }, authToken);
        const vendorData = await vendorResponse.json();
        if (!vendorResponse.ok) throw new Error(vendorData.error);
        setVendorProfile(vendorData.vendor);
      }
      setNotice(tr("Profile और settings save हो गईं.", "Profile and settings saved."));
    } catch (error) {
      message(error);
    } finally {
      setProfileBusy(false);
    }
  }

  async function sendFeedback(event: FormEvent) {
    event.preventDefault();
    if (!authToken) {
      withGoogleLogin(tr("feedback भेजने", "sending feedback"), async () => {});
      return;
    }
    setFeedbackBusy(true);
    try {
      const response = await secureFetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: feedback }),
      }, authToken);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFeedback("");
      setNotice(tr("Feedback भेज दिया गया. धन्यवाद!", "Feedback sent. Thank you!"));
    } catch (error) {
      message(error);
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function submitReview(job: Job) {
    if (!authToken) return;
    const rating = ratingDraft[job.id] || 0;
    try {
      const response = await secureFetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: job.id, rating, feedback: reviewDraft[job.id] || "" }),
      }, authToken);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setOwnerJobs((current) => current.map((item) => item.id === job.id ? { ...item, reviewRating: rating, reviewFeedback: reviewDraft[job.id] || "" } : item));
      setNotice(tr("Rating save हो गई. धन्यवाद!", "Rating saved. Thank you!"));
    } catch (error) {
      message(error);
    }
  }

  function rebook(job: Job) {
    setPicked(null);
    setCreated(null);
    setBooking({
      ownerName: job.ownerName,
      ownerPhone: job.ownerPhone,
      category: job.category,
      address: job.address,
      area: job.area,
      pincode: job.pincode,
      budget: job.budget ? String(job.budget) : "",
      rateUnit: job.rateUnit,
      scheduledFor: "आज — जल्दी",
      note: job.note,
    });
    setModal(true);
  }

  function showLiveAlert(title: string, body: string) {
    setLiveToast({ title, body });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setLiveToast(null), 6500);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "/app-icon-192.png" });
    }
    navigator.vibrate?.([120, 70, 120]);
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setNotice("इस browser में notification support नहीं है.");
      return;
    }
    const permission = await Notification.requestPermission();
    const enabled = permission === "granted";
    setNotificationsEnabled(enabled);
    setNotice(enabled ? "Live notifications चालू हो गईं." : "Notification permission allow नहीं हुई.");
  }

  function go(next: View) {
    setView(next);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openVendorView() {
    go("vendor");
    if (authToken) void loadJobsNow(authToken, false);
  }

  function locate() {
    if (!navigator.geolocation) {
      setNotice("Area manually भरें.");
      return;
    }
    setLocationText("Location मिल रही है…");
    navigator.geolocation.getCurrentPosition((position) => {
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocationText("Location जुड़ी");
    }, () => {
      setLocationText("Permission नहीं मिली");
      setNotice("Area और pincode manually भरें.");
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  function selectCategory(category: string) {
    setCat(category);
    setSearchTerm(category);
    window.setTimeout(() => document.getElementById("live-vendors")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function openRequest(vendor: Vendor | null, category?: string) {
    const selectedCategory = vendor?.category || category || (cat === "All" ? preferredCategory(searchTerm) : cat);
    setPicked(vendor);
    setCreated(null);
    setNotifiedCount(0);
    setBooking((current) => ({
      ...current,
      category: selectedCategory,
      area: current.area || area.replace(/\d/g, "").trim(),
      pincode: current.pincode || area.match(/\b\d{6}\b/)?.[0] || "",
      budget: vendor ? String(vendor.rate) : current.budget,
      rateUnit: vendor?.rateUnit || current.rateUnit,
    }));
    setModal(true);
  }

  const message = (error: unknown) => setNotice(error instanceof Error ? error.message : "कुछ गलत हुआ");

  function withGoogleLogin(purpose: string, action: (token: string) => Promise<void>) {
    if (authToken && authUser) {
      void action(authToken);
      return;
    }
    pendingLoginAction.current = action;
    setLoginPurpose(purpose);
  }

  async function googleAuthenticated(session: GoogleSession) {
    setAuthToken(session.token);
    setAuthUser(session);
    setLoginPurpose(null);
    setBooking((current) => ({ ...current, ownerName: current.ownerName || session.name }));
    setVendorForm((current) => ({ ...current, name: current.name || session.name }));
    await Promise.all([loadAccount(session.token), loadOwnerActivity(session.token)]);
    const action = pendingLoginAction.current;
    pendingLoginAction.current = null;
    if (action) await action(session.token);
  }

  function closeLogin() {
    pendingLoginAction.current = null;
    setLoginPurpose(null);
  }

  async function logout() {
    await signOutGoogleSession();
    setAuthToken("");
    setAuthUser(null);
    setVendorProfile(null);
    setJobs([]);
    setOwnerJobs([]);
    setOwnerProfile({ name: "", email: "", phone: "", language: lang });
    setTracked(null);
    setIncomingLead(null);
    setView("owner");
    setNotice(tr("Google account logout हो गया.", "Signed out of your Google account."));
  }

  function createRequest(event: FormEvent) {
    event.preventDefault();
    withGoogleLogin("service request भेजने", createRequestNow);
  }

  async function createRequestNow(token: string) {
    setBookBusy(true);
    try {
      const response = await secureFetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...booking,
          budget: booking.budget ? Number(booking.budget) : null,
          vendorId: picked && typeof picked.id === "number" ? picked.id : null,
          ownerLatitude: coords?.latitude,
          ownerLongitude: coords?.longitude,
        }),
      }, token);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCreated(data.request);
      setTracked(data.request);
      setOwnerJobs((current) => [data.request, ...current.filter((job) => job.id !== data.request.id)]);
      trackedRef.current = data.request;
      setTrackId(data.request.id);
      setNotifiedCount(Number(data.notifiedCount || 0));
      showLiveAlert("Request भेजी गई", data.notifiedCount ? data.notifiedCount + " online vendor को live lead मिली." : "Request save है; matching vendor online आते ही देखेगा.");
    } catch (error) {
      message(error);
    } finally {
      setBookBusy(false);
    }
  }

  function register(event: FormEvent) {
    event.preventDefault();
    withGoogleLogin("vendor profile बनाने", registerNow);
  }

  async function registerNow(token: string) {
    setVendorBusy(true);
    try {
      const response = await secureFetch("/api/vendors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...vendorForm,
          rate: Number(vendorForm.rate),
          experienceYears: Number(vendorForm.experienceYears),
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        }),
      }, token);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setVendorProfile(data.vendor);
      setVendorEdit({ ...vendorForm });
      setVendors((current) => [data.vendor, ...current.filter((vendor) => vendor.id !== data.vendor.id)]);
      showLiveAlert("Profile online है", "अब matching customer requests आपको live दिखेंगी.");
      await loadJobsNow(token, false);
    } catch (error) {
      message(error);
    } finally {
      setVendorBusy(false);
    }
  }

  function loadJobs() {
    withGoogleLogin("vendor dashboard खोलने", (token) => loadJobsNow(token, true));
  }

  async function loadJobsNow(token: string, showMissing: boolean) {
    setJobsBusy(true);
    try {
      const profileResponse = await secureFetch("/api/vendors?mine=1", { cache: "no-store" }, token);
      const profileData = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(profileData.error);
      const savedProfile = profileData.vendors?.[0] as Vendor | undefined;
      if (!savedProfile) {
        setVendorProfile(null);
        setJobs([]);
        if (showMissing) setNotice("पहले vendor profile बनाएँ.");
        return;
      }
      let profile: Vendor = savedProfile;
      if (profile.available) {
        const heartbeatResponse = await secureFetch("/api/vendors", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ heartbeat: true }),
        }, token);
        const heartbeatData = await heartbeatResponse.json();
        if (heartbeatResponse.ok) profile = heartbeatData.vendor;
      }
      setVendorProfile(profile);
      await pollVendorJobs(token, false);
    } catch (error) {
      message(error);
    } finally {
      setJobsBusy(false);
    }
  }

  async function heartbeatVendor(token: string) {
    try {
      const response = await secureFetch("/api/vendors", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ heartbeat: true }),
      }, token);
      const data = await response.json();
      if (response.ok) setVendorProfile(data.vendor);
    } catch {}
  }

  async function pollVendorJobs(token: string, announceNew: boolean) {
    try {
      const response = await secureFetch("/api/requests?vendor=1", { cache: "no-store" }, token);
      const data = await response.json();
      if (!response.ok) return;
      const nextJobs = (data.requests || []) as Job[];
      const leadIds = nextJobs.filter(isLead).map((job) => job.id);
      if (announceNew && leadSetReady.current) {
        const newIds = leadIds.filter((id) => !knownLeadIds.current.has(id));
        if (newIds.length) {
          const first = nextJobs.find((job) => job.id === newIds[0]);
          if (first) setIncomingLead(first);
          showLiveAlert(tr("नई काम की call", "Incoming work call"), first ? first.category + " • " + first.area + " • " + (first.budget ? "₹" + first.budget : tr("Rate तय होगा", "Rate to be agreed")) : newIds.length + tr(" नई leads", " new leads"));
        }
      }
      knownLeadIds.current = new Set(leadIds);
      leadSetReady.current = true;
      setVendorProfile(data.vendor);
      setJobs(nextJobs);
      setLastJobsSync(new Date().toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {}
  }

  pollJobsAction.current = pollVendorJobs;
  heartbeatAction.current = heartbeatVendor;
  loadAccountAction.current = loadAccount;

  async function toggleVendorOnline() {
    if (!vendorProfile) return;
    withGoogleLogin(vendorProfile.available ? "offline होने" : "online होने", async (token) => {
      try {
        const next = !vendorProfile.available;
        const response = await secureFetch("/api/vendors", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ available: next }),
        }, token);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setVendorProfile(data.vendor);
        if (next) {
          showLiveAlert("आप Online हैं", "Matching customer काम अब live मिलेंगे.");
          await pollVendorJobs(token, false);
        } else {
          setJobs((current) => current.filter((job) => !isLead(job)));
          setNotice("आप Offline हैं. नई खुली leads नहीं आएँगी.");
        }
      } catch (error) {
        message(error);
      }
    });
  }

  function patchJob(job: Job, action: string, position?: { latitude: number; longitude: number }) {
    withGoogleLogin("काम update करने", (token) => patchJobNow(token, job, action, position));
  }

  async function patchJobNow(token: string, job: Job, action: string, position?: { latitude: number; longitude: number }) {
    try {
      const response = await secureFetch("/api/requests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: job.id, action, ...position }),
      }, token);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setJobs((current) => current.map((item) => item.id === job.id ? data.request : item));
      if (["accept", "reject"].includes(action)) setIncomingLead((current) => current?.id === job.id ? null : current);
      if (action === "accept") showLiveAlert(tr("काम accept हुआ", "Job accepted"), tr("Customer contact और पूरा address अब खुल गया है.", "Customer contact and full address are now visible."));
      if (action === "reject") setNotice(tr("Lead reject हुई. Rejected section से दोबारा accept कर सकते हैं.", "Lead rejected. You can reaccept it from the Rejected section."));
      if (action === "reaccept") setNotice(tr("Lead फिर से active हो गई.", "Lead is active again."));
      if (action === "on_the_way") setNotice(tr("Automatic live location sharing चालू हो रही है.", "Automatic live location sharing is starting."));
      if (["arrived", "completed", "cancelled"].includes(action)) setLocationSharingJobId("");
    } catch (error) {
      message(error);
    }
  }

  function shareVendorLocation(job: Job) {
    navigator.geolocation?.getCurrentPosition((position) => {
      patchJob(job, "location", { latitude: position.coords.latitude, longitude: position.coords.longitude });
    }, () => setNotice("Location permission नहीं मिली"), { enableHighAccuracy: true, timeout: 10000 });
  }

  function loadTrack() {
    withGoogleLogin("request track करने", loadTrackNow);
  }

  async function loadTrackNow(token: string) {
    setTrackBusy(true);
    try {
      const response = await secureFetch("/api/requests?id=" + trackId.toUpperCase(), { cache: "no-store" }, token);
      const data = await response.json();
      if (!response.ok || !data.requests?.[0]) throw new Error(data.error || "Request नहीं मिली. सही Google account और ID check करें.");
      setTracked(data.requests[0]);
      trackedRef.current = data.requests[0];
    } catch (error) {
      message(error);
    } finally {
      setTrackBusy(false);
    }
  }

  const nextAction = (currentStatus: string) => {
    if (["open", "sent"].includes(currentStatus)) return ["accept", tr("काम स्वीकार करें", "Accept job")];
    if (currentStatus === "accepted") return ["on_the_way", tr("रास्ते में हूँ", "On my way")];
    if (currentStatus === "on_the_way") return ["arrived", tr("मैं पहुँच गया", "I have arrived")];
    if (currentStatus === "arrived") return ["completed", tr("काम पूरा", "Work completed")];
    return null;
  };
  const step = tracked ? tracked.status === "completed" ? 4 : tracked.status === "arrived" ? 3 : tracked.status === "on_the_way" ? 2 : tracked.status === "accepted" ? 1 : 0 : 0;

  function renderJob(job: Job) {
    const next = nextAction(job.status);
    return (
      <article className={"job live-job" + (isLead(job) ? " fresh-lead" : "")} key={job.id}>
        <div>
          <small>{job.id}</small>
          <span>{job.vendorDecision === "rejected" ? tr("REJECTED · दोबारा ले सकते हैं", "REJECTED · can reaccept") : isLead(job) ? "● MATCHED LEAD" : status[job.status]?.[0] || job.status}</span>
        </div>
        <h3>{job.category} · {job.area}</h3>
        <p>{job.note || tr("काम का detail customer से पूछें", "Ask the customer for job details")}</p>
        <ul>
          <li>⌖ {job.address}, {job.pincode}</li>
          <li>◷ {job.scheduledFor}</li>
          {job.budget ? <li>₹ Budget {job.budget} / {units[job.rateUnit]}</li> : <li>₹ {tr("Rate बातचीत से तय होगा", "Rate to be agreed")}</li>}
        </ul>
        {isLead(job) && <div className="match-reason">✓ {tr("आपकी category + area से match", "Matches your category + area")}</div>}
        {job.ownerPhone && <div className="contacts">
          <a href={"tel:" + job.ownerPhone}>☎ Call owner</a>
          <a target="_blank" rel="noreferrer" href={"https://wa.me/91" + job.ownerPhone}>WhatsApp</a>
        </div>}
        <div className="job-buttons">
          {job.vendorDecision === "rejected" ? <button onClick={() => patchJob(job, "reaccept")}>{tr("↻ दोबारा Accept list में लें", "↻ Reaccept this lead")}</button> : <>
            {next && <button onClick={() => patchJob(job, next[0])}>{next[1]}</button>}
            {isLead(job) && <button className="reject" onClick={() => patchJob(job, "reject")}>{tr("Reject", "Reject")}</button>}
          </>}
          {["accepted", "on_the_way"].includes(job.status) && <button className="light" onClick={() => shareVendorLocation(job)}>⌖ {tr("Location अभी भेजें", "Send location now")}</button>}
        </div>
        {job.status === "on_the_way" && <div className={"auto-location" + (locationSharingJobId === job.id ? " on" : "")}><i/> {locationSharingJobId === job.id ? tr("Automatic live location ON", "Automatic live location ON") : tr("Location permission का इंतज़ार", "Waiting for location permission")}</div>}
      </article>
    );
  }

  return (
    <main>
      <header className="topbar live-topbar">
        <button className="brand" onClick={() => go("owner")}><span className="roof">⌂</span><span>Ghar<em>Seva</em></span></button>
        <nav className="role-nav">
          <button className={view === "owner" ? "active" : ""} onClick={() => go("owner")}><small>OWNER</small>{tr("Vendor चाहिए", "Find vendors")}</button>
          <button className={view === "vendor" ? "active" : ""} onClick={openVendorView}><small>VENDOR</small>{tr("काम चाहिए", "Find work")}</button>
          <button className={view === "track" ? "active" : ""} onClick={() => go("track")}><small>LIVE</small>{tr("Track करें", "Track request")}</button>
          <button className={view === "profile" ? "active" : ""} onClick={() => go("profile")}><small>ACCOUNT</small>{tr("Profile", "Profile")}</button>
        </nav>
        <div className="top-actions">
          <select className="language-select" aria-label="Language" value={lang} onChange={(event) => applyLanguage(event.target.value as Language)}><option value="hi">हिन्दी</option><option value="en">English</option></select>
          <button className={"notify-pill" + (notificationsEnabled ? " on" : "")} onClick={enableNotifications} title="Live notifications">
            🔔<span>{notificationsEnabled ? "ON" : ""}</span>
          </button>
          {authUser ? (
            <button className="auth-pill" onClick={() => go("profile")} title={authUser.email}><span>G</span> {authUser.name.split(" ")[0]}</button>
          ) : (
            <button className="auth-pill signin" onClick={() => withGoogleLogin(tr("GharSeva account खोलने", "opening your GharSeva account"), async () => {})}><span>G</span> Login</button>
          )}
        </div>
      </header>

      {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
      {liveToast && <div className="live-toast" role="status" aria-live="polite"><span>●</span><div><b>{liveToast.title}</b><p>{liveToast.body}</p></div><button onClick={() => setLiveToast(null)}>×</button></div>}
      {incomingLead && <aside className="incoming-call" role="alertdialog" aria-label={tr("नई काम की call", "Incoming work call")}>
        <div className="incoming-ring">⚒</div>
        <div className="incoming-copy"><small>{tr("नई काम की CALL", "INCOMING WORK CALL")}</small><b>{incomingLead.category} · {incomingLead.area}</b><span>{incomingLead.budget ? "₹" + incomingLead.budget + " / " + units[incomingLead.rateUnit] : tr("Rate owner से तय होगा", "Rate to be agreed with owner")}</span></div>
        <div className="incoming-actions"><button className="reject" onClick={() => patchJob(incomingLead, "reject")}>{tr("Reject", "Reject")}</button><button onClick={() => patchJob(incomingLead, "accept")}>{tr("Accept", "Accept")}</button><button className="later" onClick={() => setIncomingLead(null)}>{tr("बाद में", "Later")}</button></div>
      </aside>}

      {view === "owner" && <>
        <section className="owner-hero">
          <div className="shell owner-hero-grid">
            <div>
              <p className="eyebrow"><i/>OWNER WINDOW · LIVE MATCHING</p>
              <h1>{tr("काम लिखिए.", "Describe the job.")}<br/><em>{tr("Online vendor पाइए.", "Find an online vendor.")}</em></h1>
              <p>{tr("Labour, plumber या technician—जो काम search करेंगे, वही category पहले और online vendor सबसे ऊपर दिखेगा.", "Search for labour, a plumber or a technician—the exact category appears first, with online vendors prioritised.")}</p>
              <div className="owner-search">
                <label><small>{tr("कौन-सा काम?", "What work?")}</small><input list="service-search-list" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setCat("All"); }} placeholder="Labour, AC technician, painter…"/></label>
                <datalist id="service-search-list">{cats.map((category) => <option value={category[0]} key={category[0]}/>)}</datalist>
                <label><small>Area / pincode</small><input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Kandivali या 400067"/></label>
                <button onClick={() => document.getElementById("live-vendors")?.scrollIntoView({ behavior: "smooth" })}>{tr("Matching vendor देखें", "See matching vendors")} →</button>
              </div>
              <div className="live-summary">
                <span><i/>{tr("हर 3 सेकंड live refresh", "Live refresh every 3 seconds")}</span>
                <span><b>{onlineCount}</b> {tr("matching online", "matching online")}</span>
                <button onClick={locate}>⌖ {locationDisplay}</button>
              </div>
            </div>
            <aside className="role-card owner-role-card">
              <small>{tr("आपको घर का काम कराना है?", "Need work done at home?")}</small>
              <h2>{tr("यह Owner window है", "This is the Owner window")}</h2>
              <ol><li>{tr("काम और area search करें", "Search by work and area")}</li><li>{tr("Online vendor compare करें", "Compare online vendors")}</li><li>{tr("Request भेजकर live track करें", "Send a request and track it live")}</li></ol>
              <button onClick={() => openRequest(null)}>{tr("सभी matching vendors को request", "Request all matching vendors")}</button>
              <a onClick={openVendorView}>{tr("मैं vendor हूँ, मुझे काम चाहिए", "I am a vendor looking for work")} →</a>
            </aside>
          </div>
        </section>

        <section className="owner-activity shell">
          <div className="section-head activity-head"><div><p className="eyebrow"><i/>{tr("RECENT ACTIVITY", "RECENT ACTIVITY")}</p><h2>{tr("मेरे काम और पुराने contacts", "My jobs and past contacts")}</h2><span>{tr("Status live update होता है; पुराने vendor को call या फिर से book करें.", "Statuses update live; call a past vendor or book the job again.")}</span></div>{authUser && <button onClick={() => void loadOwnerActivity(authToken)}>↻ {tr("Refresh", "Refresh")}</button>}</div>
          {!authUser ? <div className="activity-login"><b>{tr("Activity देखने के लिए Google Login", "Google Login to view activity")}</b><span>{tr("आपकी requests केवल उसी Google account को दिखती हैं.", "Only requests from the same Google account are shown.")}</span><button onClick={() => withGoogleLogin(tr("recent activity देखने", "viewing recent activity"), loadOwnerActivity)}>G&nbsp; Login</button></div> : ownerJobs.length ? <div className="activity-strip">{ownerJobs.slice(0, 8).map((job) => <article className="activity-card" key={job.id}>
            <div><small>{job.id}</small><span>{status[job.status]?.[0] || job.status}</span></div><h3>{job.category}</h3><p>⌖ {job.area} · {job.scheduledFor}</p>
            {job.vendorName ? <div className="activity-vendor"><div className="avatar">{initials(job.vendorName)}</div><div><small>{tr("Vendor", "Vendor")}</small><b>{job.vendorName}</b></div></div> : <div className="activity-wait">◌ {tr("Vendor response का इंतज़ार", "Waiting for a vendor")}</div>}
            <div className="activity-actions"><button onClick={() => { setTracked(job); setTrackId(job.id); go("track"); }}>{tr("Track", "Track")}</button>{job.vendorPhone && <a href={"tel:" + job.vendorPhone}>☎ {tr("Call", "Call")}</a>}<button className="light" onClick={() => rebook(job)}>↻ {tr("फिर कराएँ", "Book again")}</button></div>
            {job.status === "completed" && !job.reviewRating && <div className="review-box"><b>{tr("Vendor को rating दें", "Rate this vendor")}</b><div>{[1,2,3,4,5].map((star) => <button className={(ratingDraft[job.id] || 0) >= star ? "picked" : ""} onClick={() => setRatingDraft((current) => ({ ...current, [job.id]: star }))} key={star}>★</button>)}</div><input value={reviewDraft[job.id] || ""} onChange={(event) => setReviewDraft((current) => ({ ...current, [job.id]: event.target.value }))} placeholder={tr("Feedback (optional)", "Feedback (optional)")}/><button disabled={!ratingDraft[job.id]} onClick={() => void submitReview(job)}>{tr("Rating भेजें", "Submit rating")}</button></div>}
            {!!job.reviewRating && <div className="review-saved">★ {job.reviewRating}/5 · {tr("Rating दी गई", "Rating submitted")}</div>}
          </article>)}</div> : <div className="activity-empty"><b>{tr("अभी कोई request नहीं", "No requests yet")}</b><span>{tr("काम post करते ही उसकी live activity यहाँ आएगी.", "Live activity will appear here after you post a job.")}</span><button onClick={() => openRequest(null)}>{tr("पहला काम डालें", "Post your first job")}</button></div>}
        </section>

        <section className="categories shell compact-categories">
          <div className="section-head"><div><p className="eyebrow">{tr("काम की CATEGORY", "SERVICE CATEGORY")}</p><h2>{tr("सीधा category चुनें", "Choose a category")}</h2></div><button onClick={() => setAllCats((current) => !current)}>{allCats ? tr("कम दिखाएँ", "Show less") : tr("सभी categories", "All categories")} →</button></div>
          <div className="cat-grid">{cats.slice(0, allCats ? cats.length : 10).map((category) => (
            <button key={category[0]} className={cat === category[0] ? "selected" : ""} onClick={() => selectCategory(category[0])}>
              <span>{category[1]}</span><b>{category[0]}</b><small>{category[2]}</small>
            </button>
          ))}</div>
        </section>

        <AdSlot placement="services" />

        <section className="nearby live-nearby" id="live-vendors">
          <div className="shell">
            <div className="section-head near-head">
              <div><p className="eyebrow"><i/>LIVE VENDORS</p><h2>{searchTerm || cat !== "All" ? (searchTerm || cat) + tr(" के vendors", " vendors") : tr("आपके पास registered vendors", "Registered vendors near you")}</h2><span>{tr("Exact काम पहले · Online status दूसरा · Area और rating के अनुसार priority", "Exact service first · Online status next · Then area and rating")}</span></div>
              <button onClick={() => openRequest(null)}>{tr("Open request भेजें", "Send open request")} ↗</button>
            </div>
            <div className="result-strip"><span>● {onlineCount} online</span><span>{shown.length} matching profiles</span><span>{tr("Auto-refresh चालू", "Auto-refresh on")}</span></div>
            {loading ? <div className="empty">{tr("Live vendors खोज रहे हैं…", "Finding live vendors…")}</div> : shown.length ? (
              <div className="vendor-grid">{shown.map((vendor, index) => (
                <article className={"vendor-card live-vendor-card" + (vendor.online ? " is-online" : "")} key={vendor.id}>
                  <div className="vendor-top">
                    <div className="avatar">{initials(vendor.name)}</div>
                    <span className={vendor.online ? "online" : "offline"}>● {vendor.online ? "Online now" : "Offline"}</span>
                    {index === 0 && <i>TOP MATCH</i>}
                  </div>
                  <h3>{vendor.name} {vendor.verified && <em>✓</em>}</h3>
                  <b className="service">{vendor.category} · {vendor.experienceYears} {tr("साल", "years")}</b>
                  <p>{vendor.workDescription || vendor.category + tr(" के काम उपलब्ध", " services available")}</p>
                  <div className="meta"><span>★ {vendor.rating} ({vendor.completedJobs} {tr("काम", "jobs")})</span><span>⌖ {vendor.area} · {vendor.pincode}</span></div>
                  <div className="price"><div><small>{tr("शुरुआती rate", "Starting rate")}</small><b>₹{vendor.rate} <em>/ {units[vendor.rateUnit]}</em></b>{vendor.negotiable && <span>{tr("बात करके बदल सकता है", "Negotiable after contact")}</span>}</div><button disabled={!vendor.online} onClick={() => openRequest(vendor)}>{vendor.online ? tr("Request भेजें", "Send request") : tr("अभी Offline", "Offline now")}</button></div>
                </article>
              ))}</div>
            ) : (
              <div className="empty"><b>{tr("इस search में registered vendor नहीं मिला", "No registered vendor matched this search")}</b><span>{tr("Request save करें; matching vendor online आते ही उसे live दिखेगी.", "Save the request; matching vendors will see it when they come online.")}</span><button onClick={() => openRequest(null)}>{tr("काम post करें", "Post a job")}</button></div>
            )}
          </div>
        </section>
        <AdSlot placement="vendors" />
      </>}

      {view === "vendor" && <section className="vendor-window">
        <div className="vendor-window-head">
          <div className="shell vendor-head-grid">
            <div><p className="eyebrow"><i/>VENDOR WINDOW · LIVE LEADS</p><h1>{tr("काम चाहिए?", "Looking for work?")}<br/><em>{tr("Online हो जाइए.", "Go online.")}</em></h1><p>{tr("आपकी registered category और area से matching customer काम अपने-आप हर 3 सेकंड में यहाँ आएगा.", "Matching customer jobs for your registered category and area appear here automatically every 3 seconds.")}</p></div>
            <aside className="role-card vendor-role-card"><small>{tr("आप service देते हैं?", "Do you provide services?")}</small><h2>{tr("यह Vendor window है", "This is the Vendor window")}</h2><ol><li>{tr("Profile और rate register करें", "Register your profile and rate")}</li><li>{tr("Online status चालू रखें", "Keep online status enabled")}</li><li>{tr("Lead accept करके owner से connect हों", "Accept a lead and connect with the owner")}</li></ol><a onClick={() => go("owner")}>{tr("मैं owner हूँ, मुझे vendor चाहिए", "I am an owner looking for a vendor")} →</a></aside>
          </div>
        </div>

        <div className="shell vendor-dashboard">
          <section className="panel vendor-account-panel">
            <div className="panel-title"><span>01</span><div><h2>{tr("मेरी Vendor profile", "My Vendor profile")}</h2><p>{tr("एक Google account पर एक profile.", "One profile per Google account.")}</p></div></div>
            {vendorProfile ? <>
              <div className="vendor-live-profile">
                <div className="avatar">{initials(vendorProfile.name)}</div>
                <div><b>{vendorProfile.name}</b><span>{vendorProfile.category} · {vendorProfile.area} · {vendorProfile.pincode}</span></div>
                <button className={"online-toggle" + (vendorProfile.available ? " on" : "")} onClick={toggleVendorOnline}><i/><span>{vendorProfile.available ? "ONLINE" : "OFFLINE"}</span></button>
              </div>
              <div className="vendor-stat-grid"><div><b>{openLeads.length}</b><span>Matching leads</span></div><div><b>{activeJobs.length}</b><span>{tr("Active काम", "Active jobs")}</span></div><div><b>3 sec</b><span>Live refresh</span></div></div>
              <div className="profile-detail"><span>{tr("काम", "Service")}</span><b>{vendorProfile.category}</b><span>Starting rate</span><b>₹{vendorProfile.rate} / {units[vendorProfile.rateUnit]}</b><span>Status</span><b className={vendorProfile.online ? "green-text" : ""}>{vendorProfile.online ? "Live online" : vendorProfile.available ? "Connecting…" : "Offline"}</b></div>
              <button className="notification-action edit-profile-action" onClick={() => go("profile")}>✎ {tr("Profile और rate edit करें", "Edit profile and rate")}</button>
              <button className="notification-action" onClick={enableNotifications}>🔔 {notificationsEnabled ? "Notifications चालू हैं" : "Lead notifications चालू करें"}</button>
            </> : <>
              {!authUser && <div className="vendor-login-cta"><span>G</span><h3>{tr("काम देखने के लिए Google Login", "Google Login to view work")}</h3><p>{tr("Login के बाद आपकी registered profile और matching leads खुलेंगी.", "Your registered profile and matching leads open after login.")}</p><button onClick={loadJobs}>Continue with Google</button></div>}
              <form className={"form vendor-register-form" + (!authUser ? " muted-form" : "")} onSubmit={register}>
                <Field label={tr("पूरा नाम", "Full name")}><input required value={vendorForm.name} onChange={(event) => setVendorForm({ ...vendorForm, name: event.target.value })} placeholder="Rakesh Kumar"/></Field>
                <Field label="Contact mobile"><input required inputMode="numeric" maxLength={10} value={vendorForm.phone} onChange={(event) => setVendorForm({ ...vendorForm, phone: event.target.value.replace(/\D/g, "") })} placeholder="10 digit number"/></Field>
                <Field label={tr("मुख्य काम", "Main service")}><select value={vendorForm.category} onChange={(event) => setVendorForm({ ...vendorForm, category: event.target.value })}>{cats.map((category) => <option key={category[0]}>{category[0]}</option>)}</select></Field>
                <Field label={tr("अनुभव (साल)", "Experience (years)")}><input required type="number" min="0" value={vendorForm.experienceYears} onChange={(event) => setVendorForm({ ...vendorForm, experienceYears: event.target.value })} placeholder="5"/></Field>
                <Field label="Area"><input required value={vendorForm.area} onChange={(event) => setVendorForm({ ...vendorForm, area: event.target.value })} placeholder="Kandivali West"/></Field>
                <Field label="Pincode"><input required inputMode="numeric" maxLength={6} value={vendorForm.pincode} onChange={(event) => setVendorForm({ ...vendorForm, pincode: event.target.value.replace(/\D/g, "") })} placeholder="400067"/></Field>
                <Field label="Starting rate"><div className="money"><span>₹</span><input required type="number" min="1" value={vendorForm.rate} onChange={(event) => setVendorForm({ ...vendorForm, rate: event.target.value })} placeholder="300"/></div></Field>
                <Field label="Rate unit"><select value={vendorForm.rateUnit} onChange={(event) => setVendorForm({ ...vendorForm, rateUnit: event.target.value })}>{Object.keys(units).map((unit) => <option value={unit} key={unit}>per {units[unit]}</option>)}</select></Field>
                <Field label={tr("काम का description", "Work description")} wide><textarea rows={3} value={vendorForm.workDescription} onChange={(event) => setVendorForm({ ...vendorForm, workDescription: event.target.value })} placeholder={tr("आप कौन-कौन से काम करते हैं?", "What work do you provide?")}/></Field>
                <label className="check wide"><input type="checkbox" checked={vendorForm.negotiable} onChange={(event) => setVendorForm({ ...vendorForm, negotiable: event.target.checked })}/>{tr("Rate बात के बाद बदल सकता हूँ", "My rate can change after discussion")}</label>
                <button type="button" className="location wide" onClick={locate}>⌖ {coords ? tr("Current location जुड़ी", "Current location added") : tr("काम की location जोड़ें", "Add work location")}</button>
                <button className="primary wide" disabled={vendorBusy}>{vendorBusy ? tr("Profile बन रही है…", "Creating profile…") : tr("Google Login करके profile बनाएँ", "Google Login & create profile")} →</button>
                <small className="foot wide">{tr("Profile बनते ही आप Online होंगे और matching leads live आएँगी.", "You go online after creating a profile and matching leads appear live.")}</small>
              </form>
            </>}
          </section>

          <section className="panel live-leads-panel">
            <div className="leads-head"><div><span className="live-dot"/>LIVE WORK FEED<h2>{tr("मेरे matching काम", "My matching jobs")}</h2><p>{vendorProfile ? vendorProfile.category + " · " + vendorProfile.area : tr("Profile की category और area के हिसाब से", "Based on your profile category and area")}</p></div><div className="lead-count"><b>{openLeads.length}</b><span>{tr("नई leads", "New leads")}</span></div></div>
            <div className="sync-bar"><span>↻ {tr("हर 3 सेकंड refresh", "Refresh every 3 seconds")}</span><span>{lastJobsSync ? "Last sync " + lastJobsSync : tr("Dashboard खोलें", "Open dashboard")}</span><button onClick={loadJobs}>{jobsBusy ? "Sync…" : tr("अभी refresh", "Refresh now")}</button></div>
            {!vendorProfile ? <div className="job-empty"><b>{tr("Vendor profile खोलें या बनाएँ", "Open or create a vendor profile")}</b><span>{tr("उसके बाद customer के matching काम यहाँ live दिखेंगे.", "Matching customer jobs will then appear here live.")}</span></div> : <>
              {!vendorProfile.available && <div className="offline-empty"><span>◌</span><b>{tr("आप Offline हैं", "You are offline")}</b><p>{tr("नई matching leads पाने के लिए Online toggle चालू करें.", "Turn on the Online toggle to receive new matching leads.")}</p></div>}
              {vendorProfile.available && <><div className="feed-section-title"><b>{tr("नई matching leads", "New matching leads")}</b><span>{openLeads.length}</span></div><div className="job-list live-job-list">{openLeads.length ? openLeads.map(renderJob) : <div className="job-empty">{tr("अभी नया matching काम नहीं है. यह feed live refresh हो रही है.", "No new matching jobs yet. This feed is refreshing live.")}</div>}</div></>}
              {!!activeJobs.length && <><div className="feed-section-title"><b>{tr("चल रहे काम", "Active jobs")}</b><span>{activeJobs.length}</span></div><div className="job-list active-job-list">{activeJobs.map(renderJob)}</div></>}
              {!!rejectedLeads.length && <details className="previous-jobs rejected-jobs" open><summary>{tr("Rejected — दोबारा accept कर सकते हैं", "Rejected — available to reaccept")} ({rejectedLeads.length})</summary><div className="job-list">{rejectedLeads.map(renderJob)}</div></details>}
              {!!previousJobs.length && <details className="previous-jobs"><summary>{tr("पुराने काम", "Past jobs")} ({previousJobs.length})</summary><div className="job-list">{previousJobs.map(renderJob)}</div></details>}
            </>}
          </section>
        </div>
      </section>}

      {view === "profile" && <section className="profile-page shell">
        <div className="profile-heading"><p className="eyebrow">ACCOUNT · SETTINGS</p><h1>{tr("Profile और settings", "Profile and settings")}</h1><p>{tr("Owner और Vendor details edit करें, भाषा बदलें, feedback दें या logout करें.", "Edit owner and vendor details, change language, send feedback or sign out.")}</p></div>
        {!authUser ? <div className="panel profile-login"><span>G</span><h2>{tr("Profile खोलने के लिए Google Login", "Google Login to open your profile")}</h2><p>{tr("एक ही सुरक्षित account से Owner और Vendor दोनों window चलेंगी.", "Use one secure account for both Owner and Vendor windows.")}</p><button onClick={() => withGoogleLogin(tr("profile खोलने", "opening your profile"), loadAccount)}>Continue with Google</button></div> : <>
          <form className="profile-grid" onSubmit={saveProfiles}>
            <section className="panel profile-panel">
              <div className="panel-title"><span>01</span><div><h2>{tr("Owner profile", "Owner profile")}</h2><p>{authUser.email}</p></div></div>
              <div className="form profile-form">
                <Field label={tr("पूरा नाम", "Full name")} wide><input required value={ownerProfile.name} onChange={(event) => setOwnerProfile({ ...ownerProfile, name: event.target.value })}/></Field>
                <Field label={tr("Contact mobile", "Contact mobile")} wide><input inputMode="numeric" maxLength={10} value={ownerProfile.phone} onChange={(event) => setOwnerProfile({ ...ownerProfile, phone: event.target.value.replace(/\D/g, "") })} placeholder={tr("10 digit (optional)", "10 digits (optional)")}/></Field>
                <Field label={tr("Google email", "Google email")} wide><input disabled value={ownerProfile.email || authUser.email}/></Field>
                <Field label={tr("App भाषा", "App language")} wide><select value={ownerProfile.language} onChange={(event) => { const next = event.target.value as Language; setOwnerProfile({ ...ownerProfile, language: next }); applyLanguage(next); }}><option value="hi">हिन्दी</option><option value="en">English</option></select></Field>
              </div>
            </section>

            <section className="panel profile-panel">
              <div className="panel-title"><span>02</span><div><h2>{tr("Vendor profile", "Vendor profile")}</h2><p>{tr("काम, area और starting rate edit करें.", "Edit service, area and starting rate.")}</p></div></div>
              {vendorProfile ? <div className="form profile-form">
                <Field label={tr("पूरा नाम", "Full name")}><input required value={vendorEdit.name} onChange={(event) => setVendorEdit({ ...vendorEdit, name: event.target.value })}/></Field>
                <Field label={tr("Contact mobile", "Contact mobile")}><input required inputMode="numeric" maxLength={10} value={vendorEdit.phone} onChange={(event) => setVendorEdit({ ...vendorEdit, phone: event.target.value.replace(/\D/g, "") })}/></Field>
                <Field label={tr("मुख्य काम", "Main service")}><select value={vendorEdit.category} onChange={(event) => setVendorEdit({ ...vendorEdit, category: event.target.value })}>{cats.map((category) => <option key={category[0]}>{category[0]}</option>)}</select></Field>
                <Field label={tr("अनुभव (साल)", "Experience (years)")}><input required type="number" min="0" value={vendorEdit.experienceYears} onChange={(event) => setVendorEdit({ ...vendorEdit, experienceYears: event.target.value })}/></Field>
                <Field label="Area"><input required value={vendorEdit.area} onChange={(event) => setVendorEdit({ ...vendorEdit, area: event.target.value })}/></Field>
                <Field label="Pincode"><input required inputMode="numeric" maxLength={6} value={vendorEdit.pincode} onChange={(event) => setVendorEdit({ ...vendorEdit, pincode: event.target.value.replace(/\D/g, "") })}/></Field>
                <Field label={tr("Starting rate", "Starting rate")}><div className="money"><span>₹</span><input required type="number" min="1" value={vendorEdit.rate} onChange={(event) => setVendorEdit({ ...vendorEdit, rate: event.target.value })}/></div></Field>
                <Field label={tr("Rate unit", "Rate unit")}><select value={vendorEdit.rateUnit} onChange={(event) => setVendorEdit({ ...vendorEdit, rateUnit: event.target.value })}>{Object.keys(units).map((unit) => <option value={unit} key={unit}>per {units[unit]}</option>)}</select></Field>
                <Field label={tr("काम का description", "Work description")} wide><textarea rows={3} value={vendorEdit.workDescription} onChange={(event) => setVendorEdit({ ...vendorEdit, workDescription: event.target.value })}/></Field>
                <label className="check wide"><input type="checkbox" checked={vendorEdit.negotiable} onChange={(event) => setVendorEdit({ ...vendorEdit, negotiable: event.target.checked })}/>{tr("Rate बातचीत के बाद बदल सकता है", "Rate can change after discussion")}</label>
              </div> : <div className="profile-no-vendor"><span>⚒</span><b>{tr("Vendor profile नहीं बनी", "No vendor profile yet")}</b><p>{tr("काम पाना है तो Vendor window में profile बनाएँ.", "Create a profile in the Vendor window to find work.")}</p><button type="button" onClick={openVendorView}>{tr("Vendor profile बनाएँ", "Create vendor profile")}</button></div>}
            </section>
            <button className="primary profile-save" disabled={profileBusy}>{profileBusy ? tr("Save हो रहा है…", "Saving…") : tr("Profile और settings Save करें", "Save profile and settings")}</button>
          </form>

          <div className="profile-lower-grid">
            <section className="panel settings-panel"><div className="panel-title"><span>03</span><div><h2>{tr("Settings और support", "Settings and support")}</h2><p>{tr("Notification, login और help.", "Notifications, sign-in and help.")}</p></div></div><button className="settings-row" onClick={enableNotifications}><span>🔔</span><div><b>{tr("Live notifications", "Live notifications")}</b><small>{notificationsEnabled ? tr("चालू हैं", "Enabled") : tr("Permission दें", "Allow permission")}</small></div><em>›</em></button><a className="settings-row" href="mailto:rajatgoyal8770@gmail.com"><span>✉</span><div><b>{tr("Email support", "Email support")}</b><small>rajatgoyal8770@gmail.com</small></div><em>›</em></a><button className="settings-row logout-row" onClick={logout}><span>↪</span><div><b>Logout</b><small>{authUser.email}</small></div><em>›</em></button></section>
            <form className="panel feedback-panel" onSubmit={sendFeedback}><div className="panel-title"><span>04</span><div><h2>{tr("Feedback", "Feedback")}</h2><p>{tr("App को बेहतर बनाने के लिए लिखें.", "Tell us how to improve the app.")}</p></div></div><textarea required minLength={5} rows={6} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder={tr("आपका सुझाव या समस्या…", "Your suggestion or issue…")}/><button disabled={feedbackBusy}>{feedbackBusy ? tr("भेज रहे हैं…", "Sending…") : tr("Feedback भेजें", "Send feedback")}</button></form>
          </div>
        </>}
      </section>}

      {view === "track" && <section className="page track shell">
        <div className="track-intro"><p className="eyebrow"><i/>OWNER LIVE TRACKING</p><h1>{tr("Request का live status.", "Live request status.")}</h1><p>{tr("Booking वाले Google account से login करके Request ID डालें. Status हर 3 सेकंड refresh होगा.", "Sign in with the booking Google account and enter the Request ID. Status refreshes every 3 seconds.")}</p><button className="notification-action track-notify" onClick={enableNotifications}>🔔 {notificationsEnabled ? "Update notifications ON" : tr("Update notifications चालू करें", "Enable update notifications")}</button></div>
        <div className="track-search google-track"><input value={trackId} onChange={(event) => setTrackId(event.target.value.toUpperCase())} placeholder="Request ID — GS…"/><button onClick={loadTrack}>{trackBusy ? tr("Track हो रहा…", "Tracking…") : tr("Google Login & live track", "Google Login & live track")} →</button></div>
        {tracked ? <div className="track-grid">
          <section className="panel tracking">
            <div className="track-title"><div><small>LIVE REQUEST {tracked.id}</small><h2>{tracked.category}</h2><p>{tracked.area} · {tracked.scheduledFor}</p></div><b><i className="live-dot"/> {status[tracked.status]?.[0]}</b></div>
            <div className="timeline">{(lang === "hi" ? ["Request", "Accepted", "रास्ते में", "पहुँचे", "पूरा"] : ["Request", "Accepted", "On way", "Arrived", "Complete"]).map((label, index) => <div className={index <= step ? "done" : ""} key={label}><span>{index < step ? "✓" : index + 1}</span><small>{label}</small></div>)}</div>
            <div className="status"><i/><div><b>{status[tracked.status]?.[0]}</b><p>{status[tracked.status]?.[1]}</p></div></div>
            <dl><div><dt>Address</dt><dd>{tracked.address}, {tracked.pincode}</dd></div><div><dt>Budget</dt><dd>{tracked.budget ? "₹" + tracked.budget + " / " + units[tracked.rateUnit] : "Vendor से तय होगा"}</dd></div><div><dt>Detail</dt><dd>{tracked.note || "—"}</dd></div></dl>
          </section>
          <aside className="panel track-side">
            {tracked.vendorName ? <><div className="assigned"><div className="avatar">{initials(tracked.vendorName)}</div><div><small>Assigned vendor</small><b>{tracked.vendorName}</b><span>{tracked.category}</span></div></div><div className="contact-buttons"><a href={"tel:" + tracked.vendorPhone}>☎ Call</a><a target="_blank" rel="noreferrer" href={"https://wa.me/91" + tracked.vendorPhone}>WhatsApp</a></div></> : <div className="waiting"><span>◌</span><b>Matching online vendor खोज रहे हैं</b><p>Category और area वाले vendors को request live दिखाई दे रही है.</p></div>}
            <div className={"location-box" + (tracked.vendorLatitude != null ? " tracking-live" : "")}><div><span>⌂</span>{tracked.vendorLatitude != null && <i>🔧</i>}</div>{tracked.vendorLatitude != null && tracked.vendorLongitude != null ? <><b><i className="live-dot"/> {tr("Vendor की live location", "Vendor live location")}</b><a target="_blank" rel="noreferrer" href={"https://www.google.com/maps?q=" + tracked.vendorLatitude + "," + tracked.vendorLongitude}>{tr("Live map खोलें", "Open live map")} ↗</a></> : <p>{tr("Vendor निकलने पर location अपने-आप दिखेगी.", "Location appears automatically when the vendor leaves.")}</p>}<small>{tr("हर 3 सेकंड auto-refresh", "Auto-refresh every 3 seconds")}</small></div>
            <div className="safety"><b>काम शुरू होने से पहले</b><p>Final scope और rate WhatsApp पर confirm करें.</p></div>
          </aside>
        </div> : <div className="track-empty"><div>⌖</div><b>{tr("Live status यहाँ दिखेगा", "Live status appears here")}</b><p>{tr("Vendor accept करते ही notification, call, WhatsApp और location मिलेंगे.", "After a vendor accepts, you get notifications, call, WhatsApp and location options.")}</p></div>}
      </section>}

      <footer><div className="shell"><b>⌂ Ghar<span>Seva</span></b><p>{tr("Owner को vendor. Vendor को काम. एक ही जगह.", "Vendors for owners. Work for vendors. All in one place.")}</p><a href="/privacy">Privacy</a><a href="mailto:rajatgoyal8770@gmail.com">Support: rajatgoyal8770@gmail.com</a></div></footer>
      <nav className="mobile-nav live-mobile-nav">
        <button className={view === "owner" ? "active" : ""} onClick={() => go("owner")}><span>⌂</span>Owner</button>
        <button onClick={() => openRequest(null)}><span>＋</span>{tr("काम डालें", "Post")}</button>
        <button className={view === "vendor" ? "active" : ""} onClick={openVendorView}><span>⚒</span>Vendor</button>
        <button className={view === "track" ? "active" : ""} onClick={() => go("track")}><span>⌖</span>Track</button>
        <button className={view === "profile" ? "active" : ""} onClick={() => go("profile")}><span>●</span>{tr("Profile", "Profile")}</button>
      </nav>

      <GoogleLoginModal key={loginPurpose || "closed"} purpose={loginPurpose} onClose={closeLogin} onAuthenticated={googleAuthenticated}/>

      {modal && <div className="backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(false)}>
        <section className="modal"><button className="close" onClick={() => setModal(false)}>×</button>
          {created ? <div className="success created"><span>✓</span><small>LIVE REQUEST SENT</small><h2>{tr("आपकी request बन गई.", "Your request is live.")}</h2><div className="code"><small>Request ID</small><b>{created.id}</b><button onClick={() => navigator.clipboard?.writeText(created.id)}>Copy</button></div><div className="delivery-result"><b>{notifiedCount ? notifiedCount + tr(" online vendor को lead भेजी गई", " online vendors received the lead") : tr("Request save हो गई", "Request saved")}</b><p>{notifiedCount ? tr("Matching vendor इसे अपने live dashboard में देख सकते हैं.", "Matching vendors can see it on their live dashboard.") : tr("Matching vendor online आते ही यह काम उसके feed में दिखेगा.", "The job appears when a matching vendor comes online.")}</p></div><div><button onClick={() => { setModal(false); go("track"); }}>{tr("Live track करें", "Track live")} →</button><button className="gray" onClick={() => setModal(false)}>{tr("बंद करें", "Close")}</button></div></div> : <>
            <div className="modal-head"><small>{picked ? "DIRECT ONLINE REQUEST" : "OPEN MATCHING REQUEST"}</small><h2>{picked ? picked.name + tr(" को request भेजें", " — send request") : tr("Matching online vendors को भेजें", "Send to matching online vendors")}</h2><p>{picked ? picked.category + " · " + picked.area + " · Online" : tr("Category + area match होने पर vendor को live feed में दिखेगी.", "Vendors see it live when category and area match.")}</p></div>
            <form className="form" onSubmit={createRequest}>
              <Field label={tr("आपका नाम", "Your name")}><input required value={booking.ownerName} onChange={(event) => setBooking({ ...booking, ownerName: event.target.value })} placeholder={tr("पूरा नाम", "Full name")}/></Field>
              <Field label="Contact mobile"><input required inputMode="numeric" maxLength={10} value={booking.ownerPhone} onChange={(event) => setBooking({ ...booking, ownerPhone: event.target.value.replace(/\D/g, "") })} placeholder="10 digit number"/></Field>
              <Field label={tr("काम", "Service")}><select value={booking.category} onChange={(event) => setBooking({ ...booking, category: event.target.value })}>{cats.map((category) => <option key={category[0]}>{category[0]}</option>)}</select></Field>
              <Field label={tr("कब चाहिए?", "When needed?")}><select value={booking.scheduledFor} onChange={(event) => setBooking({ ...booking, scheduledFor: event.target.value })}><option value="आज — जल्दी">{tr("आज — जल्दी", "Today — urgent")}</option><option value="आज — शाम तक">{tr("आज — शाम तक", "By this evening")}</option><option value="कल सुबह">{tr("कल सुबह", "Tomorrow morning")}</option><option value="इस हफ्ते">{tr("इस हफ्ते", "This week")}</option><option value="बात करके तय होगा">{tr("बात करके तय होगा", "Decide after discussion")}</option></select></Field>
              <Field label="Area"><input required value={booking.area} onChange={(event) => setBooking({ ...booking, area: event.target.value })} placeholder="Kandivali West"/></Field>
              <Field label="Pincode"><input required inputMode="numeric" maxLength={6} value={booking.pincode} onChange={(event) => setBooking({ ...booking, pincode: event.target.value.replace(/\D/g, "") })} placeholder="400067"/></Field>
              <Field label={tr("पूरा address", "Full address")} wide><input required value={booking.address} onChange={(event) => setBooking({ ...booking, address: event.target.value })} placeholder="Building, road, landmark"/></Field>
              <Field label="Budget (optional)"><div className="money"><span>₹</span><input type="number" value={booking.budget} onChange={(event) => setBooking({ ...booking, budget: event.target.value })} placeholder="500"/></div></Field>
              <Field label="Budget unit"><select value={booking.rateUnit} onChange={(event) => setBooking({ ...booking, rateUnit: event.target.value })}>{Object.keys(units).map((unit) => <option value={unit} key={unit}>per {units[unit]}</option>)}</select></Field>
              <Field label={tr("काम का detail", "Job details")} wide><textarea rows={3} value={booking.note} onChange={(event) => setBooking({ ...booking, note: event.target.value })} placeholder={tr("जैसे kitchen sink के नीचे leakage…", "For example, leakage under the kitchen sink…")}/></Field>
              <button type="button" className="location wide" onClick={locate}>⌖ {coords ? tr("Current location जुड़ी", "Current location added") : tr("Current location share करें", "Share current location")}</button>
              <button className="primary wide" disabled={bookBusy}>{bookBusy ? tr("Live request भेज रहे हैं…", "Sending live request…") : tr("Google Login & matching vendors को भेजें", "Google Login & send to matching vendors")} →</button>
              <small className="foot wide">{tr("Owner contact और पूरा address vendor को काम accept करने के बाद दिखेगा.", "Owner contact and full address are shown only after a vendor accepts.")}</small>
            </form>
          </>}
        </section>
      </div>}
    </main>
  );
}
