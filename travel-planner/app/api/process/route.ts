import { NextRequest, NextResponse } from 'next/server';

interface FlightInfo {
  date: string;
  time: string;
  from: string;
  to: string;
  flightNumber: string;
}

interface RequestBody {
  arrival: FlightInfo;
  departure: FlightInfo;
  hotelAddress: string;
  keywords: string[];
}

interface TripAdvisorLocation {
  location_id: string;
  name: string;
}

interface TripAdvisorDetails {
  name?: string;
  web_url?: string;
  rating?: number;
  description?: string;
  address_obj?: {
    address_string?: string;
  };
}

async function getTripAdvisorDetails(
  locationId: string,
  apiKey: string
): Promise<(TripAdvisorDetails & { location_id: string }) | null> {
  try {
    const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/details?key=${apiKey}&language=ja`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return { ...data, location_id: locationId };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { arrival, departure, hotelAddress, keywords } = body;

    const googleMapsKey = process.env.GOOGLE_MAP;
    const tripAdvisorKey = process.env.TRIPADVISOR;

    if (!googleMapsKey || !tripAdvisorKey) {
      return NextResponse.json(
        { error: 'APIキーが設定されていません。Vercel環境変数を確認してください。' },
        { status: 500 }
      );
    }

    if (!hotelAddress.trim()) {
      return NextResponse.json(
        { error: 'ホテルの住所を入力してください。' },
        { status: 400 }
      );
    }

    // 1. Geocode hotel address with Google Maps
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(hotelAddress)}&key=${googleMapsKey}`;
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();

    if (!geocodeData.results || geocodeData.results.length === 0) {
      return NextResponse.json(
        { error: 'ホテルの住所が見つかりませんでした。住所を確認してください。' },
        { status: 400 }
      );
    }

    const location = geocodeData.results[0].geometry.location as {
      lat: number;
      lng: number;
    };
    const formattedAddress = geocodeData.results[0].formatted_address as string;
    const latLong = `${location.lat},${location.lng}`;

    // 2. Search TripAdvisor for nearby attractions
    let locationList: TripAdvisorLocation[] = [];

    if (keywords.length > 0) {
      // Search by each keyword and combine deduplicated results
      const searchPromises = keywords.map(async (keyword) => {
        const searchUrl = `https://api.content.tripadvisor.com/api/v1/location/search?searchQuery=${encodeURIComponent(keyword)}&latLong=${latLong}&category=attractions&language=ja&key=${tripAdvisorKey}`;
        const response = await fetch(searchUrl, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return [] as TripAdvisorLocation[];
        const data = await response.json();
        return (data.data || []) as TripAdvisorLocation[];
      });

      const results = await Promise.all(searchPromises);
      const combined = results.flat();

      const seen = new Set<string>();
      locationList = combined
        .filter((loc) => {
          if (seen.has(loc.location_id)) return false;
          seen.add(loc.location_id);
          return true;
        })
        .slice(0, 20);

      // Fallback to nearby search if no keyword results
      if (locationList.length === 0) {
        const nearbyUrl = `https://api.content.tripadvisor.com/api/v1/location/nearby_search?latLong=${latLong}&key=${tripAdvisorKey}&category=attractions&language=ja&radius=5&radiusUnit=km`;
        const nearbyResponse = await fetch(nearbyUrl, {
          headers: { Accept: 'application/json' },
        });
        const nearbyData = await nearbyResponse.json();
        locationList = ((nearbyData.data || []) as TripAdvisorLocation[]).slice(0, 20);
      }
    } else {
      // Nearby search
      const nearbyUrl = `https://api.content.tripadvisor.com/api/v1/location/nearby_search?latLong=${latLong}&key=${tripAdvisorKey}&category=attractions&language=ja&radius=5&radiusUnit=km`;
      const nearbyResponse = await fetch(nearbyUrl, {
        headers: { Accept: 'application/json' },
      });
      const nearbyData = await nearbyResponse.json();
      locationList = ((nearbyData.data || []) as TripAdvisorLocation[]).slice(0, 20);
    }

    // 3. Fetch details in parallel (up to 15 to get enough results)
    const detailsPromises = locationList.slice(0, 15).map((loc) =>
      getTripAdvisorDetails(loc.location_id, tripAdvisorKey).then((details) => ({
        name: details?.name || loc.name,
        web_url: details?.web_url || '',
        rating: details?.rating ?? null,
        address: details?.address_obj?.address_string || '',
        description: details?.description || '',
        location_id: loc.location_id,
      }))
    );

    const detailsResults = await Promise.all(detailsPromises);

    const attractions = detailsResults
      .filter((d) => d !== null)
      .slice(0, 10)
      .map((d) => ({
        name: d.name,
        url: d.web_url,
        rating: d.rating,
        address: d.address,
        description: d.description,
      }));

    // Google Maps embed URL (key stays server-side, returned as data for iframe)
    const mapEmbedUrl = `https://www.google.com/maps/embed/v1/place?key=${googleMapsKey}&q=${encodeURIComponent(hotelAddress)}&zoom=15`;

    return NextResponse.json({
      hotel: {
        name: formattedAddress,
        address: hotelAddress,
        lat: location.lat,
        lng: location.lng,
        mapEmbedUrl,
        mapsLink: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelAddress)}`,
      },
      attractions,
      arrival,
      departure,
    });
  } catch (error) {
    console.error('Process error:', error);
    return NextResponse.json(
      { error: '処理中にエラーが発生しました。もう一度お試しください。' },
      { status: 500 }
    );
  }
}
