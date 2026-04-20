"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type OrgType = "GOV" | "PVT";
type CountryOption = { code: string; name: string };
type StateOption = { code: string; name: string };
type CityOption = { name: string };

export default function SignupPage() {
  const [form, setForm] = useState({
    name: "",
    countryCode: "",
    countryName: "",
    stateCode: "",
    stateName: "",
    city: "",
    orgType: "PVT" as OrgType,
    sector: "",
    domain: "",
    adminEmail: "",
    adminPhone: ""
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    let cancelled = false;
    setLoadingCountries(true);
    fetch("/api/locations")
      .then((response) => response.json())
      .then((data: { countries?: CountryOption[] }) => {
        if (!cancelled) setCountries(data.countries || []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load countries.");
      })
      .finally(() => {
        if (!cancelled) setLoadingCountries(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.countryCode) {
      setStates([]);
      setCities([]);
      return;
    }
    let cancelled = false;
    setLoadingStates(true);
    fetch(`/api/locations?countryCode=${encodeURIComponent(form.countryCode)}`)
      .then((response) => response.json())
      .then((data: { states?: StateOption[] }) => {
        if (!cancelled) setStates(data.states || []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load states.");
      })
      .finally(() => {
        if (!cancelled) setLoadingStates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.countryCode]);

  useEffect(() => {
    if (!form.countryCode || !form.stateCode) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setLoadingCities(true);
    fetch(
      `/api/locations?countryCode=${encodeURIComponent(form.countryCode)}&stateCode=${encodeURIComponent(form.stateCode)}`
    )
      .then((response) => response.json())
      .then((data: { cities?: CityOption[] }) => {
        if (!cancelled) setCities(data.cities || []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load cities.");
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.countryCode, form.stateCode]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/org/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error || "Organization signup failed");
        return;
      }
      setMessage(`Application submitted. Org ID: ${data?.orgId || "N/A"}`);
    } catch {
      setError("Could not reach backend API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 80% 0%, rgba(109, 35, 249, 0.16) 0%, rgba(245, 247, 251, 0) 30%), linear-gradient(180deg, #f7f8fc 0%, #eef1f6 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px"
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "1120px",
          background: "#fff",
          border: "1px solid #e6eaf1",
          boxShadow: "0 30px 80px rgba(30, 41, 59, 0.12)",
          borderRadius: "18px",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1.05fr 1.3fr"
        }}
      >
        <aside
          style={{
            background:
              "linear-gradient(165deg, rgba(17,24,39,1) 0%, rgba(36,47,66,1) 60%, rgba(109,35,249,0.95) 100%)",
            color: "#f8fafc",
            padding: "42px 34px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.75 }}>
              VERIFY_LEDGER
            </p>
            <h2 style={{ margin: "18px 0 12px", fontSize: "34px", lineHeight: 1.05, fontWeight: 800 }}>
              Organization onboarding.
            </h2>
            <p style={{ margin: 0, color: "rgba(241,245,249,0.85)", lineHeight: 1.5 }}>
              Register your entity to issue trusted certificates and participate in the verification network.
            </p>
          </div>
          <div style={{ display: "grid", gap: "8px", fontSize: "13px", color: "rgba(241,245,249,0.85)" }}>
            <span>Multi-step trust review process</span>
            <span>Location and entity metadata validation</span>
            <span>Role-based admin provisioning</span>
          </div>
        </aside>

        <div style={{ padding: "40px 34px" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: "30px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            Organization Signup
          </h1>
          <p style={{ margin: "0 0 20px", color: "#4b5563" }}>Submit your organization for onboarding.</p>

          <form
            onSubmit={onSubmit}
            style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
          >
          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 600, gridColumn: "span 2" }}>
            Organization Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
              style={{ border: "1px solid #d1d5db", padding: "12px 14px", fontSize: "14px", borderRadius: "10px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
            Country
            <select
              value={form.countryCode}
              onChange={(e) => {
                const selected = countries.find((country) => country.code === e.target.value);
                updateField("countryCode", e.target.value);
                updateField("countryName", selected?.name || "");
                updateField("stateCode", "");
                updateField("stateName", "");
                updateField("city", "");
              }}
              required
              style={{ border: "1px solid #d1d5db", padding: "12px 14px", fontSize: "14px", borderRadius: "10px" }}
            >
              <option value="">{loadingCountries ? "Loading countries..." : "Select Country"}</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
            State
            <select
              value={form.stateCode}
              onChange={(e) => {
                const selected = states.find((state) => state.code === e.target.value);
                updateField("stateCode", e.target.value);
                updateField("stateName", selected?.name || "");
                updateField("city", "");
              }}
              required
              disabled={!form.countryCode || loadingStates}
              style={{ border: "1px solid #d1d5db", padding: "12px 14px", fontSize: "14px", borderRadius: "10px" }}
            >
              <option value="">
                {!form.countryCode ? "Select Country First" : loadingStates ? "Loading states..." : "Select State"}
              </option>
              {states.map((stateName) => (
                <option key={stateName.code} value={stateName.code}>
                  {stateName.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
            City
            <select
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              required
              disabled={!form.stateCode || loadingCities}
              style={{ border: "1px solid #d1d5db", padding: "12px 14px", fontSize: "14px", borderRadius: "10px" }}
            >
              <option value="">
                {!form.stateCode ? "Select State First" : loadingCities ? "Loading cities..." : "Select City"}
              </option>
              {cities.map((city) => (
                <option key={city.name} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
            Org Type
            <select
              value={form.orgType}
              onChange={(e) => updateField("orgType", e.target.value as OrgType)}
              style={{ border: "1px solid #d1d5db", padding: "12px 14px", fontSize: "14px", borderRadius: "10px" }}
            >
              <option value="PVT">Private</option>
              <option value="GOV">Government</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
            Sector
            <input
              type="text"
              value={form.sector}
              onChange={(e) => updateField("sector", e.target.value)}
              required
              style={{ border: "1px solid #d1d5db", padding: "12px 14px", fontSize: "14px", borderRadius: "10px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
            Domain
            <input
              type="text"
              value={form.domain}
              onChange={(e) => updateField("domain", e.target.value)}
              required
              style={{ border: "1px solid #d1d5db", padding: "12px 14px", fontSize: "14px", borderRadius: "10px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 600, gridColumn: "span 2" }}>
            Admin Email
            <input
              type="email"
              value={form.adminEmail}
              onChange={(e) => updateField("adminEmail", e.target.value)}
              required
              style={{ border: "1px solid #d1d5db", padding: "12px 14px", fontSize: "14px", borderRadius: "10px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 600, gridColumn: "span 2" }}>
            Mobile Number
            <input
              type="tel"
              value={form.adminPhone}
              onChange={(e) => updateField("adminPhone", e.target.value)}
              required
              pattern="^\+?[0-9]{8,15}$"
              placeholder="+919876543210"
              style={{ border: "1px solid #d1d5db", padding: "12px 14px", fontSize: "14px", borderRadius: "10px" }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "8px",
              border: "none",
              background: "linear-gradient(90deg, #111827 0%, #243042 100%)",
              color: "#fff",
              padding: "13px 14px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              gridColumn: "span 2",
              borderRadius: "10px"
            }}
          >
            {loading ? "Submitting..." : "Submit Application"}
          </button>
          </form>

          {message ? (
            <p
              style={{
                color: "#065f46",
                marginTop: "14px",
                fontSize: "14px",
                background: "#ecfdf5",
                border: "1px solid #86efac",
                padding: "10px 12px",
                borderRadius: "10px"
              }}
            >
              {message}
            </p>
          ) : null}
          {error ? (
            <p
              style={{
                color: "#b91c1c",
                marginTop: "14px",
                fontSize: "14px",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                padding: "10px 12px",
                borderRadius: "10px"
              }}
            >
              {error}
            </p>
          ) : null}

          <p style={{ marginTop: "16px", fontSize: "13px", color: "#4b5563" }}>
            Already onboarded? <Link href="/login">Go to login</Link>
          </p>
          <p style={{ marginTop: "8px", fontSize: "13px" }}>
            <Link href="/">Back to home</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
