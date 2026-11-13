// time/ — zonnestand voor Gouda (NOAA-benadering): hoogte en kompasrichting.

export const GOUDA = { lat: 52.011, lon: 4.711 };

export function sunPosition(date, { lat, lon } = GOUDA) {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const doy = Math.floor((date - start) / 86400000);
  const hr = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const g = 2 * Math.PI / 365 * (doy - 1 + (hr - 12) / 24);
  const decl = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g) - .006758 * Math.cos(2 * g) + .000907 * Math.sin(2 * g) - .002697 * Math.cos(3 * g) + .00148 * Math.sin(3 * g);
  const eqt = 229.18 * (.000075 + .001868 * Math.cos(g) - .032077 * Math.sin(g) - .014615 * Math.cos(2 * g) - .040849 * Math.sin(2 * g));
  const tst = hr * 60 + eqt + 4 * lon;
  const ha = (tst / 4 - 180) * rad, la = lat * rad;
  const cz = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.min(1, Math.max(-1, cz)));
  // kompasrichting: 90 = oost, 180 = zuid, 270 = west
  const az = (Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(decl) * Math.cos(la)) / rad + 180 + 360) % 360;
  return { elev: 90 - zen / rad, az, morning: ha < 0 };
}
