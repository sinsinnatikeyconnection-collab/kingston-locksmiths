// Service-area catalog with approximate lat/lng for the interactive map.
export interface ServiceCity { name: string; lat: number; lng: number }
export interface ServiceRegion {
  name: string;
  note: string;
  center: [number, number];
  cities: ServiceCity[];
}

export const SERVICE_REGIONS: ServiceRegion[] = [
  {
    name: "Cincinnati, OH",
    note: "Home base — full mobile + shop service across the city and metro.",
    center: [39.1271, -84.5144],
    cities: [
      { name: "Downtown Cincinnati", lat: 39.1015, lng: -84.5120 },
      { name: "Clifton", lat: 39.1415, lng: -84.5220 },
      { name: "Hyde Park", lat: 39.1389, lng: -84.4450 },
      { name: "Oakley", lat: 39.1598, lng: -84.4250 },
      { name: "Mount Adams", lat: 39.1128, lng: -84.4940 },
      { name: "West Side", lat: 39.1070, lng: -84.6200 },
      { name: "Northern Hills", lat: 39.2420, lng: -84.4700 },
    ],
  },
  {
    name: "Northern Kentucky",
    note: "Rapid mobile dispatch across the river for keys, lockouts & diagnostics.",
    center: [39.05, -84.55],
    cities: [
      { name: "Covington", lat: 39.0835, lng: -84.5085 },
      { name: "Newport", lat: 39.0910, lng: -84.4940 },
      { name: "Florence", lat: 38.9999, lng: -84.6266 },
      { name: "Fort Thomas", lat: 39.0770, lng: -84.4590 },
      { name: "Erlanger", lat: 39.0168, lng: -84.5894 },
      { name: "Highland Heights", lat: 39.0412, lng: -84.4540 },
      { name: "Burlington", lat: 39.0751, lng: -84.7233 },
    ],
  },
  {
    name: "Dayton, OH",
    note: "Scheduled and emergency service for the Dayton corridor.",
    center: [39.715, -84.15],
    cities: [
      { name: "Dayton", lat: 39.7589, lng: -84.1916 },
      { name: "Kettering", lat: 39.6987, lng: -84.168 },
      { name: "Beavercreek", lat: 39.7437, lng: -84.0744 },
      { name: "Centerville", lat: 39.6309, lng: -84.1566 },
      { name: "Huber Heights", lat: 39.8589, lng: -84.1249 },
      { name: "Miamisburg", lat: 39.6095, lng: -84.2811 },
    ],
  },
  {
    name: "Tri-State Outskirts",
    note: "Broader tri-state coverage for mobile emergency and heavy jobs.",
    center: [39.4, -84.45],
    cities: [
      { name: "Hamilton", lat: 39.4045, lng: -84.5599 },
      { name: "Middletown", lat: 39.5151, lng: -84.3983 },
      { name: "Lebanon", lat: 39.4387, lng: -84.1999 },
      { name: "Mason", lat: 39.3601, lng: -84.3097 },
      { name: "West Chester", lat: 39.3215, lng: -84.445 },
      { name: "Fairfield", lat: 39.3345, lng: -84.5599 },
      { name: "Lawrenceburg, IN", lat: 39.0928, lng: -84.8527 },
    ],
  },
];