"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base";

const API_BASE_URL = getApiBaseUrl();

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
    organizationCategory: "education" as
      | "education"
      | "healthcare"
      | "corporate"
      | "government"
      | "nonprofit"
      | "other",
    domain: "",
    adminEmail: "",
    adminPassword: "",
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
      setMessage(`Application submitted. Org ID: ${data?.orgId || "N/A"}. You can now login with your email and password.`);
    } catch {
      setError("Could not reach backend API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#05070d", padding: "20px" }}>
      <section style={{ width: "100%", maxWidth: "1040px", margin: "0 auto", border: "3px solid #f8fafc", background: "#0b1220", padding: "28px", boxShadow: "14px 14px 0 #1e293b" }}>
        <p style={{ margin: 0, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.18em", fontSize: "11px" }}>organization onboarding</p>
        <h1 style={{ margin: "10px 0 8px", color: "#f8fafc" }}>Create organization account</h1>
        <p style={{ marginTop: 0, color: "#9fb0c5" }}>Submit details for review and issue verifiable certificates once approved.</p>

          <form
            onSubmit={onSubmit}
            style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
          >
          <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cbd5e1", gridColumn: "1 / -1" }}>
            Organization Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
              style={{ border: "2px solid #f8fafc", padding: "12px 14px", fontSize: "14px", background: "#05070d", color: "#e2e8f0" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cbd5e1" }}>
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
              style={{ border: "2px solid #f8fafc", padding: "12px 14px", fontSize: "14px", background: "#05070d", color: "#e2e8f0" }}
            >
              <option value="">{loadingCountries ? "Loading countries..." : "Select Country"}</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cbd5e1" }}>
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
              style={{ border: "2px solid #f8fafc", padding: "12px 14px", fontSize: "14px", background: "#05070d", color: "#e2e8f0" }}
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

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cbd5e1" }}>
            City
            <select
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              required
              disabled={!form.stateCode || loadingCities}
              style={{ border: "2px solid #f8fafc", padding: "12px 14px", fontSize: "14px", background: "#05070d", color: "#e2e8f0" }}
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

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cbd5e1", gridColumn: "1 / -1" }}>
            Organization focus (drives certificate types you can issue)
            <select
              value={form.organizationCategory}
              onChange={(e) =>
                updateField(
                  "organizationCategory",
                  e.target.value as typeof form.organizationCategory
                )
              }
              required
              style={{ border: "2px solid #f8fafc", padding: "12px 14px", fontSize: "14px", background: "#05070d", color: "#e2e8f0" }}
            >
              <option value="education">Education (schools, colleges, universities)</option>
              <option value="healthcare">Healthcare (hospitals, clinics)</option>
              <option value="corporate">Corporate (employers, enterprises)</option>
              <option value="government">Government / public sector</option>
              <option value="nonprofit">Nonprofit / NGO</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cbd5e1" }}>
            Org Type
            <select
              value={form.orgType}
              onChange={(e) => updateField("orgType", e.target.value as OrgType)}
              style={{ border: "2px solid #f8fafc", padding: "12px 14px", fontSize: "14px", background: "#05070d", color: "#e2e8f0" }}
            >
              <option value="PVT">Private</option>
              <option value="GOV">Government</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cbd5e1" }}>
            Sector
            <input
              type="text"
              value={form.sector}
              onChange={(e) => updateField("sector", e.target.value)}
              required
              style={{ border: "2px solid #f8fafc", padding: "12px 14px", fontSize: "14px", background: "#05070d", color: "#e2e8f0" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cbd5e1" }}>
            Domain
            <input
              type="text"
              value={form.domain}
              onChange={(e) => updateField("domain", e.target.value)}
              required
              style={{ border: "2px solid #f8fafc", padding: "12px 14px", fontSize: "14px", background: "#05070d", color: "#e2e8f0" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cbd5e1", gridColumn: "1 / -1" }}>
            Admin Email
            <input
              type="email"
              value={form.adminEmail}
              onChange={(e) => updateField("adminEmail", e.target.value)}
              required
              style={{ border: "2px solid #f8fafc", padding: "12px 14px", fontSize: "14px", background: "#05070d", color: "#e2e8f0" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cbd5e1", gridColumn: "1 / -1" }}>
            Admin Password
            <input
              type="password"
              value={form.adminPassword}
              onChange={(e) => updateField("adminPassword", e.target.value)}
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              style={{ border: "2px solid #f8fafc", padding: "12px 14px", fontSize: "14px", background: "#05070d", color: "#e2e8f0" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cbd5e1", gridColumn: "1 / -1" }}>
            Mobile Number
            <input
              type="tel"
              value={form.adminPhone}
              onChange={(e) => updateField("adminPhone", e.target.value)}
              required
              pattern="^\+?[0-9]{8,15}$"
              placeholder="+919876543210"
              style={{ border: "1px solid #334155", padding: "12px 14px", fontSize: "14px", borderRadius: "10px", background: "#09101c", color: "#e2e8f0" }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "8px",
              border: "none",
              background: "#f8fafc",
              color: "#020617",
              padding: "13px 14px",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              gridColumn: "1 / -1",
              borderRadius: "10px"
            }}
          >
            {loading ? "Submitting..." : "Submit Application"}
          </button>
          </form>

          {message ? (
            <p
              style={{
                color: "#4ade80",
                marginTop: "14px",
                fontSize: "14px",
                background: "#072112",
                border: "1px solid #14532d",
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
                color: "#fda4af",
                marginTop: "14px",
                fontSize: "14px",
                background: "#2a0b13",
                border: "1px solid #7f1d1d",
                padding: "10px 12px",
                borderRadius: "10px"
              }}
            >
              {error}
            </p>
          ) : null}

          <p style={{ marginTop: "16px", fontSize: "13px", color: "#cbd5e1" }}>
            Already onboarded? <Link href="/login">Go to login</Link>
          </p>
          <p style={{ marginTop: "8px", fontSize: "13px" }}>
            <Link href="/">Back to home</Link>
          </p>
      </section>
    </main>
  );
}
