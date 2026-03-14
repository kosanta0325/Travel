'use client';

import { useState } from 'react';

interface FlightInfo {
  date: string;
  time: string;
  from: string;
  to: string;
  flightNumber: string;
}

interface Attraction {
  name: string;
  url: string;
  rating: number | null;
  address: string;
  description: string;
}

interface HotelData {
  name: string;
  address: string;
  lat: number;
  lng: number;
  mapEmbedUrl: string;
  mapsLink: string;
}

interface ProcessResult {
  hotel: HotelData;
  attractions: Attraction[];
  arrival: FlightInfo;
  departure: FlightInfo;
}

interface DaySchedule {
  date: Date;
  dayNum: number;
  isArrivalDay: boolean;
  isDepartureDay: boolean;
  attractions: Attraction[];
  globalStartIndex: number;
}

function buildDaySchedule(
  attractions: Attraction[],
  arrival: FlightInfo,
  departure: FlightInfo
): DaySchedule[] {
  if (!arrival.date || !departure.date) {
    return [
      {
        date: new Date(),
        dayNum: 1,
        isArrivalDay: true,
        isDepartureDay: true,
        attractions,
        globalStartIndex: 0,
      },
    ];
  }

  const start = new Date(arrival.date);
  const end = new Date(departure.date);
  const totalDays = Math.max(
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    1
  );

  const arrivalHour = arrival.time ? parseInt(arrival.time.split(':')[0], 10) : 14;
  const departureHour = departure.time ? parseInt(departure.time.split(':')[0], 10) : 10;

  const slots: number[] = [];
  for (let i = 0; i < totalDays; i++) {
    if (i === 0) {
      if (arrivalHour >= 20) slots.push(0);
      else if (arrivalHour >= 17) slots.push(1);
      else if (arrivalHour >= 14) slots.push(2);
      else if (arrivalHour >= 10) slots.push(3);
      else slots.push(4);
    } else if (i === totalDays - 1) {
      if (departureHour <= 8) slots.push(0);
      else if (departureHour <= 11) slots.push(1);
      else if (departureHour <= 14) slots.push(2);
      else slots.push(3);
    } else {
      slots.push(4);
    }
  }

  const days: DaySchedule[] = [];
  let idx = 0;
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dayAttractions = attractions.slice(idx, idx + slots[i]);
    days.push({
      date,
      dayNum: i + 1,
      isArrivalDay: i === 0,
      isDepartureDay: i === totalDays - 1,
      attractions: dayAttractions,
      globalStartIndex: idx,
    });
    idx += slots[i];
  }

  return days;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  const filled = Math.round(rating);
  return (
    <span className="text-sm">
      <span className="text-yellow-500">{'★'.repeat(filled)}{'☆'.repeat(5 - filled)}</span>
      <span className="text-gray-400 ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

function AttractionCard({
  attraction,
  index,
}: {
  attraction: Attraction;
  index: number;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors">
      <span className="shrink-0 w-7 h-7 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{attraction.name}</p>
        <StarRating rating={attraction.rating} />
        {attraction.address && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{attraction.address}</p>
        )}
        {attraction.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{attraction.description}</p>
        )}
        {attraction.url && (
          <a
            href={attraction.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline mt-1 inline-block"
          >
            TripAdvisorで詳細を見る →
          </a>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [arrival, setArrival] = useState<FlightInfo>({
    date: '',
    time: '',
    from: '',
    to: '',
    flightNumber: '',
  });
  const [departure, setDeparture] = useState<FlightInfo>({
    date: '',
    time: '',
    from: '',
    to: '',
    flightNumber: '',
  });
  const [hotelAddress, setHotelAddress] = useState('');
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState('');

  const handleProcess = async () => {
    if (!hotelAddress.trim()) {
      setError('ホテルの住所を入力してください。');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arrival,
          departure,
          hotelAddress,
          keywords: keywords
            .split(/[、,]/)
            .map((k) => k.trim())
            .filter((k) => k.length > 0),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'エラーが発生しました');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const daySchedule = result
    ? buildDaySchedule(result.attractions, result.arrival, result.departure)
    : [];

  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent';
  const labelClass = 'block text-xs font-medium text-gray-600 mt-3';

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <h1 className="text-2xl md:text-3xl font-bold text-center text-blue-800 mb-6">
        旅行スケジュールプランナー
      </h1>

      {/* ── Top: Flight (left) + Hotel (right) ── */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        {/* Left: Flight Info */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          {/* Arrival */}
          <h2 className="text-base font-bold text-blue-700 flex items-center gap-2">
            <span>✈</span> 到着情報
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 mb-2">
            フライト情報の確認:{' '}
            <a
              href="https://www.google.com/travel/flights"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Google Flights
            </a>
          </p>

          <div className="grid grid-cols-2 gap-x-3">
            <div>
              <label className={labelClass}>出発地</label>
              <input
                type="text"
                className={inputClass}
                placeholder="例: 東京 HND"
                value={arrival.from}
                onChange={(e) => setArrival({ ...arrival, from: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>到着地</label>
              <input
                type="text"
                className={inputClass}
                placeholder="例: パリ CDG"
                value={arrival.to}
                onChange={(e) => setArrival({ ...arrival, to: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>到着日</label>
              <input
                type="date"
                className={inputClass}
                value={arrival.date}
                onChange={(e) => setArrival({ ...arrival, date: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>到着時刻（現地時間）</label>
              <input
                type="time"
                className={inputClass}
                value={arrival.time}
                onChange={(e) => setArrival({ ...arrival, time: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>便名</label>
              <input
                type="text"
                className={inputClass}
                placeholder="例: JL007"
                value={arrival.flightNumber}
                onChange={(e) => setArrival({ ...arrival, flightNumber: e.target.value })}
              />
            </div>
          </div>

          <hr className="my-4 border-gray-100" />

          {/* Departure */}
          <h2 className="text-base font-bold text-red-600 flex items-center gap-2 mb-1">
            <span>✈</span> 出発情報（帰国便）
          </h2>
          <div className="grid grid-cols-2 gap-x-3">
            <div>
              <label className={labelClass}>出発地</label>
              <input
                type="text"
                className={inputClass}
                placeholder="例: パリ CDG"
                value={departure.from}
                onChange={(e) => setDeparture({ ...departure, from: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>到着地</label>
              <input
                type="text"
                className={inputClass}
                placeholder="例: 東京 HND"
                value={departure.to}
                onChange={(e) => setDeparture({ ...departure, to: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>出発日</label>
              <input
                type="date"
                className={inputClass}
                value={departure.date}
                onChange={(e) => setDeparture({ ...departure, date: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>出発時刻（現地時間）</label>
              <input
                type="time"
                className={inputClass}
                value={departure.time}
                onChange={(e) => setDeparture({ ...departure, time: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>便名</label>
              <input
                type="text"
                className={inputClass}
                placeholder="例: JL008"
                value={departure.flightNumber}
                onChange={(e) => setDeparture({ ...departure, flightNumber: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Right: Hotel Info */}
        <div className="md:w-80 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-bold text-green-700 flex items-center gap-2 mb-3">
            <span>🏨</span> ホテル情報
          </h2>
          <label className="block text-xs font-medium text-gray-600">
            ホテルの住所（英語または現地語）
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent h-32 resize-none"
            placeholder={`例:\nHôtel de Crillon\n10 Place de la Concorde, Paris, France`}
            value={hotelAddress}
            onChange={(e) => setHotelAddress(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            Google Mapsで検索できる住所形式で入力してください。
          </p>

          {result && (
            <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs font-semibold text-green-800 mb-1">確認済み住所</p>
              <p className="text-xs text-gray-700">{result.hotel.name}</p>
              <a
                href={result.hotel.mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-blue-600 hover:underline"
              >
                Google Mapsで開く →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Middle: Process Button + Keywords ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <button
          onClick={handleProcess}
          disabled={loading}
          className="sm:shrink-0 px-10 py-3 bg-blue-600 text-white rounded-xl font-bold text-base hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              処理中...
            </>
          ) : (
            '処理'
          )}
        </button>

        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            キーワード（複数の場合は「、」または「,」で区切ってください）
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="例: 美術館、公園、歴史遺産、グルメ"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Bottom: Schedule ── */}
      {result && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xl font-bold text-gray-800 mb-5">日程表</h2>

          {/* Arrival Banner */}
          <div className="mb-5 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✈</span>
              <div>
                <p className="font-bold text-blue-800 text-sm">到着</p>
                <p className="text-gray-700 text-sm">
                  {formatDate(result.arrival.date)}
                  {result.arrival.time && ` ${result.arrival.time}`}
                  {result.arrival.from && ` ／ ${result.arrival.from}`}
                  {result.arrival.to && ` → ${result.arrival.to}`}
                  {result.arrival.flightNumber && ` （${result.arrival.flightNumber}）`}
                </p>
              </div>
            </div>
          </div>

          {/* Attractions + Hotel side by side */}
          <div className="flex gap-5">
            {/* Left: Attractions */}
            <div className="flex-1 min-w-0">
              {daySchedule.map((day) => (
                <div key={day.dayNum} className="mb-6">
                  {/* Day header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                      DAY {day.dayNum}
                    </span>
                    <span className="text-sm text-gray-500">
                      {day.date.toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </span>
                    {day.isArrivalDay && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                        到着日
                      </span>
                    )}
                    {day.isDepartureDay && !day.isArrivalDay && (
                      <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                        出発日
                      </span>
                    )}
                    {day.isArrivalDay && day.isDepartureDay && (
                      <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
                        日帰り
                      </span>
                    )}
                  </div>

                  {day.attractions.length === 0 ? (
                    <p className="text-sm text-gray-400 italic pl-2">
                      {day.isArrivalDay && !day.isDepartureDay
                        ? '到着後は空港移動・チェックインを推奨します。'
                        : day.isDepartureDay
                        ? '出発前の移動時間を確保してください。'
                        : '観光スポットがありません。'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {day.attractions.map((attraction, ai) => (
                        <AttractionCard
                          key={ai}
                          attraction={attraction}
                          index={day.globalStartIndex + ai + 1}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Fallback: no dates entered */}
              {!result.arrival.date && result.attractions.length > 0 && (
                <div className="space-y-2">
                  {result.attractions.map((attraction, i) => (
                    <AttractionCard key={i} attraction={attraction} index={i + 1} />
                  ))}
                </div>
              )}

              {result.attractions.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p>観光スポットが見つかりませんでした。</p>
                  <p className="text-xs mt-1">キーワードを変更してもう一度お試しください。</p>
                </div>
              )}
            </div>

            {/* Right: Hotel (sticky) */}
            <div className="w-64 shrink-0">
              <div className="sticky top-4 bg-green-50 border border-green-200 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-green-800 flex items-center gap-2 mb-3">
                  <span>🏨</span> ホテル
                </h3>
                <p className="text-sm font-semibold text-gray-800 leading-snug">
                  {result.hotel.name}
                </p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {result.hotel.address}
                </p>
                <a
                  href={result.hotel.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block text-center text-xs text-white bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg transition-colors font-medium"
                >
                  Google Mapsで開く
                </a>

                {/* Map Embed */}
                <div className="mt-3 rounded-lg overflow-hidden border border-green-200">
                  <iframe
                    src={result.hotel.mapEmbedUrl}
                    width="100%"
                    height="180"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="ホテル地図"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Departure Banner */}
          <div className="mt-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl inline-block" style={{ transform: 'scaleX(-1)' }}>
                ✈
              </span>
              <div>
                <p className="font-bold text-red-800 text-sm">出発（帰国）</p>
                <p className="text-gray-700 text-sm">
                  {formatDate(result.departure.date)}
                  {result.departure.time && ` ${result.departure.time}`}
                  {result.departure.from && ` ／ ${result.departure.from}`}
                  {result.departure.to && ` → ${result.departure.to}`}
                  {result.departure.flightNumber && ` （${result.departure.flightNumber}）`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
