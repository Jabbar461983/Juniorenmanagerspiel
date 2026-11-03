import { useState } from 'react';
import {
  ANWERBUNG,
  B,
  KATEGORIE_NAMEN,
  STUFEN,
  aktiveKinder,
  beitraegeAenderbar,
  chf,
  jahresbeitrag,
  type Buchung,
  type Niveau,
  type Stufe
} from '../../engine';
import { Badge, Karte } from '../components/Basis';
import type { SpielApi } from '../useSpiel';

const NIVEAUS: { id: Niveau; name: string }[] = [
  { id: 'tief', name: 'tief' },
  { id: 'mittel', name: 'mittel' },
  { id: 'hoch', name: 'hoch' }
];

function summen(buchungen: Buchung[]): [Buchung['kategorie'], number][] {
  const m = new Map<Buchung['kategorie'], number>();
  for (const b of buchungen) m.set(b.kategorie, (m.get(b.kategorie) ?? 0) + b.betrag);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function Finanzen({ spiel }: { spiel: SpielApi }) {
  const s = spiel.ansicht!;
  const f = s.finanzen;
  const aenderbar = beitraegeAenderbar(spiel.stand!.state);
  const [zielStufe, setZielStufe] = useState<Stufe>('U9');
  const saisonBuchungen = spiel.stand!.state.finanzen.buchungen.filter((b) => b.saison === s.saison);
  const letzteWoche = saisonBuchungen.filter((b) => b.woche === s.woche - 1);
  const geplant = spiel.stand!.entwurf.map((e, i) => ({ e, i })).filter((x) => x.e.typ === 'anwerbung');
  const jahresertrag = aktiveKinder(s).reduce((a, k) => a + jahresbeitrag(s, k), 0);

  return (
    <div className="stapel">
      <div className="kennzahlen">
        <div className={`kennzahl ${f.kasse < 0 ? 'ton-schlecht' : ''}`}>
          <div className="kennzahl-label">Kasse</div>
          <div className="kennzahl-wert">{chf(f.kasse)}</div>
          {f.wochenUnterNull > 0 && <div className="kennzahl-zusatz">seit {f.wochenUnterNull} Wochen im Minus</div>}
        </div>
        <div className="kennzahl">
          <div className="kennzahl-label">Beiträge pro Jahr (aktuell)</div>
          <div className="kennzahl-wert">{chf(jahresertrag)}</div>
        </div>
        <div className="kennzahl">
          <div className="kennzahl-label">Saisonergebnis bisher</div>
          <div className="kennzahl-wert">{chf(saisonBuchungen.reduce((a, b) => a + b.betrag, 0))}</div>
        </div>
      </div>

      <Karte titel="Mitgliederbeiträge" aktion={aenderbar ? <Badge ton="gut">änderbar (Vorbereitung)</Badge> : <Badge>nur in der Vorbereitung änderbar</Badge>}>
        <div className="formular-raster">
          {STUFEN.map((st) => (
            <label key={st}>
              {st} (CHF/Jahr)
              <input
                type="number"
                min={B.finanzen.beitragMin}
                max={B.finanzen.beitragMax}
                step={10}
                disabled={!aenderbar}
                value={f.beitraege[st]}
                onChange={(e) => spiel.entscheiden({ typ: 'beitrag', stufe: st, betrag: Number(e.target.value) })}
              />
              <small>Richtwert CHF {B.finanzen.beitraegeReferenz[st]}</small>
            </label>
          ))}
          <label>
            Geschwisterrabatt (%)
            <input
              type="number"
              min={0}
              max={100}
              step={5}
              disabled={!aenderbar}
              value={f.geschwisterrabatt}
              onChange={(e) => spiel.entscheiden({ typ: 'geschwisterrabatt', prozent: Number(e.target.value) })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              disabled={!aenderbar}
              checked={f.haertefallfonds}
              onChange={(e) => spiel.entscheiden({ typ: 'haertefallfonds', aktiv: e.target.checked })}
            />
            Härtefallfonds: Familien mit tiefem Einkommen zahlen {Math.round(B.finanzen.haertefallRabatt * 100)} % weniger
          </label>
        </div>
        <p className="klein">Höhere Beiträge bringen Geld, senken aber Neueintritte und erhöhen Austritte – besonders bei Familien mit wenig Einkommen.</p>
      </Karte>

      <Karte titel="Laufende Ausgaben">
        <div className="formular-raster">
          <label>
            Material
            <select value={f.material} onChange={(e) => spiel.entscheiden({ typ: 'material', niveau: e.target.value as Niveau })}>
              {NIVEAUS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({chf(B.finanzen.material[n.id])}/Woche)
                </option>
              ))}
            </select>
          </label>
          <label>
            Trainerentschädigung
            <select value={f.entschaedigung} onChange={(e) => spiel.entscheiden({ typ: 'entschaedigung', niveau: e.target.value as Niveau })}>
              {NIVEAUS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({chf(B.finanzen.entschaedigungProTrainer[n.id])} pro Person/Woche)
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="klein">Gutes Material verbessert den Rahmen; zu tiefe Entschädigung erhöht das Rücktrittsrisiko.</p>
      </Karte>

      <Karte titel="Anwerbung">
        <ul className="massnahmen">
          {ANWERBUNG.map((m) => (
            <li key={m.id} className="massnahme">
              <div>
                <strong>{m.name}</strong> <span className="klein">· {chf(m.kosten)} · Reichweite {m.reichweite[0]}–{m.reichweite[1]} Kinder · Alter {m.alter[0]}–{m.alter[1]}</span>
                <p className="klein">{m.beschreibung}</p>
              </div>
              <div className="zeile">
                {m.zielStufeWaehlbar && (
                  <label>
                    <span className="sr-only">Zielstufe</span>
                    <select value={zielStufe} onChange={(e) => setZielStufe(e.target.value as Stufe)}>
                      {STUFEN.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  className="knopf"
                  onClick={() => spiel.entscheiden({ typ: 'anwerbung', massnahmeId: m.id, zielStufe: m.zielStufeWaehlbar ? zielStufe : undefined })}
                >
                  Diese Woche durchführen
                </button>
              </div>
            </li>
          ))}
        </ul>
        {geplant.length > 0 && (
          <>
            <h3>Geplant für diese Woche</h3>
            <ul className="liste">
              {geplant.map(({ e, i }) =>
                e.typ === 'anwerbung' ? (
                  <li key={i} className="liste-zeile">
                    <span>
                      {ANWERBUNG.find((m) => m.id === e.massnahmeId)?.name}
                      {e.zielStufe ? ` (${e.zielStufe})` : ''}
                    </span>
                    <button className="knopf klein" onClick={() => spiel.entfernen(i)}>
                      Entfernen
                    </button>
                  </li>
                ) : null
              )}
            </ul>
          </>
        )}
      </Karte>

      <Karte titel={`Buchungen Saison ${s.saison}`}>
        <div className="tabelle-huelle">
          <table className="tabelle">
            <thead>
              <tr>
                <th scope="col">Kategorie</th>
                <th scope="col" className="zahl">
                  Saison
                </th>
                <th scope="col" className="zahl">
                  Letzte Woche
                </th>
              </tr>
            </thead>
            <tbody>
              {summen(saisonBuchungen).map(([kat, betrag]) => (
                <tr key={kat}>
                  <th scope="row">{KATEGORIE_NAMEN[kat]}</th>
                  <td className={`zahl ${betrag < 0 ? 'negativ' : ''}`}>{chf(betrag)}</td>
                  <td className="zahl">{chf(letzteWoche.filter((b) => b.kategorie === kat).reduce((a, b) => a + b.betrag, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {saisonBuchungen.length === 0 && <p className="leer">Noch keine Buchungen in dieser Saison.</p>}
      </Karte>
    </div>
  );
}
