/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AdvancedMarker,
  APILoadingStatus,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { ArrowRight, Clock, Compass, MapPin, Navigation, Search, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useMapsApiKey } from '../hooks/useMapsApiKey';

interface KitchenHub {
  id: string;
  name: string;
  city: string;
  address: string;
  capacityLabel: string;
  position: google.maps.LatLngLiteral;
}

// Verified CaterEase-owned kitchen hub locations
const CATEREASE_HUBS: KitchenHub[] = [
  {
    id: 'mumbai-bkc',
    name: 'CaterEase Flagship Commissary — BKC',
    city: 'Mumbai',
    address: 'Culinary Guild House, Bandra Kurla Complex, Mumbai 400051',
    capacityLabel: 'Up to 3,500 plates / shift',
    position: { lat: 19.0653, lng: 72.868 },
  },
  {
    id: 'bengaluru-indiranagar',
    name: 'CaterEase South Culinary Hub — Indiranagar',
    city: 'Bengaluru',
    address: '100 Feet Road Hospitality Park, Indiranagar, Bengaluru 560038',
    capacityLabel: 'Up to 2,200 plates / shift',
    position: { lat: 12.9784, lng: 77.6408 },
  },
  {
    id: 'delhi-aerocity',
    name: 'CaterEase NCR Kitchen Studio — Aerocity',
    city: 'New Delhi',
    address: 'Hospitality District Block C, Aerocity, New Delhi 110037',
    capacityLabel: 'Up to 3,000 plates / shift',
    position: { lat: 28.5504, lng: 77.1213 },
  },
];

interface SelectedVenue {
  name: string;
  formattedAddress: string;
  position: google.maps.LatLngLiteral;
  placeId?: string;
}

interface RouteSummary {
  distanceKm: string;
  durationLabel: string;
  hubName: string;
}

function isQuotaError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return (
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('429') ||
    text.includes('Quota')
  );
}

function HubMarker({
  hub,
  isSelected,
  onSelect,
}: {
  hub: KitchenHub;
  isSelected: boolean;
  onSelect: (hub: KitchenHub, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  return (
    <AdvancedMarker
      ref={markerRef}
      position={hub.position}
      title={hub.name}
      onClick={() => onSelect(hub, marker)}
    >
      <Pin
        background={isSelected ? '#b45309' : '#1c1917'}
        borderColor={isSelected ? '#fbbf24' : '#f59e0b'}
        glyphColor="#ffffff"
      />
    </AdvancedMarker>
  );
}

function RoutePolylineController({
  origin,
  destination,
  onRouteComputed,
}: {
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral | null;
  onRouteComputed: (summary: RouteSummary | null) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    // Clean up previous route polylines cleanly
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || !routesLib || !destination) {
      onRouteComputed(null);
      return;
    }

    let cancelled = false;
    const request: google.maps.routes.ComputeRoutesRequest = {
      origin,
      destination,
      travelMode: routesLib.TravelMode.DRIVING,
      fields: ['durationMillis', 'distanceMeters', 'path', 'viewport', 'localizedValues'],
    };

    routesLib.Route.computeRoutes(request)
      .then((response) => {
        if (cancelled) return;
        const route = response.routes?.[0];
        if (!route) {
          onRouteComputed(null);
          return;
        }
        const created = route.createPolylines({
          polylineOptions: {
            strokeColor: '#b45309',
            strokeOpacity: 0.92,
            strokeWeight: 5,
          },
        });
        created.forEach((poly: google.maps.Polyline) => poly.setMap(map));
        polylinesRef.current = created;

        if (route.viewport) {
          map.fitBounds(route.viewport, 60);
        }

        const km =
          typeof route.distanceMeters === 'number'
            ? `${(route.distanceMeters / 1000).toFixed(1)} km`
            : route.localizedValues?.distance || '—';
        const mins =
          typeof route.durationMillis === 'number' && Number.isFinite(route.durationMillis)
            ? `${Math.max(1, Math.round(route.durationMillis / 60000))} min`
            : route.localizedValues?.duration || '—';

        onRouteComputed({
          distanceKm: km,
          durationLabel: mins,
          hubName: '',
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        toast.error('Unable to compute dispatch route right now.');
        onRouteComputed(null);
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, origin, destination, onRouteComputed]);

  return null;
}

function VenueMapContent({ onUseVenueInCheckout }: { onUseVenueInCheckout: (address: string) => void }) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const status = useApiLoadingStatus();

  const [selectedHub, setSelectedHub] = useState<KitchenHub>(CATEREASE_HUBS[0]);
  const [infoHub, setInfoHub] = useState<{
    hub: KitchenHub;
    anchor: google.maps.marker.AdvancedMarkerElement;
  } | null>(null);

  const [queryText, setQueryText] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<SelectedVenue | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [status]);

  useEffect(() => {
    if (!placesLib || !queryText.trim() || queryText.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: queryText.trim(),
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['in'],
        });
        if (!cancelled) {
          setSuggestions(res.suggestions || []);
        }
      } catch (err) {
        if (!cancelled) {
          if (isQuotaError(err)) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, queryText]);

  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
      });
      const loc = place.location;
      if (!loc) {
        toast.error('No coordinates found for the selected venue.');
        return;
      }
      const pos = { lat: loc.lat(), lng: loc.lng() };
      const venue: SelectedVenue = {
        name: place.displayName || suggestion.placePrediction.text.text,
        formattedAddress: place.formattedAddress || suggestion.placePrediction.text.text,
        position: pos,
        placeId: place.id,
      };
      setSelectedVenue(venue);
      setQueryText(venue.formattedAddress);
      setSuggestions([]);
      sessionTokenRef.current = null;

      if (map && place.viewport) {
        map.fitBounds(place.viewport);
      } else if (map) {
        map.panTo(pos);
        map.setZoom(14);
      }
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      toast.error('Failed to load place details.');
    }
  };

  const handleSelectHub = useCallback(
    (hub: KitchenHub, marker: google.maps.marker.AdvancedMarkerElement | null) => {
      setSelectedHub(hub);
      if (marker) {
        setInfoHub({ hub, anchor: marker });
      }
      if (map) {
        map.panTo(hub.position);
        map.setZoom(12);
      }
    },
    [map]
  );

  const handleRouteResult = useCallback(
    (summary: RouteSummary | null) => {
      setRouteSummary(summary ? { ...summary, hubName: selectedHub.name } : null);
    },
    [selectedHub.name]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left Sidebar: Hub Selector, Autocomplete Search & Dispatch Estimate */}
      <div className="lg:col-span-4 space-y-5">
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4">
          <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
            1. Select Nearest Kitchen Hub
          </h2>
          <div className="space-y-2">
            {CATEREASE_HUBS.map((hub) => {
              const active = selectedHub.id === hub.id;
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => handleSelectHub(hub, null)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                    active
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-700 text-stone-900 dark:text-stone-100'
                      : 'bg-stone-50 dark:bg-stone-950 border-stone-200 dark:border-stone-800 hover:border-amber-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-400">{hub.city}</span>
                    <span className="text-[11px] font-mono text-stone-500">{hub.capacityLabel}</span>
                  </div>
                  <div className="text-sm font-semibold mt-0.5">{hub.name}</div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">{hub.address}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-3">
          <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
            2. Search Your Event Venue
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search banquet hall, hotel, or address..."
              aria-label="Search event venue with Google Places"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
            {searching && (
              <span className="text-[11px] text-stone-400 mt-1 block">Fetching suggestions...</span>
            )}
            {suggestions.length > 0 && (
              <ul className="mt-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 divide-y divide-stone-100 dark:divide-stone-800 max-h-56 overflow-y-auto shadow-lg">
                {suggestions.map((sug, idx) => (
                  <li key={sug.placePrediction?.placeId || idx}>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(sug)}
                      className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-stone-50 dark:hover:bg-stone-900 flex items-start gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <span>{sug.placePrediction?.text.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedVenue && (
            <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
              <div>
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-400">Selected Venue</div>
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-0.5">{selectedVenue.name}</div>
                <div className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">{selectedVenue.formattedAddress}</div>
              </div>

              {routeSummary && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/70 dark:border-amber-800/70">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Truck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="font-semibold tabular-nums">{routeSummary.distanceKm}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="font-semibold tabular-nums">{routeSummary.durationLabel} drive</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => onUseVenueInCheckout(selectedVenue.formattedAddress)}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                Use Venue in Event Booking <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Interactive Map Container (Explicitly Sized per CF2) */}
      <div className="lg:col-span-8">
        <div className="w-full h-[540px] lg:h-[640px] rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900">
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={CATEREASE_HUBS[0].position}
            defaultZoom={11}
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            {CATEREASE_HUBS.map((hub) => (
              <HubMarker
                key={hub.id}
                hub={hub}
                isSelected={selectedHub.id === hub.id}
                onSelect={handleSelectHub}
              />
            ))}

            {selectedVenue && (
              <AdvancedMarker position={selectedVenue.position} title={selectedVenue.name}>
                <Pin background="#0f766e" borderColor="#99f6e4" glyphColor="#ffffff" />
              </AdvancedMarker>
            )}

            {infoHub && (
              <InfoWindow
                anchor={infoHub.anchor}
                pixelOffset={[0, -4]}
                onCloseClick={() => setInfoHub(null)}
              >
                <div className="p-1 text-stone-900 max-w-[220px]">
                  <div className="text-xs font-bold">{infoHub.hub.name}</div>
                  <div className="text-[11px] text-stone-600 mt-1">{infoHub.hub.address}</div>
                  <div className="text-[11px] font-medium text-amber-800 mt-1">{infoHub.hub.capacityLabel}</div>
                </div>
              </InfoWindow>
            )}

            <RoutePolylineController
              origin={selectedHub.position}
              destination={selectedVenue?.position || null}
              onRouteComputed={handleRouteResult}
            />
          </GoogleMap>
        </div>
      </div>
    </div>
  );
}

export function VenueMapPage() {
  const navigate = useNavigate();
  const { apiKey, loading } = useMapsApiKey();
  const [manualFallbackQuery, setManualFallbackQuery] = useState('');

  const libraries = useMemo(() => ['places', 'routes', 'marker'], []);

  const handleUseVenue = (address: string) => {
    sessionStorage.setItem('caterease_selected_venue', address);
    toast.success('Event venue saved for checkout.');
    navigate('/checkout');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-8 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-amber-800 dark:text-amber-400 inline-flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" /> Google Maps Platform · Places API &amp; Routes API
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100">
            Kitchen Hubs &amp; Venue Dispatch Planner
          </h1>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 max-w-2xl">
            Inspect our Mumbai, Bengaluru, and Delhi NCR commissaries, search any banquet venue, and preview live road distance and hot-box dispatch transit times.
          </p>
        </div>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="h-[540px] rounded-2xl bg-stone-200/70 dark:bg-stone-800/70 animate-pulse" />
        ) : !apiKey ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-5">
            <div className="flex items-start gap-3">
              <Navigation className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                  Google Maps Key Not Active in Local Environment
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
                  Ensure Google Maps is enabled in AI Studio or set <code className="font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</code> in the environment Secrets panel to render the interactive map, Places Autocomplete, and Routes dispatch line.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CATEREASE_HUBS.map((h) => (
                <div key={h.id} className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                  <div className="text-xs font-semibold text-amber-800 dark:text-amber-400">{h.city}</div>
                  <div className="font-semibold text-sm mt-1">{h.name}</div>
                  <p className="text-xs text-stone-500 mt-1">{h.address}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-2">
              <input
                type="text"
                value={manualFallbackQuery}
                onChange={(e) => setManualFallbackQuery(e.target.value)}
                placeholder="Or enter venue address manually to prefill checkout..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 text-sm"
              />
              <button
                type="button"
                disabled={!manualFallbackQuery.trim()}
                onClick={() => handleUseVenue(manualFallbackQuery.trim())}
                className="px-4 py-2.5 rounded-xl bg-amber-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                Use Address
              </button>
            </div>
          </div>
        ) : (
          <APIProvider apiKey={apiKey} libraries={libraries} language="en" region="IN">
            <VenueMapContent onUseVenueInCheckout={handleUseVenue} />
          </APIProvider>
        )}
      </div>
    </div>
  );
}
