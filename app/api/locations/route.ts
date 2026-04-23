import { City, Country, State } from "country-state-city";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const countryCode = (url.searchParams.get("countryCode") || "").toUpperCase();
  const stateCode = (url.searchParams.get("stateCode") || "").toUpperCase();

  if (!countryCode) {
    const countries = Country.getAllCountries().map((country) => ({
      code: country.isoCode,
      name: country.name
    }));
    return NextResponse.json({ countries });
  }

  if (countryCode && !stateCode) {
    const states = State.getStatesOfCountry(countryCode).map((state) => ({
      code: state.isoCode,
      name: state.name
    }));
    return NextResponse.json({ states });
  }

  const cities = City.getCitiesOfState(countryCode, stateCode).map((city) => ({
    name: city.name
  }));
  return NextResponse.json({ cities });
}
