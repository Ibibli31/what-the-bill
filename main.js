const OTTAWA = { lat: 45.4215, lng: -75.6972 };

const MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#4a4a4a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#ececec" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#4a4a4a" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ visibility: "on" }, { color: "#3e463e" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#a3a3a3" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#b5b5b5" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#c8c8c8" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f2f2f2" }],
  },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#555555" }],
  },
];

let map;
let marker;

function showMapMessage(text) {
  let message = document.getElementById("map-message");
  if (!message) {
    const mapEl = document.getElementById("map");
    mapEl.replaceChildren();
    message = document.createElement("p");
    message.id = "map-message";
    message.className = "map-message";
    mapEl.appendChild(message);
  }
  message.hidden = false;
  message.textContent = text;
}

function initMap() {
  document.getElementById("map-message").hidden = true;
  map = new google.maps.Map(document.getElementById("map"), {
    center: OTTAWA,
    zoom: 12,
    styles: MAP_STYLES,
    disableDefaultUI: true,
    backgroundColor: "#4a4a4a",
    clickableIcons: false,
    gestureHandling: "cooperative",
  });
}

function searchLocation(query) {
  const status = document.getElementById("location-status");

  if (!map || !window.google || !google.maps) {
    status.textContent = "The map is not ready yet.";
    return;
  }

  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: query, region: "ca" }, (results, code) => {
    if (code !== "OK" || !results || !results[0]) {
      status.textContent = "No results for that location.";
      return;
    }

    status.textContent = "";
    const location = results[0].geometry.location;
    map.panTo(location);
    map.setZoom(14);

    if (!marker) {
      marker = new google.maps.Marker({ map });
    }
    marker.setPosition(location);
  });
}

window.wtbInitMap = initMap;

window.gm_authFailure = function () {
  showMapMessage("Google Maps could not start. Check the API key in config.js.");
};

const learnButton = document.querySelector(".learn-more");
const learnPanel = document.getElementById("learn-panel");

function setLearnPanelOpen(open) {
  learnPanel.hidden = !open;
  learnButton.setAttribute("aria-expanded", open ? "true" : "false");
}

learnButton.addEventListener("click", () => {
  setLearnPanelOpen(learnPanel.hidden);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setLearnPanelOpen(false);
});

document.getElementById("location-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = document.getElementById("location").value.trim();
  if (!query) return;
  searchLocation(query);
});

const mapsKey = (window.WTB_MAPS_API_KEY || "").trim();

if (mapsKey) {
  const script = document.createElement("script");
  script.src =
    "https://maps.googleapis.com/maps/api/js?key=" +
    encodeURIComponent(mapsKey) +
    "&loading=async&callback=wtbInitMap&v=weekly";
  script.async = true;
  script.onerror = () => showMapMessage("Google Maps failed to load.");
  document.head.appendChild(script);
}
