import { divIcon } from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { formatCurrency, formatPercent, formatQuotas } from "../lib/formatters.js";
import { StatusBadge } from "./StatusBadge.jsx";

function FitBounds({ markers }) {
  const map = useMap();

  useEffect(() => {
    if (!markers.length) {
      return;
    }

    const bounds = markers.map((marker) => [marker.latitud, marker.longitud]);
    map.fitBounds(bounds, { padding: [36, 36] });
  }, [map, markers]);

  return null;
}

function createMarkerIcon(marker) {
  const statusClass =
    marker.status === "Al día"
      ? "map-marker-green"
      : marker.status === "Adelantado"
        ? "map-marker-blue"
        : marker.status === "Parcial"
          ? "map-marker-yellow"
          : marker.status === "Sin firma"
            ? "map-marker-gray"
            : "map-marker-red";

  return divIcon({
    className: "custom-marker-wrapper",
    html: `<div class="map-marker ${statusClass}">${marker.markerLabel}</div>`,
    iconSize: [54, 30],
    iconAnchor: [27, 15],
  });
}

export function MapView({ markers, streetSummary, paymentState }) {
  return (
    <section className="map-stage">
      <MapContainer
        center={[-33.477, -70.732]}
        zoom={18}
        minZoom={17}
        maxZoom={21}
        scrollWheelZoom
        className="map-canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers.map((marker) => (
          <Marker
            key={marker.vecinoId}
            position={[marker.latitud, marker.longitud]}
            icon={createMarkerIcon(marker)}
          >
            <Popup minWidth={280}>
              <div className="popup-card">
                <h3>{marker.popup.direccion}</h3>
                <StatusBadge value={marker.status} />
                <dl>
                  <div>
                    <dt>Representante</dt>
                    <dd>{marker.popup.representanteNombre}</dd>
                  </div>
                  <div>
                    <dt>Teléfono</dt>
                    <dd>{marker.popup.telefono || "Sin teléfono"}</dd>
                  </div>
                  <div>
                    <dt>Firma</dt>
                    <dd>{marker.popup.firmaVobo}</dd>
                  </div>
                  <div>
                    <dt>Portones</dt>
                    <dd>
                      {formatQuotas(marker.popup.portones.equivalentQuotas)} cuotas equivalentes
                    </dd>
                  </div>
                  <div>
                    <dt>Mantención</dt>
                    <dd>
                      {formatQuotas(marker.popup.mantencion.equivalentQuotas)} cuotas equivalentes
                    </dd>
                  </div>
                  <div>
                    <dt>Saldo pendiente</dt>
                    <dd>{formatCurrency(marker.popup.totalPending)}</dd>
                  </div>
                  <div>
                    <dt>Total abonado</dt>
                    <dd>{formatCurrency(marker.popup.totalCollected)}</dd>
                  </div>
                </dl>
              </div>
            </Popup>
          </Marker>
        ))}

        <FitBounds markers={markers} />
      </MapContainer>

      <aside className="floating-card floating-top-right">
        <div className="card-heading">
          <p className="eyebrow">Mapa</p>
          <h2>Resumen por calle</h2>
        </div>

        <div className="street-summary-list">
          {streetSummary.map((street) => (
            <article key={street.pasaje} className="street-row">
              <div>
                <strong>{street.pasaje}</strong>
                <span>{street.totalDirecciones} direcciones</span>
              </div>
              <div className="street-metrics">
                <span>Firmas SI: {street.firmasSi}</span>
                <span>Firmas NO: {street.firmasNo}</span>
                <span>P: {formatQuotas(street.promedioCuotasPortones)}</span>
                <span>M: {formatQuotas(street.promedioCuotasMantencion)}</span>
                <span>{formatCurrency(street.totalRecaudado)}</span>
                <span>{formatPercent(street.porcentajeAvance)}</span>
              </div>
            </article>
          ))}
        </div>
      </aside>

      <aside className="floating-card floating-bottom-left">
        <div className="card-heading">
          <p className="eyebrow">Comunidad</p>
          <h2>Estado de pagos</h2>
        </div>

        <div className="summary-grid">
          <div>
            <span>Total direcciones</span>
            <strong>{paymentState.totalDirecciones}</strong>
          </div>
          <div>
            <span>Portones</span>
            <strong>{formatCurrency(paymentState.totalRecaudadoPortones)}</strong>
          </div>
          <div>
            <span>Mantención</span>
            <strong>{formatCurrency(paymentState.totalRecaudadoMantencion)}</strong>
          </div>
          <div>
            <span>Vecinos al día</span>
            <strong>{paymentState.vecinosAlDia}</strong>
          </div>
          <div>
            <span>Vecinos atrasados</span>
            <strong>{paymentState.vecinosAtrasados}</strong>
          </div>
          <div>
            <span>Sin firma</span>
            <strong>{paymentState.vecinosSinFirma}</strong>
          </div>
          <div>
            <span>% avance</span>
            <strong>{formatPercent(paymentState.porcentajeAvance)}</strong>
          </div>
        </div>
      </aside>
    </section>
  );
}

